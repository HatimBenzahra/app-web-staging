import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CoachingQuality, CoachingStatus, StatutPorte } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { TranscriptionService } from '../../transcription/transcription.service';
import { SalesPlanService } from '../referentiels/sales-plan.service';
import { LlmService } from '../shared/llm.service';
import { ScoringService } from './etape-5-scoring/scoring.service';
import { buildSystemPrompt, buildUserPrompt, productKeysFromPlan } from './etape-3-plan/plan-prompt';
import {
  repairConformityOutput,
  repairLlmOutput,
  repairMappingOutput,
} from '../shared/json-repair';
import {
  LlmCoachingOutput,
  LlmCriterionResult,
  ProductViolation,
} from '../shared/coaching.types';
import {
  ProductSheetDescriptor,
  ProductSheetService,
} from '../referentiels/product-sheet.service';
import { ProductPriceService } from '../referentiels/product-price.service';
import {
  MappedProduct,
  MappingProductOption,
  buildMappingSystemPrompt,
  buildMappingUserPrompt,
} from './etape-2-mapping/product-mapping-prompt';
import {
  ConformityProductContext,
  buildConformitySystemPrompt,
  buildConformityUserPrompt,
} from './etape-4-conformite/product-conformity-prompt';
import { ParsedSalesPlan } from '../referentiels/sales-plan.types';
import { buildSttVocabulary } from './etape-1-transcription/stt-vocabulary';

const MAX_ATTEMPTS = 3;

/**
 * Worker de file du pipeline par porte : claim atomique, transcription, 3 passes
 * LLM, scoring — les jobs vivent en base, donc résistent au crash du process.
 */
@Injectable()
export class AnalysisRunnerService {
  private readonly logger = new Logger(AnalysisRunnerService.name);

  // Limiteur maison, même pattern que TranscriptionService.
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
    private readonly productPrices: ProductPriceService,
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

  /** Seuil de requeue : le baisser fait re-claimer un job vivant, donc re-transcrire. */
  private staleJobMs(): number {
    // Pire cas légitime : le mapping, puis la plus lente des deux passes parallèles.
    return (
      this.transcription.whisperTimeoutMs +
      2 * this.llm.timeoutMs +
      10 * 60_000
    );
  }

