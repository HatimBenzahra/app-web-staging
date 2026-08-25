import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CoachingQuality, CoachingStatus, StatutPorte } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { TranscriptionService } from '../transcription/transcription.service';
import { SalesPlanService } from './sales-plan.service';
import { LlmService } from './llm.service';
import { ScoringService } from './scoring.service';
import { buildSystemPrompt, buildUserPrompt, productKeysFromPlan } from './prompt';
import {
  repairConformityOutput,
  repairLlmOutput,
  repairMappingOutput,
} from './json-repair';
import {
  LlmCoachingOutput,
  LlmCriterionResult,
  ProductViolation,
} from './coaching.types';
import { ActiveProductSheet, ProductSheetService } from './product-sheet.service';
import {
  MappedProduct,
  MappingProductOption,
  buildMappingSystemPrompt,
  buildMappingUserPrompt,
} from './product-mapping-prompt';
import {
  ConformityProductContext,
  buildConformitySystemPrompt,
  buildConformityUserPrompt,
} from './product-conformity-prompt';
import { ParsedSalesPlan } from './sales-plan.types';

const MAX_ATTEMPTS = 3;

/**
 * Moteur d'exécution du pipeline A (analyse par enregistrement) :
 * worker de file (@Cron), claim atomique, pipeline transcription→LLM→scoring,
 * politique de retry/backoff et limiteur de concurrence. Les jobs vivent en
 * base (table CoachingAnalysis) : résilient au crash, non bloquant (hors HTTP).
 */
@Injectable()
export class AnalysisRunnerService {
  private readonly logger = new Logger(AnalysisRunnerService.name);

  // Limiteur de concurrence maison (même pattern que TranscriptionService).
  private readonly maxConcurrency = Number(
    process.env.COACHING_CONCURRENCY ?? 2,
  );
  private running = 0;
  private readonly waitQueue: (() => void)[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly transcription: TranscriptionService,
    private readonly salesPlans: SalesPlanService,
    private readonly llm: LlmService,
    private readonly scoring: ScoringService,
    private readonly productSheets: ProductSheetService,
  ) {}

  private async acquireSlot(): Promise<void> {
    if (this.running < this.maxConcurrency) {
      this.running++;
      return;
    }
    await new Promise<void>((resolve) => this.waitQueue.push(resolve));
    this.running++;
  }

  private releaseSlot(): void {
    this.running--;
    const next = this.waitQueue.shift();
    if (next) next();
  }

  /**
   * Délai au-delà duquel un job "en cours" est considéré comme bloqué (process
   * mort) et requeue. DOIT dépasser le pire cas légitime de traitement
   * (Whisper + LLM + marge), sinon un job encore vivant serait re-claimé →
   * double transcription.
   */
  private staleJobMs(): number {
    // Le pire cas légitime reste DEUX timeouts LLM : la passe 0 (mapping), puis
    // la plus lente des passes 1 et 2, qui tournent en parallèle. Ne pas réduire
    // ce seuil sous prétexte que les passes sont parallèles, sinon un job encore
    // vivant est re-claimé → double transcription.
    return (
      this.transcription.whisperTimeoutMs +
      2 * this.llm.timeoutMs +
      10 * 60_000
    );
  }

