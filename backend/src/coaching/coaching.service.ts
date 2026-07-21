import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CoachingQuality,
  CoachingStatus,
  StatutPorte,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { TranscriptionService } from '../transcription/transcription.service';
import { SalesPlanService } from './sales-plan.service';
import { LlmService } from './llm.service';
import { ScoringService } from './scoring.service';
import { buildSystemPrompt, buildUserPrompt } from './prompt';
import { repairLlmOutput } from './json-repair';
import {
  CoachingAnalysesFilter,
  CoachingAnalysisDto,
  CoachingQueueItemDto,
  CoachingManagementFilter,
  CoachingManagementItemDto,
} from './coaching.dto';
import {
  CriterionScore,
  LlmCoachingOutput,
  StepScore,
} from './coaching.types';

export interface EnqueueCoachingInput {
  s3Key: string;
  porteId?: number | null;
  statut?: string | null;
  durationSec?: number | null;
}

// Statuts porte coachables par défaut (surchargés par la config DB éditable).
const COACHABLE_STATUTS_DEFAULT = [
  'REFUS',
  'ARGUMENTE',
  'RENDEZ_VOUS_PRIS',
  'CONTRAT_SIGNE',
];
const ALL_STATUTS = [
  'NON_VISITE',
  'CONTRAT_SIGNE',
  'REFUS',
  'RENDEZ_VOUS_PRIS',
  'ABSENT',
  'ARGUMENTE',
  'NECESSITE_REPASSAGE',
];
const MAX_ATTEMPTS = 3;
// Durée min (s) d'un audio pour l'analyse AUTO — valeur par défaut si la config
// DB est absente ; la vraie valeur est éditable dans les Réglages (CoachingConfig).
// La durée provient de la porte (segment). L'analyse MANUELLE (à venir) l'ignore.
const MIN_AUTO_DURATION_SEC_DEFAULT = 120;

@Injectable()
export class CoachingService {
  private readonly logger = new Logger(CoachingService.name);

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

  // --- Config (statuts coachables + durée min auto), éditable depuis la gestion ---
  private configCache: {
    statuts: string[];
    minAutoDurationSec: number;
    at: number;
  } | null = null;

  /** Charge la config (cache 30 s), en créant la ligne par défaut au besoin. */
  private async loadConfig(): Promise<{
    statuts: string[];
    minAutoDurationSec: number;
  }> {
    if (this.configCache && Date.now() - this.configCache.at < 30_000) {
      return this.configCache;
    }
    let cfg = await this.prisma.coachingConfig.findUnique({ where: { id: 1 } });
    if (!cfg) {
      cfg = await this.prisma.coachingConfig.create({
        data: { id: 1, coachableStatuts: COACHABLE_STATUTS_DEFAULT },
      });
    }
    const statuts = Array.isArray(cfg.coachableStatuts)
      ? (cfg.coachableStatuts as string[])
      : COACHABLE_STATUTS_DEFAULT;
    const minAutoDurationSec = cfg.minAutoDurationSec ?? MIN_AUTO_DURATION_SEC_DEFAULT;
    this.configCache = { statuts, minAutoDurationSec, at: Date.now() };
    return this.configCache;
  }

  /** Statuts porte qui déclenchent l'analyse auto (config DB, cache 30 s). */
  async getCoachableStatuts(): Promise<string[]> {
    return (await this.loadConfig()).statuts;
  }

  /** Durée minimale (s) d'un audio pour l'analyse AUTO (config DB, cache 30 s). */
  async getMinAutoDurationSec(): Promise<number> {
    return (await this.loadConfig()).minAutoDurationSec;
  }

  /** Met à jour la liste des statuts coachables (admin, page de gestion). */
  async setCoachableStatuts(statuts: string[]): Promise<string[]> {
    const clean = [...new Set((statuts ?? []).filter((s) => ALL_STATUTS.includes(s)))];
    await this.prisma.coachingConfig.upsert({
      where: { id: 1 },
      create: { id: 1, coachableStatuts: clean },
      update: { coachableStatuts: clean },
    });
    this.configCache = null; // invalide le cache
    return clean;
  }

