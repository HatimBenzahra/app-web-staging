import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CoachingQuality, CoachingStatus, StatutPorte } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { TranscriptionService } from '../transcription/transcription.service';
import { SalesPlanService } from './sales-plan.service';
import { LlmService } from './llm.service';
import { ScoringService } from './scoring.service';
import { buildSystemPrompt, buildUserPrompt } from './prompt';
import { repairLlmOutput } from './json-repair';
import { LlmCoachingOutput } from './coaching.types';

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
    return (
      this.transcription.whisperTimeoutMs + this.llm.timeoutMs + 10 * 60_000
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
            in: [CoachingStatus.TRANSCRIBING, CoachingStatus.ANALYZING],
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

      // 3. Jugement LLM
      await this.setStatus(id, CoachingStatus.ANALYZING);
      const raw = await this.llm.chatJson(
        buildSystemPrompt(),
        buildUserPrompt(plan, transcript),
      );
      const llmOut: LlmCoachingOutput = repairLlmOutput(raw);

      // 4. Scoring backend (source de vérité)
      const contractSigned = analysis.statutPorte === StatutPorte.CONTRAT_SIGNE;
      const scoring = this.scoring.computeScore(plan, llmOut, {
        contractSigned,
        detectedProducts: llmOut.detectedProducts,
      });

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
        this.logger.error(
          `Analyse ${id} FAILED (${attempts} tentatives) — ${message}`,
        );
      }
    } catch (e) {
      this.logger.error(`fail(${id}): ${(e as Error).message}`);
    }
  }
}