  /**
   * Worker de file : prend les jobs PENDING dus et les traite. Résilient
   * (les jobs vivent en base) et non bloquant (traité hors requête HTTP).
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async processQueue(): Promise<void> {
    if (!this.llm.isConfigured()) return;
    try {
      // Requeue des jobs réellement bloqués (process mort) : uniquement au-delà
      // du pire cas légitime (Whisper + LLM + marge), sinon on re-claimerait un
      // job encore en cours = double transcription. Chaque requeue passe par
      // fail() → compte une tentative et bascule FAILED au-delà de MAX_ATTEMPTS
      // (évite les zombies éternels qui monopolisent un slot).
      const staleBefore = new Date(Date.now() - this.staleJobMs());
      const stale = await this.prisma.coachingAnalysis.findMany({
        where: {
          status: {
            in: [
              CoachingStatus.TRANSCRIBING,
              CoachingStatus.MAPPING,
              CoachingStatus.ANALYZING,
              // CONFORMITY n'est plus écrit (la conformité tourne pendant
              // ANALYZING), mais des lignes antérieures le portent encore : les
              // omettre laisserait un job mort bloqué pour toujours.
              CoachingStatus.CONFORMITY,
            ],
          },
          updatedAt: { lt: staleBefore },
        },
        select: { id: true },
      });
      for (const j of stale) {
        await this.fail(j.id, 'Job bloqué (délai de traitement dépassé)');
      }

      const free = this.maxConcurrency - this.running;
      if (free <= 0) return;

      const now = new Date();
      const candidates = await this.prisma.coachingAnalysis.findMany({
        where: {
          status: CoachingStatus.PENDING,
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        },
        orderBy: { id: 'asc' },
        take: free,
        select: { id: true },
      });

      for (const c of candidates) {
        // Claim atomique PENDING → TRANSCRIBING (évite le double traitement).
        const claimed = await this.prisma.coachingAnalysis.updateMany({
          where: { id: c.id, status: CoachingStatus.PENDING },
          data: { status: CoachingStatus.TRANSCRIBING },
        });
        if (claimed.count === 1) void this.run(c.id);
      }
    } catch (e) {
      this.logger.error(`processQueue: ${(e as Error).message}`);
    }
  }

  /** Pipeline complet d'une analyse : transcription → LLM → scoring. */
  private async run(id: number): Promise<void> {
    await this.acquireSlot();
    try {
      const analysis = await this.prisma.coachingAnalysis.findUnique({
        where: { id },
        include: { salesPlanVersion: true },
      });
      if (!analysis) return;

      const plan = this.salesPlans.toParsedPlan(analysis.salesPlanVersion);
      const q = plan.quality;
      // Lancement manuel : on ignore tout gating sur la DURÉE (l'utilisateur
      // veut analyser cet audio quoi qu'il arrive). Le gating "pas de parole"
      // (longueur du transcript) reste actif.
      const manual = analysis.manual === true;

      // Réutilise le transcript déjà stocké (ex. retry après un échec LLM) pour
      // ne pas re-payer download S3 + Whisper. Sinon, transcrit maintenant.
      let transcript = (analysis.transcript ?? '').trim();
      let durationSec = analysis.transcriptDurationSec ?? 0;

      if (!transcript) {
        // 0. Pré-gating sur la durée CONNUE (DB) — évite une transcription
        // inutile (download S3 + Whisper) quand l'audio est trop court.
        const known = await this.prisma.recordingSegment.aggregate({
          where: { s3KeyOriginal: analysis.s3KeyOriginal },
          _max: { durationSec: true },
        });
        const knownDuration = known._max.durationSec ?? null;
        if (
          !manual &&
          knownDuration != null &&
          q.minDurationSec != null &&
          knownDuration < q.minDurationSec
        ) {
          await this.markInexploitable(id, knownDuration, null);
          this.logger.log(
            `Analyse ${id} INEXPLOITABLE (durée connue ${knownDuration}s < ${q.minDurationSec}s) — transcription évitée`,
          );
          return;
        }

        // 1. Transcription (Whisper depuis S3)
        await this.setStatus(id, CoachingStatus.TRANSCRIBING);
        const stt = await this.transcription.transcribeS3Object(
          analysis.s3KeyOriginal,
        );
        if (!stt) {
          await this.fail(id, 'Transcription indisponible (Whisper)');
          return;
        }
        transcript = (stt.text ?? '').trim();
        durationSec = stt.durationSec ?? knownDuration ?? 0;

        // Persiste le transcript dès maintenant : si le LLM échoue plus bas, le
        // retry réutilisera ce transcript au lieu de relancer Whisper.
        if (transcript) {
          await this.prisma.coachingAnalysis.update({
            where: { id },
            data: { transcript, transcriptDurationSec: durationSec },
          });
        }
      }

      // 2. Gating post-transcription : longueur du transcript (+ durée réelle
      // en repli). En manuel, on n'applique QUE le gating "pas de parole".
      const tooShort =
        (!manual &&
          q.minDurationSec != null &&
          durationSec < q.minDurationSec) ||
        (q.minTranscriptChars != null &&
          transcript.length < q.minTranscriptChars);
      if (tooShort) {
        await this.markInexploitable(id, durationSec, transcript);
        this.logger.log(
          `Analyse ${id} INEXPLOITABLE (durée=${durationSec}s, ${transcript.length} car.)`,
        );
        return;
      }

      // 3. Passe 0 — mapping des offres. Un prompt court, une seule question, une
      // liste fermée de clés : c'est ce qui rend la détection reproductible. Tant
      // qu'elle n'a pas répondu, ni le jugement du plan ni la conformité ne savent
      // quelles étapes produit sont concernées.
      await this.setStatus(id, CoachingStatus.MAPPING);
      const sheets = await this.productSheets.getActiveSheetsFor(
        productKeysFromPlan(plan),
      );
      const mapping = await this.runMappingPass(id, plan, sheets, transcript);
      // Seules les offres PRÉSENTÉES PAR LE COMMERCIAL rendent une étape
      // applicable. Une offre que le prospect évoque (« j'ai déjà une box ») ne
      // doit pas entrer au dénominateur : ses critères sortiraient absent = 0.
      const presented = mapping
        .filter((m) => m.presentedByCommercial)
        .map((m) => m.key);

      // 4. Passes 1 et 2 EN PARALLÈLE : le jugement du plan et la conformité
      // produit ne s'échangent rien, ils ne dépendaient tous deux que du mapping.
      //
      // Promise.all, pas allSettled : un critère absent de la sortie LLM vaut
      // `absent` = 0 et compte au dénominateur. Publier une seule des deux passes
      // donnerait un score FAUX, pas un score partiel — mieux vaut échouer et
      // laisser le retry rejouer les deux (le transcript est déjà en base).
      await this.setStatus(id, CoachingStatus.ANALYZING);
      const [llmOut, conformity] = await Promise.all([
        this.runPlanPass(plan, transcript, presented),
        this.runConformityPass(plan, sheets, presented, transcript),
      ]);

      // 5. Scoring backend (source de vérité). Les critères des deux passes sont
      // concaténés : ScoringService reçoit la même liste qu'avant, simplement
      // produite en deux temps.
      const contractSigned = analysis.statutPorte === StatutPorte.CONTRAT_SIGNE;
      const scoring = this.scoring.computeScore(
        plan,
        { ...llmOut, criteria: [...llmOut.criteria, ...conformity.criteria] },
        {
          contractSigned,
          detectedProducts: presented,
          violations: conformity.violations,
        },
      );

      const quality =
        q.lowConfidenceBelowSec != null && durationSec < q.lowConfidenceBelowSec
          ? CoachingQuality.LOW_CONFIDENCE
          : CoachingQuality.ANALYZED;

      await this.prisma.coachingAnalysis.update({
        where: { id },
        data: {
          status: CoachingStatus.READY,
          quality,
          score: scoring.score,
          scoreBeforeMalus: scoring.scoreBeforeMalus,
          malus: scoring.malus,
          violations: scoring.violations as unknown as object,
          detectedProducts: presented as unknown as object,
          // Trace complète de la passe 0, y compris les offres vues mais NON
          // présentées par le commercial : sans ça, un « il a raté l'offre » reste
          // indiagnosticable après coup.
          productMapping: mapping as unknown as object,
          productSheetVersions: conformity.sheetVersionIds as unknown as object,
          subScores: scoring.subScores as unknown as object,
          criterionResults: scoring.criterionResults as unknown as object,
          confidence: llmOut.confidence,
          summary: llmOut.summary || null,
          strengths: llmOut.strengths as unknown as object,
          improvements: llmOut.improvements as unknown as object,
          recommendations: llmOut.recommendations as unknown as object,
          transcript,
          transcriptDurationSec: durationSec,
          error: null,
        },
      });
      this.logger.log(
        `Analyse ${id} READY — score=${scoring.score}` +
          (scoring.malus > 0
            ? ` (brut ${scoring.scoreBeforeMalus} − malus ${scoring.malus}, ${scoring.violations.length} violation(s))`
            : '') +
          ` qualité=${quality}`,
      );
    } catch (error) {
      await this.fail(id, (error as Error).message);
    } finally {
      this.releaseSlot();
    }
  }

