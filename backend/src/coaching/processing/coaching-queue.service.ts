import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import {
  resolveQueueConcurrency,
  resolveQueuePollMs,
  resolveStuckJobThresholdMs,
} from '../utils/coaching-env-resolvers.utils';

type QueueProcessor = (sessionId: number, jobId: number) => Promise<boolean>;

@Injectable()
export class CoachingQueueService {
  private readonly logger = new Logger(CoachingQueueService.name);
  private readonly queueConcurrency = resolveQueueConcurrency();
  private readonly queuePollMs = resolveQueuePollMs();
  private readonly stuckJobThresholdMs = resolveStuckJobThresholdMs();
  private readonly watchdogIntervalMs = 60_000;
  private queueTimer?: NodeJS.Timeout;
  private watchdogTimer?: NodeJS.Timeout;
  private runningQueueJobs = 0;
  private processor?: QueueProcessor;

  constructor(private readonly prisma: PrismaService) {}

  initialize(processor: QueueProcessor): void {
    this.processor = processor;
  }

  start(): void {
    void this.recoverInterruptedQueueJobs().finally(() => this.pumpQueue());
    this.queueTimer = setInterval(() => {
      void this.pumpQueue();
    }, this.queuePollMs);
    this.watchdogTimer = setInterval(() => {
      void this.resetStuckProcessingJobs()
        .catch((error: unknown) => {
          const msg = (error as { message?: string })?.message ?? String(error);
          this.logger.warn(`Watchdog en erreur: ${msg}`);
        })
        .finally(() => this.pumpQueue());
    }, this.watchdogIntervalMs);
  }

