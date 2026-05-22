import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { RecordingService } from '../../recording/recording.service';
import { isAutoAnalysisEligible, scoreRecordingExploitability } from '../domain/coaching-recording-catalog.utils';
import { isUniqueConstraintError } from '../utils/coaching-common.utils';
import {
  resolveAutoQueueSpeechMaxAttempts,
  resolveAutoQueueSpeechRetryMs,
  isAutoCoachingEnabled,
} from '../utils/coaching-env-resolvers.utils';
import {
  extractCommercialIdFromRoomName,
  extractRoomFromRecordingKey,
} from '../utils/coaching-room-key.utils';
import { CoachingAnalysisJobService } from './coaching-analysis-job.service';

const AUTO_SESSION_INCLUDE = {
  commercial: true,
  salesPlanVersion: { include: { salesPlan: true } },
  analysisJobs: { orderBy: { updatedAt: 'desc' as const }, take: 1 },
  stepEvaluations: { orderBy: { ordre: 'asc' as const } },
  conversationEvaluations: { orderBy: { ordre: 'asc' as const } },
  keyMoments: {
    orderBy: [{ importance: 'desc' as const }, { startTime: 'asc' as const }],
  },
};

@Injectable()
export class CoachingAutoQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(CoachingAutoQueueService.name);
  private readonly retryTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RecordingService))
    private readonly recordingService: RecordingService,
    private readonly jobs: CoachingAnalysisJobService,
  ) {}

  onModuleDestroy(): void {
    this.stop();
  }

  stop(): void {
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();
  }

  async autoQueueLatestPublishedAnalysisForRecording(
    s3KeyOriginal: string,
  ): Promise<void> {
    return this.attemptAutoQueue(s3KeyOriginal, 0);
  }

  private async attemptAutoQueue(
    s3KeyOriginal: string,
    attempt: number,
  ): Promise<void> {
    if (!isAutoCoachingEnabled()) {
      return;
    }

    const speechScore = this.recordingService.getSpeechScores([
      s3KeyOriginal,
    ])[0];

    if (speechScore?.status !== 'ready') {
      this.retryOrLogSpeechUnavailable(s3KeyOriginal, attempt);
      return;
    }

    const exploitability = scoreRecordingExploitability({
      item: { lastModified: new Date(), size: undefined },
      speechScore,
      latestSessionStatus: null,
    });

    if (!isAutoAnalysisEligible(exploitability.status)) {
      this.logger.log(
        `Auto-coaching ignoré pour ${s3KeyOriginal}: ${exploitability.reasons.join(' | ')}`,
      );
      return;
    }

    const publishedVersion = await this.findLatestPublishedVersion();
    if (!publishedVersion) {
      this.logger.log(
        `Auto-coaching ignoré pour ${s3KeyOriginal}: aucun plan publié.`,
      );
      return;
    }

    const roomName = extractRoomFromRecordingKey(s3KeyOriginal);
    const commercialId = extractCommercialIdFromRoomName(roomName);
    if (!commercialId) {
      this.logger.log(
        `Auto-coaching ignoré pour ${s3KeyOriginal}: commercial non identifiable.`,
      );
      return;
    }

    const commercial = await this.prisma.commercial.findUnique({
      where: { id: commercialId },
      select: { id: true, directeurId: true },
    });
    if (!commercial) {
      this.logger.warn(
        `Auto-coaching ignoré pour ${s3KeyOriginal}: commercial ${commercialId} introuvable.`,
      );
      return;
    }

    const session = await this.findOrCreateSession({
      s3KeyOriginal,
      salesPlanVersionId: publishedVersion.id,
      roomName,
      commercial,
    });
    if (!session || session.status === 'COMPLETED') {
      this.logAlreadyCompleted(s3KeyOriginal, session?.status);
      return;
    }

    await this.jobs.enqueueAnalysisJob(
      session.id,
      { id: 0, role: 'system:auto' },
      exploitability.status === 'PRIORITY' ? 55 : 40,
    );

    this.logger.log(
      `Auto-coaching en file pour ${s3KeyOriginal} sur le plan ${publishedVersion.id}.`,
    );
  }

  private retryOrLogSpeechUnavailable(
    s3KeyOriginal: string,
    attempt: number,
  ): void {
    if (attempt < resolveAutoQueueSpeechMaxAttempts()) {
      this.scheduleRetry(s3KeyOriginal, attempt + 1);
      return;
    }

    this.logger.log(
      `Auto-coaching différé puis ignoré pour ${s3KeyOriginal}: score parole indisponible.`,
    );
  }

  private scheduleRetry(s3KeyOriginal: string, attempt: number): void {
    const existing = this.retryTimers.get(s3KeyOriginal);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.retryTimers.delete(s3KeyOriginal);
      void this.attemptAutoQueue(s3KeyOriginal, attempt).catch((error) => {
        this.logger.warn(
          `Auto-coaching retry ignoré pour ${s3KeyOriginal}: ${error?.message || error}`,
        );
      });
    }, resolveAutoQueueSpeechRetryMs());

    this.retryTimers.set(s3KeyOriginal, timer);
  }

  private findLatestPublishedVersion() {
    return this.prisma.salesPlanVersion.findFirst({
      where: { status: 'PUBLISHED' },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      include: { salesPlan: true },
    });
  }

  private async findOrCreateSession(input: {
    s3KeyOriginal: string;
    salesPlanVersionId: number;
    roomName: string | null;
    commercial: { id: number; directeurId: number | null };
  }) {
    const existing = await this.findByRecordingPlan(
      input.s3KeyOriginal,
      input.salesPlanVersionId,
    );
    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.coachingSession.create({
        data: {
          salesPlanVersionId: input.salesPlanVersionId,
          s3KeyOriginal: input.s3KeyOriginal,
          roomName: input.roomName,
          commercialId: input.commercial.id,
          directeurId: input.commercial.directeurId ?? null,
          status: 'PENDING',
          reviewStatus: 'NOT_REQUIRED',
          createdByRole: 'system:auto',
          createdByUserId: 0,
        },
        include: AUTO_SESSION_INCLUDE,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      return this.findByRecordingPlan(
        input.s3KeyOriginal,
        input.salesPlanVersionId,
      );
    }
  }

  private findByRecordingPlan(
    s3KeyOriginal: string,
    salesPlanVersionId: number,
  ) {
    return this.prisma.coachingSession.findUnique({
      where: {
        s3KeyOriginal_salesPlanVersionId: {
          s3KeyOriginal,
          salesPlanVersionId,
        },
      },
      include: AUTO_SESSION_INCLUDE,
    });
  }

  private logAlreadyCompleted(
    s3KeyOriginal: string,
    status: string | undefined,
  ): void {
    if (status === 'COMPLETED') {
      this.logger.log(
        `Auto-coaching ignoré pour ${s3KeyOriginal}: analyse déjà terminée.`,
      );
    }
  }
}