  /**
   * Passe 0 — mapping des offres.
   *
   * Le modèle choisit dans une LISTE FERMÉE de clés, et le backend rejette tout ce
   * qui n'y figure pas. C'est la correction de l'instabilité historique : la
   * détection était une sous-tâche noyée dans le prompt de jugement, et renvoyait
   * du texte libre (« Pack Depanssur », « france-telephone », « mobile France
   * Téléphone ») re-normalisé à coups de regex avant comparaison stricte aux clés
   * du plan — un run tombait juste, le suivant non.
   *
   * Les offres du plan qui n'ont pas de fiche active restent proposées : sans ça,
   * un trou de référentiel rendrait l'étape à jamais non applicable. Elles sont
   * simplement décrites avec ce que le plan en dit.
   */
  private async runMappingPass(
    id: number,
    plan: ParsedSalesPlan,
    sheets: ActiveProductSheet[],
    transcript: string,
  ): Promise<MappedProduct[]> {
    const options = this.buildMappingOptions(plan, sheets);
    if (options.length === 0) return [];

    const raw = await this.llm.chatJson(
      buildMappingSystemPrompt(),
      buildMappingUserPrompt(options, transcript),
    );
    const { products, rejected } = repairMappingOutput(
      raw,
      options.map((o) => o.key),
    );

    // Une clé hors liste est un signal, pas un détail : c'est exactement ce qui
    // faisait rater des analyses en silence.
    if (rejected.length > 0) {
      this.logger.warn(
        `Analyse ${id} — mapping : clé(s) hors liste ignorée(s) : ${rejected.join(', ')}`,
      );
    }
    this.logger.log(
      `Analyse ${id} — offres présentées : ${
        products
          .filter((p) => p.presentedByCommercial)
          .map((p) => p.key)
          .join(', ') || '(aucune)'
      }`,
    );
    return products;
  }