  stop(): void {
    if (this.queueTimer) {
      clearInterval(this.queueTimer);
    }
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
    }
  }

  triggerPump(): void {
    void this.pumpQueue();
  }

  private async recoverInterruptedQueueJobs(): Promise<void> {
    await this.prisma.coachingAnalysisJob.updateMany({
      where: {
        status: 'PROCESSING',
        coachingSession: {
          status: { in: ['COMPLETED', 'NEEDS_REVIEW'] },
        },
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        lastHeartbeatAt: new Date(),
        currentStep: 'Analyse déjà finalisée',
        failureReason: null,
      },
    });

    await this.prisma.coachingAnalysisJob.updateMany({
      where: {
        status: 'PROCESSING',
        coachingSession: {
          status: { notIn: ['COMPLETED', 'NEEDS_REVIEW'] },
        },
      },
      data: {
        status: 'QUEUED',
        startedAt: null,
        lastHeartbeatAt: null,
        currentStep: 'Repris après redémarrage du serveur',
      },
    });
  }

  private async pumpQueue(): Promise<void> {
    if (!this.processor) {
      return;
    }
    while (this.runningQueueJobs < this.queueConcurrency) {
      const job = await this.claimNextQueueJob();
      if (!job) {
        return;
      }

      this.runningQueueJobs += 1;
      void this.runQueueJob(job.id)
        .catch((error) => {
          this.logger.error(
            `Job coaching ${job.id} interrompu: ${error?.message || error}`,
          );
        })
        .finally(() => {
          this.runningQueueJobs = Math.max(0, this.runningQueueJobs - 1);
          void this.pumpQueue();
        });
    }
  }

  private async claimNextQueueJob() {
    const now = new Date();
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const candidate = await tx.coachingAnalysisJob.findFirst({
            where: {
              status: 'QUEUED',
              OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
            },
            orderBy: [{ priority: 'desc' }, { queuedAt: 'asc' }],
            select: { id: true },
          });

          if (!candidate) {
            return null;
          }

          const claim = await tx.coachingAnalysisJob.updateMany({
            where: { id: candidate.id, status: 'QUEUED' },
            data: {
              status: 'PROCESSING',
              attempts: { increment: 1 },
              startedAt: now,
              failedAt: null,
              failureReason: null,
              currentStep: 'Démarrage du pipeline',
              lastHeartbeatAt: now,
            },
          });

          if (claim.count === 0) {
            return null;
          }

          return tx.coachingAnalysisJob.findUnique({
            where: { id: candidate.id },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'P2034') {
        return null;
      }
      throw error;
    }
  }

  private async runQueueJob(jobId: number): Promise<void> {
    if (!this.processor) {
      return;
    }

    const job = await this.prisma.coachingAnalysisJob.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      return;
    }

    let success = false;
    let unhandledError: string | null = null;
    try {
      success = await this.processor(job.coachingSessionId, job.id);
    } catch (error: unknown) {
      unhandledError =
        (error as { message?: string })?.message ?? String(error);
      this.logger.error(
        `processSession a levé une exception pour le job ${job.id}: ${unhandledError}`,
      );
      success = false;
    }

    try {
      const refreshed = await this.prisma.coachingAnalysisJob.findUnique({
        where: { id: job.id },
      });
      if (!refreshed) {
        return;
      }

      if (success) {
        await this.markQueueJobCompleted(job.id);
        return;
      }

      if (refreshed.attempts < refreshed.maxAttempts) {
        await this.requeueQueueJobAfterFailure(refreshed, unhandledError);
        return;
      }

      await this.markQueueJobAndSessionAsFailed(
        refreshed.id,
        refreshed.coachingSessionId,
        unhandledError,
      );
    } catch (transitionError: unknown) {
      const msg =
        (transitionError as { message?: string })?.message ??
        String(transitionError);
      this.logger.error(
        `Transition d'état du job ${job.id} échouée: ${msg}. Le watchdog reprendra.`,
      );
    }
  }

  private async markQueueJobCompleted(jobId: number): Promise<void> {
    await this.prisma.coachingAnalysisJob.updateMany({
      where: { id: jobId, status: 'PROCESSING' },
      data: {
        status: 'COMPLETED',
        currentStep: 'Analyse terminée',
        completedAt: new Date(),
        lastHeartbeatAt: new Date(),
        failureReason: null,
      },
    });
  }

  private async requeueQueueJobAfterFailure(
    job: {
      id: number;
      attempts: number;
      maxAttempts: number;
    },
    unhandledError: string | null,
  ): Promise<void> {
    const nextRunAt = new Date(Date.now() + job.attempts * 120_000);
    await this.prisma.coachingAnalysisJob.updateMany({
      where: { id: job.id, status: 'PROCESSING' },
      data: {
        status: 'QUEUED',
        currentStep: `Nouvelle tentative prévue (${job.attempts}/${job.maxAttempts})`,
        nextRunAt,
        failedAt: new Date(),
        lastHeartbeatAt: new Date(),
        failureReason: unhandledError
          ? `Exception non gérée: ${unhandledError}. Nouvelle tentative planifiée.`
          : 'Le pipeline a échoué, une nouvelle tentative est planifiée.',
      },
    });
  }

  private async markQueueJobAndSessionAsFailed(
    jobId: number,
    sessionId: number,
    unhandledError: string | null,
  ): Promise<void> {
    const session = await this.prisma.coachingSession.findUnique({
      where: { id: sessionId },
      select: { failureReason: true, status: true },
    });

    await this.prisma.coachingAnalysisJob.updateMany({
      where: { id: jobId, status: 'PROCESSING' },
      data: {
        status: 'FAILED',
        currentStep: 'Analyse échouée',
        failedAt: new Date(),
        lastHeartbeatAt: new Date(),
        failureReason:
          session?.failureReason ??
          unhandledError ??
          'Le pipeline a échoué après toutes les tentatives.',
      },
    });

    if (!session || session.status === 'COMPLETED' || session.status === 'NEEDS_REVIEW') {
      return;
    }

    await this.prisma.coachingSession
      .update({
        where: { id: sessionId },
        data: {
          status: 'FAILED',
          failureReason:
            session.failureReason ?? unhandledError ?? 'Pipeline coaching échoué.',
        },
      })
      .catch(() => undefined);
  }

  private async resetStuckProcessingJobs(): Promise<void> {
    const staleCutoff = new Date(Date.now() - this.stuckJobThresholdMs);
    const stuck = await this.prisma.coachingAnalysisJob.findMany({
      where: {
        status: 'PROCESSING',
        OR: [
          { lastHeartbeatAt: { lt: staleCutoff } },
          { lastHeartbeatAt: null, startedAt: { lt: staleCutoff } },
        ],
      },
      select: {
        id: true,
        attempts: true,
        maxAttempts: true,
        coachingSessionId: true,
      },
    });

    if (stuck.length === 0) {
      return;
    }

    const now = new Date();
    let actuallyMoved = 0;
    for (const job of stuck) {
      if (job.attempts >= job.maxAttempts) {
        const result = await this.prisma.coachingAnalysisJob
          .updateMany({
            where: { id: job.id, status: 'PROCESSING' },
            data: {
              status: 'FAILED',
              currentStep: 'Analyse échouée (watchdog: heartbeat figé)',
              failedAt: now,
              lastHeartbeatAt: now,
              failureReason: `Job bloqué en PROCESSING sans heartbeat depuis plus de ${Math.round(this.stuckJobThresholdMs / 60000)} min. Tentatives épuisées (${job.attempts}/${job.maxAttempts}).`,
            },
          })
          .catch(() => ({ count: 0 }));
        if (result.count > 0) {
          actuallyMoved += 1;
          await this.prisma.coachingSession
            .updateMany({
              where: {
                id: job.coachingSessionId,
                status: { notIn: ['COMPLETED', 'NEEDS_REVIEW', 'FAILED'] },
              },
              data: {
                status: 'FAILED',
                failureReason: 'Pipeline coaching bloqué (watchdog).',
              },
            })
            .catch(() => undefined);
        }
      } else {
        const result = await this.prisma.coachingAnalysisJob
          .updateMany({
            where: { id: job.id, status: 'PROCESSING' },
            data: {
              status: 'QUEUED',
              currentStep: `Repris par le watchdog (heartbeat figé, tentative ${job.attempts}/${job.maxAttempts})`,
              startedAt: null,
              lastHeartbeatAt: null,
              nextRunAt: null,
            },
          })
          .catch(() => ({ count: 0 }));
        if (result.count > 0) {
          actuallyMoved += 1;
        }
      }
    }

    if (actuallyMoved > 0) {
      this.runningQueueJobs = Math.max(0, this.runningQueueJobs - actuallyMoved);
    }
  }
}