  /** Met à jour la durée minimale (s) d'analyse auto. Bornée à [0, 3600]. */
  async setMinAutoDurationSec(seconds: number): Promise<number> {
    const clean = Math.max(0, Math.min(3600, Math.round(seconds || 0)));
    await this.prisma.coachingConfig.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        coachableStatuts: COACHABLE_STATUTS_DEFAULT,
        minAutoDurationSec: clean,
      },
      update: { minAutoDurationSec: clean },
    });
    this.configCache = null; // invalide le cache
    return clean;
  }

  async getConfig(): Promise<{
    coachableStatuts: string[];
    allStatuts: string[];
    minAutoDurationSec: number;
  }> {
    const c = await this.loadConfig();
    return {
      coachableStatuts: c.statuts,
      allStatuts: ALL_STATUTS,
      minAutoDurationSec: c.minAutoDurationSec,
    };
  }

  /** État de la file + KPIs pour le dashboard de gestion. */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    ready: number;
    failed: number;
    inexploitable: number;
    total: number;
    avgScore: number | null;
  }> {
    const grouped = await this.prisma.coachingAnalysis.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const c: Record<string, number> = {};
    for (const g of grouped) c[g.status] = g._count._all;
    const pending = c[CoachingStatus.PENDING] ?? 0;
    const processing =
      (c[CoachingStatus.TRANSCRIBING] ?? 0) + (c[CoachingStatus.ANALYZING] ?? 0);
    const ready = c[CoachingStatus.READY] ?? 0;
    const failed = c[CoachingStatus.FAILED] ?? 0;
    const total = pending + processing + ready + failed;

    const inexploitable = await this.prisma.coachingAnalysis.count({
      where: { quality: CoachingQuality.INEXPLOITABLE },
    });
    const agg = await this.prisma.coachingAnalysis.aggregate({
      _avg: { score: true },
      where: { score: { not: null } },
    });
    const avgScore =
      agg._avg.score != null ? Math.round(agg._avg.score * 10) / 10 : null;

    return {
      pending,
      processing,
      ready,
      failed,
      inexploitable,
      total,
      avgScore,
    };
  }

  /**
   * Déclenché automatiquement à l'upload d'un enregistrement (fire-and-forget).
   * Idempotent : une seule analyse par (audio × version de plan).
   */
  async enqueue(input: EnqueueCoachingInput): Promise<void> {
    try {
      if (!this.llm.isConfigured()) {
        this.logger.warn('vLLM non configuré, coaching ignoré');
        return;
      }
      // Auto : on ne coache que les échanges dont le statut porte est configuré.
      const coachable = await this.getCoachableStatuts();
      if (!input.statut || !coachable.includes(input.statut)) {
        this.logger.debug(
          `Statut "${input.statut ?? '∅'}" non coachable — auto ignoré pour ${input.s3Key}`,
        );
        return;
      }
      // Auto : audio trop court (< 2 min) → non coaché. La durée vient de la
      // porte (segment d'enregistrement) ; repli sur la durée passée à l'upload.
      const durAgg = await this.prisma.recordingSegment.aggregate({
        _max: { durationSec: true },
        where: { s3KeyOriginal: input.s3Key },
      });
      const durationSec = durAgg._max.durationSec ?? input.durationSec ?? 0;
      const minDuration = await this.getMinAutoDurationSec();
      if (durationSec < minDuration) {
        this.logger.debug(
          `Audio ${input.s3Key} trop court (${durationSec}s < ${minDuration}s) — auto ignoré`,
        );
        return;
      }
      const version = await this.salesPlans.getActiveVersion();
      if (!version) {
        this.logger.warn('Aucun plan de vente actif, coaching ignoré');
        return;
      }
      const recording = await this.prisma.recording.findUnique({
        where: { s3Key: input.s3Key },
        select: { id: true, commercialId: true, managerId: true },
      });
      if (!recording) {
        this.logger.warn(
          `Recording introuvable pour ${input.s3Key}, coaching ignoré`,
        );
        return;
      }

      const existing = await this.prisma.coachingAnalysis.findUnique({
        where: {
          s3KeyOriginal_salesPlanVersionId: {
            s3KeyOriginal: input.s3Key,
            salesPlanVersionId: version.id,
          },
        },
        select: { id: true, status: true },
      });
      if (existing) {
        this.logger.debug(
          `Analyse déjà existante (${existing.status}) pour ${input.s3Key}, skip`,
        );
        return;
      }

      const created = await this.prisma.coachingAnalysis.create({
        data: {
          recordingId: recording.id,
          porteId: input.porteId ?? null,
          commercialId: recording.commercialId,
          managerId: recording.managerId,
          s3KeyOriginal: input.s3Key,
          statutPorte: this.asStatut(input.statut),
          salesPlanVersionId: version.id,
          status: CoachingStatus.PENDING,
        },
        select: { id: true },
      });

      // Le job reste en PENDING : le worker de file (processQueue) le traitera.
      this.logger.debug(`Coaching enfilé (#${created.id}) pour ${input.s3Key}`);
    } catch (error) {
      this.logger.error(
        `enqueue coaching échoué pour ${input.s3Key}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Lancement manuel sur un enregistrement DÉJÀ existant (test / backfill).
   * Porte/statut résolus best-effort depuis un éventuel segment legacy.
   */
  async launch(s3Key: string): Promise<CoachingAnalysisDto> {
    if (!this.llm.isConfigured()) {
      throw new BadRequestException('vLLM non configuré (VLLM_BASE_URL / VLLM_MODEL)');
    }
    const version = await this.salesPlans.getActiveVersion();
    if (!version) throw new NotFoundException('Aucun plan de vente actif');
    const recording = await this.prisma.recording.findUnique({
      where: { s3Key },
      select: { id: true, commercialId: true, managerId: true },
    });
    if (!recording) {
      throw new NotFoundException(`Enregistrement introuvable: ${s3Key}`);
    }

    const seg = await this.prisma.recordingSegment.findFirst({
      where: { s3KeyOriginal: s3Key },
      orderBy: { id: 'desc' },
      select: { porteId: true, statut: true },
    });

    const analysis = await this.prisma.coachingAnalysis.upsert({
      where: {
        s3KeyOriginal_salesPlanVersionId: {
          s3KeyOriginal: s3Key,
          salesPlanVersionId: version.id,
        },
      },
      create: {
        recordingId: recording.id,
        porteId: seg?.porteId ?? null,
        commercialId: recording.commercialId,
        managerId: recording.managerId,
        s3KeyOriginal: s3Key,
        statutPorte: seg?.statut ?? null,
        salesPlanVersionId: version.id,
        status: CoachingStatus.PENDING,
        manual: true,
      },
      update: {
        status: CoachingStatus.PENDING,
        error: null,
        attempts: 0,
        nextRetryAt: null,
        manual: true,
      },
      select: { id: true },
    });

    // Job en PENDING → traité par le worker de file (processQueue).
    return this.getAnalysis(analysis.id);
  }

  /**
   * Lancement manuel EN LOT sur des enregistrements existants (interface de
   * gestion). Idempotent ; renvoie le nombre d'audios enfilés. Comme `launch`,
   * ces analyses ignorent le gating durée (manual = true).
   */
  async launchMany(s3Keys: string[]): Promise<number> {
    const keys = [...new Set((s3Keys ?? []).filter(Boolean))];
    let n = 0;
    for (const key of keys) {
      try {
        await this.launch(key);
        n++;
      } catch (e) {
        this.logger.warn(`launchMany: ${key} ignoré (${(e as Error).message})`);
      }
    }
    this.logger.log(`launchMany : ${n}/${keys.length} audios enfilés (manuel)`);
    return n;
  }

  /** Marque/démarque une porte (son enregistrement/coaching) comme favorite. */
  async setCoachingFavori(porteId: number, favori: boolean): Promise<boolean> {
    await this.prisma.porte.update({
      where: { id: porteId },
      data: { coachingFavori: favori },
    });
    return favori;
  }

  /** État favori d'une porte (source de vérité DB). */
  async getCoachingFavori(porteId: number): Promise<boolean> {
    const porte = await this.prisma.porte.findUnique({
      where: { id: porteId },
      select: { coachingFavori: true },
    });
    return porte?.coachingFavori ?? false;
  }

  /** Relance manuelle d'une analyse existante (admin/directeur). */
  async relaunch(id: number): Promise<CoachingAnalysisDto> {
    const analysis = await this.prisma.coachingAnalysis.findUnique({
      where: { id },
    });
    if (!analysis) throw new NotFoundException('Analyse coaching introuvable');
    await this.prisma.coachingAnalysis.update({
      where: { id },
      data: {
        status: CoachingStatus.PENDING,
        error: null,
        attempts: 0,
        nextRetryAt: null,
      },
    });
    return this.getAnalysis(id);
  }

  /**
   * Worker de file : prend les jobs PENDING dus et les traite. Résilient
   * (les jobs vivent en base) et non bloquant (traité hors requête HTTP).
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async processQueue(): Promise<void> {
    if (!this.llm.isConfigured()) return;
    try {
      // Requeue des jobs bloqués (crash pendant le traitement).
      const staleBefore = new Date(Date.now() - 15 * 60_000);
      await this.prisma.coachingAnalysis.updateMany({
        where: {
          status: { in: [CoachingStatus.TRANSCRIBING, CoachingStatus.ANALYZING] },
          updatedAt: { lt: staleBefore },
        },
        data: { status: CoachingStatus.PENDING },
      });

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
      const transcript = (stt.text ?? '').trim();
      const durationSec = stt.durationSec ?? knownDuration ?? 0;

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

      // 3. Jugement LLM
      await this.setStatus(id, CoachingStatus.ANALYZING);
      const raw = await this.llm.chatJson(
        buildSystemPrompt(),
        buildUserPrompt(plan, transcript),
      );
      const llmOut: LlmCoachingOutput = repairLlmOutput(raw);

      // 4. Scoring backend (source de vérité)
      const contractSigned =
        analysis.statutPorte === StatutPorte.CONTRAT_SIGNE;
      const scoring = this.scoring.computeScore(plan, llmOut, {
        contractSigned,
        detectedProducts: llmOut.detectedProducts,
      });

      const quality =
        q.lowConfidenceBelowSec != null &&
        durationSec < q.lowConfidenceBelowSec
          ? CoachingQuality.LOW_CONFIDENCE
          : CoachingQuality.ANALYZED;

      await this.prisma.coachingAnalysis.update({
        where: { id },
        data: {
          status: CoachingStatus.READY,
          quality,
          score: scoring.score,
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
        `Analyse ${id} READY — score=${scoring.score} qualité=${quality}`,
      );
    } catch (error) {
      await this.fail(id, (error as Error).message);
    } finally {
      this.releaseSlot();
    }
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
        this.logger.error(`Analyse ${id} FAILED (${attempts} tentatives) — ${message}`);
      }
    } catch (e) {
      this.logger.error(`fail(${id}): ${(e as Error).message}`);
    }
  }

  private asStatut(value?: string | null): StatutPorte | null {
    if (!value) return null;
    return (StatutPorte as Record<string, StatutPorte>)[value] ?? null;
  }

  // ---------------------------------------------------------------------------
  // Lecture (GraphQL)
  // ---------------------------------------------------------------------------

  async getAnalysis(id: number): Promise<CoachingAnalysisDto> {
    const row = await this.prisma.coachingAnalysis.findUnique({
      where: { id },
      include: {
        salesPlanVersion: { select: { slug: true, version: true } },
        porte: { select: { coachingFavori: true } },
      },
    });
    if (!row) throw new NotFoundException('Analyse coaching introuvable');
    return this.toDto(row);
  }

  async listAnalyses(
    filter: CoachingAnalysesFilter,
  ): Promise<{ items: CoachingAnalysisDto[]; total: number }> {
    const where = {
      ...(filter.commercialId != null
        ? { commercialId: filter.commercialId }
        : {}),
      ...(filter.managerId != null ? { managerId: filter.managerId } : {}),
      ...(filter.porteId != null ? { porteId: filter.porteId } : {}),
      ...(filter.status
        ? { status: filter.status as CoachingStatus }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.coachingAnalysis.findMany({
        where,
        include: {
          salesPlanVersion: { select: { slug: true, version: true } },
          porte: { select: { coachingFavori: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: filter.skip ?? 0,
        take: Math.min(filter.take ?? 20, 100),
      }),
      this.prisma.coachingAnalysis.count({ where }),
    ]);
    const items = rows.map((r) => this.toDto(r));
    const subjects = await this.resolveSubjects(rows);
    for (const it of items) {
      const s = subjects.get(it.id);
      it.subjectName = s?.name ?? null;
      it.subjectRole = s?.role ?? null;
      it.subjectId = s?.id ?? null;
    }
    return { items, total };
  }

  /** Analyses existantes (plan actif) pour un lot de clés S3 — évite le N+1 côté UI. */
  async byS3Keys(s3Keys: string[]): Promise<CoachingAnalysisDto[]> {
    if (!s3Keys?.length) return [];
    const version = await this.salesPlans.getActiveVersion();
    const rows = await this.prisma.coachingAnalysis.findMany({
      where: {
        s3KeyOriginal: { in: s3Keys },
        ...(version ? { salesPlanVersionId: version.id } : {}),
      },
      include: {
        salesPlanVersion: { select: { slug: true, version: true } },
        porte: { select: { coachingFavori: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  /**
   * File interrogeable : audios en attente / en cours (PENDING, TRANSCRIBING,
   * ANALYZING), avec le sujet (commercial/manager) et la durée. Prochain d'abord.
   */
  async coachingQueue(): Promise<CoachingQueueItemDto[]> {
    const rows = await this.prisma.coachingAnalysis.findMany({
      where: {
        status: {
          in: [
            CoachingStatus.PENDING,
            CoachingStatus.TRANSCRIBING,
            CoachingStatus.ANALYZING,
          ],
        },
      },
      select: {
        id: true,
        status: true,
        s3KeyOriginal: true,
        statutPorte: true,
        commercialId: true,
        managerId: true,
        transcriptDurationSec: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' }, // le prochain à passer en premier
    });
    if (!rows.length) return [];

    // Durée : agrégée depuis les segments (non stockée sur l'analyse avant transcription).
    const keys = [...new Set(rows.map((r) => r.s3KeyOriginal))];
    const durs = await this.prisma.recordingSegment.groupBy({
      by: ['s3KeyOriginal'],
      where: { s3KeyOriginal: { in: keys } },
      _max: { durationSec: true },
    });
    const durByKey = new Map<string, number | null>();
    for (const d of durs) durByKey.set(d.s3KeyOriginal, d._max.durationSec ?? null);

    const subjects = await this.resolveSubjects(rows);

    return rows.map((r) => {
      const s = subjects.get(r.id);
      return {
        id: r.id,
        status: r.status,
        s3KeyOriginal: r.s3KeyOriginal,
        subjectName: s?.name ?? null,
        subjectRole: s?.role ?? null,
        subjectId: s?.id ?? null,
        statutPorte: r.statutPorte ?? null,
        durationSec: r.transcriptDurationSec ?? durByKey.get(r.s3KeyOriginal) ?? null,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  /**
   * Résout nom/rôle/id du sujet (commercial ou manager) pour un lot de lignes,
   * en 2 requêtes batch max (pas de N+1). Clé de la map = id de l'analyse.
   */
  private async resolveSubjects(
    rows: { id: number; commercialId: number | null; managerId: number | null }[],
  ): Promise<
    Map<number, { name: string; role: 'commercial' | 'manager'; id: number }>
  > {
    const commercialIds = [
      ...new Set(
        rows.map((r) => r.commercialId).filter((x): x is number => x != null),
      ),
    ];
    const managerIds = [
      ...new Set(
        rows.map((r) => r.managerId).filter((x): x is number => x != null),
      ),
    ];
    type NameRow = { id: number; nom: string; prenom: string };
    const [commercials, managers] = await Promise.all([
      commercialIds.length
        ? this.prisma.commercial.findMany({
            where: { id: { in: commercialIds } },
            select: { id: true, nom: true, prenom: true },
          })
        : Promise.resolve([] as NameRow[]),
      managerIds.length
        ? this.prisma.manager.findMany({
            where: { id: { in: managerIds } },
            select: { id: true, nom: true, prenom: true },
          })
        : Promise.resolve([] as NameRow[]),
    ]);
    const cMap = new Map<number, string>(
      commercials.map((c) => [c.id, `${c.prenom} ${c.nom}`.trim()]),
    );
    const mMap = new Map<number, string>(
      managers.map((m) => [m.id, `${m.prenom} ${m.nom}`.trim()]),
    );

    const out = new Map<
      number,
      { name: string; role: 'commercial' | 'manager'; id: number }
    >();
    for (const r of rows) {
      if (r.commercialId != null && cMap.has(r.commercialId)) {
        out.set(r.id, {
          name: cMap.get(r.commercialId)!,
          role: 'commercial',
          id: r.commercialId,
        });
      } else if (r.managerId != null && mMap.has(r.managerId)) {
        out.set(r.id, {
          name: mMap.get(r.managerId)!,
          role: 'manager',
          id: r.managerId,
        });
      }
    }
    return out;
  }

  /**
   * Interface de gestion : enregistrements coachables (statut porte coachable +
   * propriétaire ACTIF) avec l'état d'analyse et le favori. DB-only, paginé.
   */
  async coachingManagementList(
    filter: CoachingManagementFilter,
  ): Promise<{ items: CoachingManagementItemDto[]; total: number }> {
    const coachable = await this.getCoachableStatuts();
    const allowed = (
      filter.statut && coachable.includes(filter.statut)
        ? [filter.statut]
        : coachable
    ) as StatutPorte[];
    if (!allowed.length) return { items: [], total: 0 };

    const portes = await this.prisma.porte.findMany({
      where: { statut: { in: allowed }, recordingSegments: { some: {} } },
      select: {
        id: true,
        numero: true,
        etage: true,
        statut: true,
        coachingFavori: true,
        immeuble: { select: { adresse: true } },
        recordingSegments: {
          select: {
            s3KeyOriginal: true,
            durationSec: true,
            id: true,
            commercialId: true,
            managerId: true,
          },
        },
      },
    });

    // 1 entrée par clé S3 (1 audio = 1 porte).
    type Row = {
      s3Key: string;
      porteId: number;
      statutPorte: string;
      favori: boolean;
      adresse: string | null;
      porteNumero: string;
      porteEtage: number;
      durationSec: number;
      commercialId: number | null;
      managerId: number | null;
      maxId: number;
    };
    const byKey = new Map<string, Row>();
    for (const p of portes) {
      for (const seg of p.recordingSegments) {
        const prev = byKey.get(seg.s3KeyOriginal);
        if (!prev) {
          byKey.set(seg.s3KeyOriginal, {
            s3Key: seg.s3KeyOriginal,
            porteId: p.id,
            statutPorte: p.statut,
            favori: p.coachingFavori,
            adresse: p.immeuble?.adresse ?? null,
            porteNumero: p.numero,
            porteEtage: p.etage,
            durationSec: seg.durationSec ?? 0,
            commercialId: seg.commercialId,
            managerId: seg.managerId,
            maxId: seg.id,
          });
        } else {
          if ((seg.durationSec ?? 0) > prev.durationSec)
            prev.durationSec = seg.durationSec ?? 0;
          if (seg.id > prev.maxId) prev.maxId = seg.id;
          if (prev.commercialId == null && seg.commercialId != null)
            prev.commercialId = seg.commercialId;
          if (prev.managerId == null && seg.managerId != null)
            prev.managerId = seg.managerId;
        }
      }
    }

    // Propriétaire (nom + statut) — ne garder que les ACTIF.
    const rows = [...byKey.values()];
    type OwnerRow = { id: number; nom: string; prenom: string; status: UserStatus };
    const commercialIds = [
      ...new Set(rows.map((r) => r.commercialId).filter((x): x is number => x != null)),
    ];
    const managerIds = [
      ...new Set(rows.map((r) => r.managerId).filter((x): x is number => x != null)),
    ];
    const [commercials, managers] = await Promise.all([
      commercialIds.length
        ? this.prisma.commercial.findMany({
            where: { id: { in: commercialIds } },
            select: { id: true, nom: true, prenom: true, status: true },
          })
        : Promise.resolve([] as OwnerRow[]),
      managerIds.length
        ? this.prisma.manager.findMany({
            where: { id: { in: managerIds } },
            select: { id: true, nom: true, prenom: true, status: true },
          })
        : Promise.resolve([] as OwnerRow[]),
    ]);
    const cMap = new Map(commercials.map((c) => [c.id, c]));
    const mMap = new Map(managers.map((m) => [m.id, m]));

    const withOwner = rows
      .map((r) => {
        let name: string | null = null;
        let role: 'commercial' | 'manager' | null = null;
        let sid: number | null = null;
        let active = false;
        if (r.commercialId != null && cMap.has(r.commercialId)) {
          const c = cMap.get(r.commercialId)!;
          name = `${c.prenom} ${c.nom}`.trim();
          role = 'commercial';
          sid = r.commercialId;
          active = c.status === UserStatus.ACTIF;
        } else if (r.managerId != null && mMap.has(r.managerId)) {
          const m = mMap.get(r.managerId)!;
          name = `${m.prenom} ${m.nom}`.trim();
          role = 'manager';
          sid = r.managerId;
          active = m.status === UserStatus.ACTIF;
        }
        return { ...r, subjectName: name, subjectRole: role, subjectId: sid, active };
      })
      .filter((r) => r.active);

    // Filtres favori + recherche (nom / adresse / numéro).
    let list = withOwner;
    if (filter.favorisOnly) list = list.filter((r) => r.favori);
    if (filter.search?.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          (r.subjectName ?? '').toLowerCase().includes(q) ||
          (r.adresse ?? '').toLowerCase().includes(q) ||
          (r.porteNumero ?? '').toLowerCase().includes(q),
      );
    }
    // Tri : favoris d'abord, puis récent.
    list.sort(
      (a, b) => Number(b.favori) - Number(a.favori) || b.maxId - a.maxId,
    );

    const total = list.length;
    const skip = filter.skip ?? 0;
    const take = Math.min(filter.take ?? 15, 100);
    const page = list.slice(skip, skip + take);

    // État d'analyse (plan actif) pour la page courante uniquement.
    const version = await this.salesPlans.getActiveVersion();
    const analysisByKey = new Map<
      string,
      { id: number; status: string; quality: string | null; score: number | null }
    >();
    if (version && page.length) {
      const analyses = await this.prisma.coachingAnalysis.findMany({
        where: {
          s3KeyOriginal: { in: page.map((r) => r.s3Key) },
          salesPlanVersionId: version.id,
        },
        select: { s3KeyOriginal: true, id: true, status: true, quality: true, score: true },
      });
      for (const a of analyses) {
        analysisByKey.set(a.s3KeyOriginal, {
          id: a.id,
          status: a.status,
          quality: a.quality,
          score: a.score,
        });
      }
    }

    const items = page.map((r) => {
      const a = analysisByKey.get(r.s3Key);
      return {
        s3Key: r.s3Key,
        porteId: r.porteId,
        subjectName: r.subjectName,
        subjectRole: r.subjectRole,
        subjectId: r.subjectId,
        statutPorte: r.statutPorte,
        durationSec: r.durationSec,
        adresse: r.adresse,
        porteNumero: r.porteNumero,
        porteEtage: r.porteEtage,
        favori: r.favori,
        analysisId: a?.id ?? null,
        analysisStatus: a?.status ?? null,
        quality: a?.quality ?? null,
        score: a?.score ?? null,
      };
    });
    return { items, total };
  }

  private toDto(row: any): CoachingAnalysisDto {
    return {
      id: row.id,
      recordingId: row.recordingId,
      porteId: row.porteId,
      commercialId: row.commercialId,
      managerId: row.managerId,
      s3KeyOriginal: row.s3KeyOriginal,
      statutPorte: row.statutPorte ?? null,
      status: row.status,
      quality: row.quality ?? null,
      score: row.score ?? null,
      confidence: row.confidence ?? null,
      summary: row.summary ?? null,
      strengths: (row.strengths as string[]) ?? [],
      improvements: (row.improvements as string[]) ?? [],
      recommendations: (row.recommendations as string[]) ?? [],
      subScores: (row.subScores as StepScore[]) ?? [],
      criterionResults: (row.criterionResults as CriterionScore[]) ?? [],
      transcript: row.transcript ?? null,
      transcriptDurationSec: row.transcriptDurationSec ?? null,
      error: row.error ?? null,
      planSlug: row.salesPlanVersion?.slug ?? '',
      planVersion: row.salesPlanVersion?.version ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      favori: row.porte?.coachingFavori ?? false,
      // Enrichi après coup par resolveSubjects (listAnalyses).
      subjectName: null,
      subjectRole: null,
      subjectId: null,
    };
  }
}