  /**
   * La liste fermée soumise à la passe 0 : toutes les offres du plan, décrites par
   * leur fiche quand elle existe, par leur étape sinon.
   */
  private buildMappingOptions(
    plan: ParsedSalesPlan,
    sheets: ActiveProductSheet[],
  ): MappingProductOption[] {
    const byProductKey = new Map(sheets.map((s) => [s.sheet.productKey, s]));

    return productKeysFromPlan(plan).map((key) => {
      const active = byProductKey.get(key);
      if (active) {
        return {
          key,
          label: active.sheet.label,
          // Les `identifiers` décrivent l'offre à l'oreille ; sans eux, les
          // premiers `facts` font un repli acceptable.
          identifiers: active.sheet.identifiers.length
            ? active.sheet.identifiers
            : active.sheet.facts.slice(0, 3),
        };
      }

      // Pas de fiche : le plan reste une description exploitable de l'offre.
      const step = plan.steps.find(
        (st) => st.appliesWhen === `productDetected:${key}`,
      );
      return {
        key,
        label: step?.label ?? key,
        identifiers: (step?.criteria ?? []).map((c) => c.label).slice(0, 3),
      };
    });
  }

  /** Passe 1 — jugement du plan de vente, sur les étapes réellement applicables. */
  private async runPlanPass(
    plan: ParsedSalesPlan,
    transcript: string,
    presented: string[],
  ): Promise<LlmCoachingOutput> {
    const raw = await this.llm.chatJson(
      buildSystemPrompt(),
      buildUserPrompt(plan, transcript, presented),
    );
    return repairLlmOutput(raw);
  }