  /** Prend les jobs PENDING dus et les traite, hors requête HTTP. */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async processQueue(): Promise<void> {
    if (!this.llm.isConfigured()) return;
    try {
      // Requeue via fail() : compte une tentative, donc pas de zombie éternel.
      const staleBefore = new Date(Date.now() - this.staleJobMs());
      const stale = await this.prisma.coachingAnalysis.findMany({
        where: {
          status: {
            in: [
              CoachingStatus.TRANSCRIBING,
              CoachingStatus.MAPPING,
              CoachingStatus.ANALYZING,
              // CONFORMITY n'est plus écrit mais reste porté par les analyses antérieures.
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
        // Claim atomique : c'est lui qui empêche le double traitement.
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

      // Le NOM des fiches pour toutes les offres ; leur CONTENU seulement après le mapping.
      const descriptors = await this.productSheets.getActiveDescriptors(
        productKeysFromPlan(plan),
      );
      // Lancement manuel : seul le gating de durée est ignoré, pas celui de parole.
      const manual = analysis.manual === true;

      // Transcript déjà stocké : un retry LLM ne re-paie pas Whisper.
      let transcript = (analysis.transcript ?? '').trim();
      let durationSec = analysis.transcriptDurationSec ?? 0;

      if (!transcript) {
        // 0. Pré-gating sur la durée connue : évite une transcription inutile.
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
        // Le coaching porte son profil STT : Whisper reste générique, sans nom de marque.
        const stt = await this.transcription.transcribeS3Object(
          analysis.s3KeyOriginal,
          {
            initialPrompt: buildSttVocabulary(plan, descriptors),
          },
        );
        if (!stt) {
          await this.fail(id, 'Transcription indisponible (Whisper)');
          return;
        }
        transcript = (stt.text ?? '').trim();
        durationSec = stt.durationSec ?? knownDuration ?? 0;

        // Persisté tout de suite : un échec LLM ne doit pas re-payer Whisper.
        if (transcript) {
          await this.prisma.coachingAnalysis.update({
            where: { id },
            data: { transcript, transcriptDurationSec: durationSec },
          });
        }
      }

      // 2. Gating post-transcription : longueur du transcript, durée en repli.
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

      // 3. Passe 0 — mapping : rien en aval ne sait quelles offres traiter avant elle.
      await this.setStatus(id, CoachingStatus.MAPPING);
      const mapping = await this.runMappingPass(id, plan, descriptors, transcript);
      // Une offre évoquée par le prospect n'entre pas au dénominateur.
      const presented = mapping
        .filter((m) => m.presentedByCommercial)
        .map((m) => m.key);

      // 4. Passes 1 et 2 en parallèle, en fail-fast : publier une seule des deux
      // donnerait un score FAUX, un critère manquant valant 0 au dénominateur.
      await this.setStatus(id, CoachingStatus.ANALYZING);
      const [llmOut, conformity] = await Promise.all([
        this.runPlanPass(plan, transcript, presented),
        this.runConformityPass(plan, presented, transcript),
      ]);

      // 5. Scoring backend : les critères des deux passes, en une seule liste.
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
          // Trace de la passe 0, offres non présentées comprises, pour le diagnostic.
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
   * Passe 0 : le modèle choisit dans une liste fermée, et les offres sans fiche y
   * restent — sinon un trou de référentiel rendrait l'étape à jamais inapplicable.
   */
  private async runMappingPass(
    id: number,
    plan: ParsedSalesPlan,
    descriptors: ProductSheetDescriptor[],
    transcript: string,
  ): Promise<MappedProduct[]> {
    const options = this.buildMappingOptions(plan, descriptors);
    if (options.length === 0) return [];

    const raw = await this.llm.chatJson(
      buildMappingSystemPrompt(),
      buildMappingUserPrompt(options, transcript),
    );
    const { products, rejected } = repairMappingOutput(
      raw,
      options.map((o) => o.key),
    );

    // Une clé hors liste est le symptôme même des analyses ratées en silence.
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

  /** Toutes les offres du plan, décrites par leur fiche ou, à défaut, par leur étape. */
  private buildMappingOptions(
    plan: ParsedSalesPlan,
    descriptors: ProductSheetDescriptor[],
  ): MappingProductOption[] {
    const byProductKey = new Map(descriptors.map((d) => [d.productKey, d]));

    return productKeysFromPlan(plan).map((key) => {
      const descriptor = byProductKey.get(key);
      // Sans `identifiers`, le libellé suffit : la passe 0 reconnaît, elle ne juge pas.
      if (descriptor && descriptor.identifiers.length > 0) {
        return {
          key,
          label: descriptor.label,
          identifiers: descriptor.identifiers,
        };
      }
      if (descriptor) {
        return { key, label: descriptor.label, identifiers: [] };
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
   * Passe 2 : seules les offres présentées sont jugées, et celles sans fiche
   * sortent en `non_applicable` — sinon un trou de référentiel coûterait 0.
   */
  private async runConformityPass(
    plan: ParsedSalesPlan,
    presented: string[],
    transcript: string,
  ): Promise<{
    criteria: LlmCriterionResult[];
    violations: ProductViolation[];
    sheetVersionIds: number[];
  }> {
    // Fabriqué à chaque appel : un littéral partagé exposerait les mêmes tableaux.
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

    // Seule étape qui a besoin de `facts` et `forbidden`, et seulement pour les offres présentées.
    const sheets = await this.productSheets.getActiveSheetsFor(
      steps.map((step) => /^productDetected:(.+)$/.exec(step.appliesWhen)![1]),
    );
    const byProductKey = new Map(sheets.map((s) => [s.sheet.productKey, s]));

    const contexts: ConformityProductContext[] = [];
    const unjudgeable: LlmCriterionResult[] = [];

    for (const step of steps) {
      const productKey = /^productDetected:(.+)$/.exec(step.appliesWhen)![1];
      const criteria = step.criteria.filter((c) => c.requiresProductSheet);
      const active = byProductKey.get(productKey);

      // Sans fiche, rien à opposer au discours : on ne juge pas, on ne pénalise pas.
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
        // Tarifs résolus à l'exécution : une fiche ne porte jamais de prix.
        prices: await this.productPrices.resolve(active.sheet.winleadplus),
        forbidden: active.sheet.forbidden,
        // Absent, aucune violation ne passera le filtre : c'est voulu.
        pitchText: step.pitchText,
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

    // Un produit non soumis est écarté, et le libellé résolu : le modèle ne rend qu'un slug.
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
        // Retry avec backoff : le job repasse PENDING.
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