  /**
   * Passe 2 — conformité produit.
   *
   * N'injecte que la fiche des offres RÉELLEMENT présentées, retenues par la passe
   * 0, et demande une seule chose : ce que le commercial a dit de ce produit est-il
   * conforme à la fiche ?
   *
   * Une offre présentée sans fiche ne peut pas être jugée : ses critères de
   * conformité sont marqués `non_applicable` plutôt que laissés absents, sinon
   * ScoringService les noterait 0 et sanctionnerait un trou de référentiel.
   */
  private async runConformityPass(
    plan: ParsedSalesPlan,
    sheets: ActiveProductSheet[],
    presented: string[],
    transcript: string,
  ): Promise<{
    criteria: LlmCriterionResult[];
    violations: ProductViolation[];
    sheetVersionIds: number[];
  }> {
    // Fabriqué à chaque appel : un littéral partagé exposerait les mêmes tableaux
    // à tous les appelants.
    const empty = () => ({
      criteria: [] as LlmCriterionResult[],
      violations: [] as ProductViolation[],
      sheetVersionIds: [] as number[],
    });
    if (presented.length === 0) return empty();

    // Les étapes des offres présentées qui portent des critères de conformité.
    const steps = plan.steps.filter((step) => {
      const m = /^productDetected:(.+)$/.exec(step.appliesWhen);
      return (
        m !== null &&
        presented.includes(m[1]) &&
        step.criteria.some((c) => c.requiresProductSheet)
      );
    });
    if (steps.length === 0) return empty();

    const byProductKey = new Map(sheets.map((s) => [s.sheet.productKey, s]));

    const contexts: ConformityProductContext[] = [];
    const unjudgeable: LlmCriterionResult[] = [];

    for (const step of steps) {
      const productKey = /^productDetected:(.+)$/.exec(step.appliesWhen)![1];
      const criteria = step.criteria.filter((c) => c.requiresProductSheet);
      const active = byProductKey.get(productKey);

      // Sans fiche, il n'y a rien à opposer au discours : on ne juge pas, et on
      // ne pénalise pas un trou de référentiel.
      if (!active) {
        this.logger.warn(
          `Produit "${productKey}" présenté mais sans fiche active : conformité non jugée`,
        );
        for (const c of criteria) {
          unjudgeable.push({
            stepKey: step.key,
            criterionKey: c.key,
            status: 'non_applicable',
            evidence: [],
            comment: 'Aucune fiche produit active : conformité non jugée',
          });
        }
        continue;
      }

      contexts.push({
        productKey,
        label: active.sheet.label,
        facts: active.sheet.facts,
        forbidden: active.sheet.forbidden,
        criteria: criteria.map((c) => ({
          stepKey: step.key,
          criterionKey: c.key,
          label: c.label,
          evidenceRequired: c.evidenceRequired,
        })),
      });
    }

    if (contexts.length === 0) {
      return { criteria: unjudgeable, violations: [], sheetVersionIds: [] };
    }

    const raw = await this.llm.chatJson(
      buildConformitySystemPrompt(),
      buildConformityUserPrompt(contexts, transcript),
    );
    const out = repairConformityOutput(raw);

    // Une violation sur un produit non soumis est écartée : le LLM n'a pas à
    // sanctionner un produit dont on ne lui a pas donné les référentiels.
    // Au passage on résout le libellé lisible : le modèle ne renvoie que le slug.
    const labels = new Map(contexts.map((c) => [c.productKey, c.label]));
    const violations = out.violations
      .filter((v) => labels.has(v.productSlug))
      .map((v) => ({ ...v, productLabel: labels.get(v.productSlug) ?? null }));

    return {
      criteria: [...unjudgeable, ...out.criteria],
      violations,
      sheetVersionIds: contexts
        .map((c) => byProductKey.get(c.productKey)?.versionId)
        .filter((id): id is number => typeof id === 'number'),
    };
  }

  private async setStatus(id: number, status: CoachingStatus): Promise<void> {
    await this.prisma.coachingAnalysis.update({
      where: { id },
      data: { status },
    });
  }

  private async markInexploitable(
    id: number,
    durationSec: number,
    transcript: string | null,
  ): Promise<void> {
    await this.prisma.coachingAnalysis.update({
      where: { id },
      data: {
        status: CoachingStatus.READY,
        quality: CoachingQuality.INEXPLOITABLE,
        transcript: transcript ?? undefined,
        transcriptDurationSec: durationSec,
        score: null,
        error: null,
      },
    });
  }

  private async fail(id: number, message: string): Promise<void> {
    try {
      const cur = await this.prisma.coachingAnalysis.findUnique({
        where: { id },
        select: { attempts: true },
      });
      const attempts = (cur?.attempts ?? 0) + 1;
      if (attempts < MAX_ATTEMPTS) {
        // Retry avec backoff : le job repasse PENDING, repris par le worker.
        await this.prisma.coachingAnalysis.update({
          where: { id },
          data: {
            status: CoachingStatus.PENDING,
            attempts,
            nextRetryAt: new Date(Date.now() + 30_000 * attempts),
            error: message?.slice(0, 1000),
          },
        });
        this.logger.warn(
          `Analyse ${id} échec (tentative ${attempts}/${MAX_ATTEMPTS}), retry programmé — ${message}`,
        );
      } else {
        await this.prisma.coachingAnalysis.update({
          where: { id },
          data: {
            status: CoachingStatus.FAILED,
            quality: CoachingQuality.FAILED,
            attempts,
            error: message?.slice(0, 1000),
          },
        });
        this.logger.error(
          `Analyse ${id} FAILED (${attempts} tentatives) — ${message}`,
        );
      }
    } catch (e) {
      this.logger.error(`fail(${id}): ${(e as Error).message}`);
    }
  }
}
