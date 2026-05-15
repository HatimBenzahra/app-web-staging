import {
  ForbiddenException,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RecordingService } from '../recording/recording.service';
import { TranscriptionService } from '../transcription/transcription.service';
import {
  CoachingRecordingCandidatesInput,
  CoachingRecordingCandidatesPageDto,
  CoachingAnalysisJobDto,
  CoachingAnalysisQueueInput,
  CoachingQueueStateDto,
  CoachingReviewActionDto,
  CoachingSessionDto,
  CoachingSessionsInput,
  CoachingSessionsPageDto,
  CreateSalesPlanInput,
  CreateSalesPlanVersionInput,
  LaunchCoachingAnalysisInput,
  ReviewCoachingSessionInput,
  SalesPlanDto,
} from './coaching.dto';
import { CoachingRecordingCatalogService } from './coaching-recording-catalog.service';
import {
  isAutoAnalysisEligible,
  scoreRecordingExploitability,
} from './coaching-recording-catalog.utils';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type CurrentUser = {
  id: number;
  role: string;
};

type StepEvaluationPayload = {
  ordre: number;
  titre: string;
  coverageStatus: 'COVERED' | 'PARTIAL' | 'MISSING';
  score?: number | null;
  startTime?: number | null;
  endTime?: number | null;
  verbatim?: string | null;
  feedback?: string | null;
  recommendation?: string | null;
};

type KeyMomentPayload = {
  type: string;
  title: string;
  summary?: string | null;
  startTime?: number | null;
  endTime?: number | null;
  verbatim?: string | null;
  importance?: number | null;
};

type SessionEvaluationPayload = {
  overallScore?: number | null;
  planCoverageScore?: number | null;
  executionQualityScore?: number | null;
  objectionHandlingScore?: number | null;
  listeningRatioScore?: number | null;
  closingScore?: number | null;
  summary?: string | null;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  keyMoments: KeyMomentPayload[];
  stepEvaluations: StepEvaluationPayload[];
  rawResponse?: string | null;
  usedFallback?: boolean;
};

type CoachingTranscriptPayload = {
  segments: Array<{ start: number; end: number; text: string }>;
  duration: number;
  source: 'WHISPER_FULL_RECORDING' | 'RECORDING_SEGMENTS';
};

type CoachingConversationBlock = {
  ordre: number;
  title: string;
  startTime: number;
  endTime: number;
  transcriptText: string;
  readableTranscriptText?: string | null;
  segmentsCount: number;
  status: 'COMPLETED' | 'NEEDS_REVIEW' | 'SKIPPED' | 'FAILED';
  reviewReason?: string | null;
};

@Injectable()
export class CoachingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CoachingService.name);
  private readonly prefix = process.env.S3_PREFIX || 'recordings/';
  private readonly bucket = process.env.S3_BUCKET_NAME!;
  private readonly region = process.env.AWS_REGION || 'eu-west-3';
  private readonly vllmBaseUrl = process.env.VLLM_BASE_URL;
  private readonly vllmApiKey = process.env.VLLM_API_KEY;
  private readonly vllmModel = process.env.VLLM_MODEL;
  private readonly vllmTimeoutMs = this.resolveVllmTimeoutMs();
  private readonly maxTranscriptPromptChars =
    this.resolveMaxTranscriptPromptChars();
  private readonly queueConcurrency = this.resolveQueueConcurrency();
  private readonly queuePollMs = this.resolveQueuePollMs();
  private queueTimer?: NodeJS.Timeout;
  private runningQueueJobs = 0;
  private readonly autoQueueRetryTimers = new Map<string, NodeJS.Timeout>();

  private readonly s3 = new S3Client({
    region: this.region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RecordingService))
    private readonly recordingService: RecordingService,
    private readonly recordingCatalogService: CoachingRecordingCatalogService,
    private readonly transcriptionService: TranscriptionService,
  ) {}

  onModuleInit(): void {
    void this.recoverInterruptedQueueJobs().finally(() => this.pumpQueue());
    this.queueTimer = setInterval(() => {
      void this.pumpQueue();
    }, this.queuePollMs);
  }

  onModuleDestroy(): void {
    if (this.queueTimer) {
      clearInterval(this.queueTimer);
    }
    for (const timer of this.autoQueueRetryTimers.values()) {
      clearTimeout(timer);
    }
    this.autoQueueRetryTimers.clear();
  }

  async getSalesPlans(currentUser: CurrentUser): Promise<SalesPlanDto[]> {
    this.assertAdminOrDirecteur(currentUser);

    const plans = await this.prisma.salesPlan.findMany({
      where: {},
      include: {
        versions: {
          include: {
            steps: {
              orderBy: { ordre: 'asc' },
            },
          },
          orderBy: { versionNumber: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return plans as SalesPlanDto[];
  }

  async createSalesPlan(
    input: CreateSalesPlanInput,
    currentUser: CurrentUser,
  ): Promise<SalesPlanDto> {
    this.assertAdminOrDirecteur(currentUser);

    const steps = this.normalizeSteps(input.steps);
    const publishNow = Boolean(input.publishNow);

    const plan = await this.prisma.salesPlan.create({
      data: {
        nom: input.nom.trim(),
        description: this.cleanOptionalText(input.description),
        createdByRole: currentUser.role,
        createdByUserId: currentUser.id,
        versions: {
          create: {
            versionNumber: 1,
            label: this.cleanOptionalText(input.versionLabel) || 'Version 1',
            status: publishNow ? 'PUBLISHED' : 'DRAFT',
            promptInstructions: this.cleanOptionalText(
              input.promptInstructions,
            ),
            createdByRole: currentUser.role,
            createdByUserId: currentUser.id,
            publishedAt: publishNow ? new Date() : null,
            steps: {
              create: steps.map((step) => ({
                ordre: step.ordre,
                titre: step.titre,
                description: step.description,
                expectedSignals: step.expectedSignals,
                poids: step.poids,
              })),
            },
          },
        },
      },
      include: {
        versions: {
          include: {
            steps: {
              orderBy: { ordre: 'asc' },
            },
          },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    return plan as SalesPlanDto;
  }

  async createSalesPlanVersion(
    input: CreateSalesPlanVersionInput,
    currentUser: CurrentUser,
  ): Promise<SalesPlanDto> {
    this.assertAdminOrDirecteur(currentUser);

    const plan = await this.prisma.salesPlan.findUnique({
      where: { id: input.salesPlanId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan de vente introuvable');
    }

    this.assertSharedPlanAccess(currentUser);

    const nextVersion = (plan.versions[0]?.versionNumber || 0) + 1;
    const steps = this.normalizeSteps(input.steps);
    const publishNow = Boolean(input.publishNow);

    await this.prisma.$transaction(async (tx) => {
      if (publishNow) {
        await tx.salesPlanVersion.updateMany({
          where: {
            salesPlanId: plan.id,
            status: 'PUBLISHED',
          },
          data: {
            status: 'ARCHIVED',
          },
        });
      }

      await tx.salesPlanVersion.create({
        data: {
          salesPlanId: plan.id,
          versionNumber: nextVersion,
          label:
            this.cleanOptionalText(input.label) || `Version ${nextVersion}`,
          status: publishNow ? 'PUBLISHED' : 'DRAFT',
          promptInstructions: this.cleanOptionalText(input.promptInstructions),
          createdByRole: currentUser.role,
          createdByUserId: currentUser.id,
          publishedAt: publishNow ? new Date() : null,
          steps: {
            create: steps.map((step) => ({
              ordre: step.ordre,
              titre: step.titre,
              description: step.description,
              expectedSignals: step.expectedSignals,
              poids: step.poids,
            })),
          },
        },
      });
    });

    const refreshed = await this.prisma.salesPlan.findUnique({
      where: { id: plan.id },
      include: {
        versions: {
          include: {
            steps: {
              orderBy: { ordre: 'asc' },
            },
          },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    return refreshed as SalesPlanDto;
  }

  async publishSalesPlanVersion(
    versionId: number,
    currentUser: CurrentUser,
  ): Promise<SalesPlanDto> {
    this.assertAdminOrDirecteur(currentUser);

    const version = await this.prisma.salesPlanVersion.findUnique({
      where: { id: versionId },
      include: {
        salesPlan: true,
      },
    });

    if (!version) {
      throw new NotFoundException('Version de plan introuvable');
    }

    this.assertSharedPlanAccess(currentUser);

    await this.prisma.$transaction(async (tx) => {
      await tx.salesPlanVersion.updateMany({
        where: {
          salesPlanId: version.salesPlanId,
          status: 'PUBLISHED',
        },
        data: {
          status: 'ARCHIVED',
        },
      });

      await tx.salesPlanVersion.update({
        where: { id: versionId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
    });

    const plan = await this.prisma.salesPlan.findUnique({
      where: { id: version.salesPlanId },
      include: {
        versions: {
          include: {
            steps: {
              orderBy: { ordre: 'asc' },
            },
          },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    return plan as SalesPlanDto;
  }

  async getRecordingCandidates(
    input: CoachingRecordingCandidatesInput | undefined,
    currentUser: CurrentUser,
  ): Promise<CoachingRecordingCandidatesPageDto> {
    return this.recordingCatalogService.getRecordingCandidates(
      input,
      currentUser,
    );
  }

  async getCoachingSessions(
    input: CoachingSessionsInput | undefined,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionsPageDto> {
    this.assertAdminOrDirecteur(currentUser);

    const limit = Math.min(Math.max(input?.limit ?? 20, 1), 100);
    const offset = Math.max(input?.offset ?? 0, 0);
    const where = this.buildCoachingSessionsWhere(input, currentUser);

    const [sessions, total] = await Promise.all([
      this.prisma.coachingSession.findMany({
        where,
        include: {
          commercial: true,
          salesPlanVersion: {
            include: {
              salesPlan: true,
            },
          },
          analysisJobs: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.coachingSession.count({ where }),
    ]);

    return {
      items: sessions.map((session) => this.mapSession(session)),
      total,
      limit,
      offset,
    };
  }

  private buildCoachingSessionsWhere(
    input: CoachingSessionsInput | undefined,
    currentUser: CurrentUser,
  ): Record<string, any> {
    const andConditions: Record<string, any>[] = [];

    if (currentUser.role !== 'admin') {
      andConditions.push({
        OR: [
          { directeurId: currentUser.id },
          {
            commercial: {
              directeurId: currentUser.id,
            },
          },
        ],
      });
    }

    const search = input?.search?.trim();
    if (search) {
      const numericSearch = Number(search.replace(/^#/, ''));
      const searchConditions: Record<string, any>[] = [
        { commercialNom: { contains: search, mode: 'insensitive' } },
        { roomName: { contains: search, mode: 'insensitive' } },
        { s3KeyOriginal: { contains: search, mode: 'insensitive' } },
        {
          salesPlanVersion: {
            salesPlan: {
              nom: { contains: search, mode: 'insensitive' },
            },
          },
        },
      ];

      if (Number.isInteger(numericSearch) && numericSearch > 0) {
        searchConditions.push({ id: numericSearch });
      }

      andConditions.push({ OR: searchConditions });
    }

    if (input?.status && input.status !== 'ALL') {
      if (input.status === 'ACTIVE') {
        andConditions.push({
          status: { in: ['PENDING', 'PROCESSING'] },
        });
      } else {
        andConditions.push({ status: input.status });
      }
    }

    if (input?.reviewStatus) {
      andConditions.push({ reviewStatus: input.reviewStatus });
    }

    if (input?.scoreLevel && input.scoreLevel !== 'ALL') {
      if (input.scoreLevel === 'HIGH') {
        andConditions.push({ overallScore: { gte: 80 } });
      } else if (input.scoreLevel === 'MEDIUM') {
        andConditions.push({
          overallScore: {
            gte: 50,
            lt: 80,
          },
        });
      } else if (input.scoreLevel === 'LOW') {
        andConditions.push({
          OR: [{ overallScore: { lt: 50 } }, { overallScore: null }],
        });
      }
    }

    return andConditions.length > 0 ? { AND: andConditions } : {};
  }

  async getAnalysisQueue(
    input: CoachingAnalysisQueueInput | undefined,
    currentUser: CurrentUser,
  ): Promise<CoachingQueueStateDto> {
    this.assertAdminOrDirecteur(currentUser);
    const limit = Math.min(Math.max(input?.limit ?? 20, 1), 100);
    const offset = Math.max(input?.offset ?? 0, 0);

    const sessionWhere =
      currentUser.role === 'admin'
        ? {}
        : {
            OR: [
              { directeurId: currentUser.id },
              {
                commercial: {
                  directeurId: currentUser.id,
                },
              },
            ],
          };

    const [jobs, grouped, total] = await Promise.all([
      this.prisma.coachingAnalysisJob.findMany({
        where: {
          coachingSession: sessionWhere,
        },
        orderBy: [{ status: 'asc' }, { priority: 'desc' }, { queuedAt: 'asc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.coachingAnalysisJob.groupBy({
        by: ['status'],
        where: {
          coachingSession: sessionWhere,
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.coachingAnalysisJob.count({
        where: {
          coachingSession: sessionWhere,
        },
      }),
    ]);

    const counts = new Map(
      grouped.map((entry) => [entry.status, entry._count._all]),
    );
    const oldestQueued = jobs
      .filter((job) => job.status === 'QUEUED')
      .sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime())[0];

    return {
      summary: {
        queued: counts.get('QUEUED') ?? 0,
        processing: counts.get('PROCESSING') ?? 0,
        completed: counts.get('COMPLETED') ?? 0,
        failed: counts.get('FAILED') ?? 0,
        cancelled: counts.get('CANCELLED') ?? 0,
        concurrency: this.queueConcurrency,
        oldestQueuedAgeSeconds: oldestQueued
          ? this.secondsSince(oldestQueued.queuedAt)
          : undefined,
      },
      jobs: jobs.map((job) => this.mapAnalysisJob(job)),
      total,
      limit,
      offset,
    };
  }

  async getCoachingSession(
    id: number,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    this.assertAdminOrDirecteur(currentUser);

    const session = await this.prisma.coachingSession.findUnique({
      where: { id },
      include: {
        commercial: true,
        salesPlanVersion: {
          include: {
            salesPlan: true,
            steps: {
              orderBy: { ordre: 'asc' },
            },
          },
        },
        analysisJobs: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
        stepEvaluations: {
          orderBy: { ordre: 'asc' },
        },
        conversationEvaluations: {
          orderBy: { ordre: 'asc' },
        },
        keyMoments: {
          orderBy: [{ importance: 'desc' }, { startTime: 'asc' }],
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session coaching introuvable');
    }

    await this.assertSessionAccess(session, currentUser);

    let audioUrl: string | undefined;
    try {
      audioUrl =
        (await this.recordingService.getStreamingUrl(
          session.s3KeyOriginal,
          currentUser,
        )) || undefined;
    } catch (error) {
      this.logger.warn(
        `Impossible de signer l'audio de la session ${session.id}: ${error?.message || error}`,
      );
    }

    return this.mapSession(session, audioUrl);
  }

  async launchCoachingAnalysis(
    input: LaunchCoachingAnalysisInput,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    this.assertAdminOrDirecteur(currentUser);

    const version = await this.prisma.salesPlanVersion.findUnique({
      where: { id: input.salesPlanVersionId },
      include: {
        salesPlan: true,
        steps: {
          orderBy: { ordre: 'asc' },
        },
      },
    });

    if (!version) {
      throw new NotFoundException('Version de plan introuvable');
    }

    this.assertSharedPlanAccess(currentUser);
    if (version.status !== 'PUBLISHED') {
      throw new ForbiddenException(
        'Seule une version publiée peut être utilisée pour une analyse coaching',
      );
    }

    const roomName = this.extractRoomFromKey(input.s3KeyOriginal);
    const commercialId = this.extractCommercialIdFromRoomName(roomName);
    const commercial = commercialId
      ? await this.prisma.commercial.findUnique({
          where: { id: commercialId },
          select: {
            id: true,
            directeurId: true,
          },
        })
      : null;

    if (currentUser.role === 'directeur') {
      if (!commercial || commercial.directeurId !== currentUser.id) {
        throw new ForbiddenException(
          'Vous ne pouvez analyser que les enregistrements de votre équipe',
        );
      }
    }

    const existingSession = await this.findCoachingSessionByRecordingPlan(
      input.s3KeyOriginal,
      version.id,
    );
    if (existingSession) {
      if (['PENDING', 'FAILED'].includes(existingSession.status)) {
        await this.enqueueAnalysisJob(existingSession.id, currentUser, 50);
        const queuedExistingSession =
          await this.findCoachingSessionByRecordingPlan(
            input.s3KeyOriginal,
            version.id,
          );
        return this.mapSession(queuedExistingSession ?? existingSession);
      }
      return this.mapSession(existingSession);
    }

    let session: Awaited<
      ReturnType<typeof this.findCoachingSessionByRecordingPlan>
    >;
    try {
      session = await this.prisma.coachingSession.create({
        data: {
          salesPlanVersionId: version.id,
          s3KeyOriginal: input.s3KeyOriginal,
          roomName: roomName ?? null,
          commercialId: commercial?.id ?? null,
          directeurId: commercial?.directeurId ?? null,
          status: 'PENDING',
          reviewStatus: 'NOT_REQUIRED',
          createdByRole: currentUser.role,
          createdByUserId: currentUser.id,
        },
        include: {
          commercial: true,
          salesPlanVersion: {
            include: {
              salesPlan: true,
            },
          },
          analysisJobs: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
          stepEvaluations: {
            orderBy: { ordre: 'asc' },
          },
          conversationEvaluations: {
            orderBy: { ordre: 'asc' },
          },
          keyMoments: {
            orderBy: [{ importance: 'desc' }, { startTime: 'asc' }],
          },
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        session = await this.findCoachingSessionByRecordingPlan(
          input.s3KeyOriginal,
          version.id,
        );
        if (session) {
          return this.mapSession(session);
        }
      }
      throw error;
    }

    await this.enqueueAnalysisJob(session!.id, currentUser, 50);

    const queuedSession = await this.prisma.coachingSession.findUnique({
      where: { id: session!.id },
      include: {
        commercial: true,
        salesPlanVersion: {
          include: {
            salesPlan: true,
          },
        },
        analysisJobs: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
        stepEvaluations: {
          orderBy: { ordre: 'asc' },
        },
        conversationEvaluations: {
          orderBy: { ordre: 'asc' },
        },
        keyMoments: {
          orderBy: [{ importance: 'desc' }, { startTime: 'asc' }],
        },
      },
    });

    return this.mapSession(queuedSession ?? session!);
  }

  async relaunchCoachingAnalysis(
    id: number,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    const session = await this.prisma.coachingSession.findUnique({
      where: { id },
      include: {
        commercial: true,
        salesPlanVersion: {
          include: {
            salesPlan: true,
          },
        },
        stepEvaluations: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session coaching introuvable');
    }

    await this.assertSessionAccess(session, currentUser);

    await this.prisma.$transaction(async (tx) => {
      await tx.coachingStepEvaluation.deleteMany({
        where: { coachingSessionId: session.id },
      });
      await tx.coachingConversationEvaluation.deleteMany({
        where: { coachingSessionId: session.id },
      });
      await tx.coachingKeyMoment.deleteMany({
        where: { coachingSessionId: session.id },
      });

      await tx.coachingSession.update({
        where: { id: session.id },
        data: {
          status: 'PENDING',
          reviewStatus: 'NOT_REQUIRED',
          confidenceScore: null,
          identificationSource: null,
          transcriptText: null,
          readableTranscriptText: null,
          transcriptDurationSec: null,
          whisperSegmentsCount: null,
          overallScore: null,
          planCoverageScore: null,
          executionQualityScore: null,
          objectionHandlingScore: null,
          listeningRatioScore: null,
          closingScore: null,
          summary: null,
          strengths: [],
          improvements: [],
          recommendations: [],
          llmRawResponse: null,
          failureReason: null,
          reviewReason: null,
          reviewNotes: null,
          processedAt: null,
        },
      });
    });

    await this.enqueueAnalysisJob(session.id, currentUser, 80);

    const refreshed = await this.prisma.coachingSession.findUnique({
      where: { id: session.id },
      include: {
        commercial: true,
        salesPlanVersion: {
          include: {
            salesPlan: true,
          },
        },
        analysisJobs: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
        stepEvaluations: true,
        conversationEvaluations: {
          orderBy: { ordre: 'asc' },
        },
        keyMoments: {
          orderBy: [{ importance: 'desc' }, { startTime: 'asc' }],
        },
      },
    });

    return this.mapSession(refreshed);
  }

  async reviewCoachingSession(
    input: ReviewCoachingSessionInput,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    this.assertAdminOrDirecteur(currentUser);

    const session = await this.prisma.coachingSession.findUnique({
      where: { id: input.sessionId },
      include: {
        commercial: true,
        salesPlanVersion: {
          include: {
            salesPlan: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session coaching introuvable');
    }

    await this.assertSessionAccess(session, currentUser);

    const updateData: Record<string, any> = {
      reviewNotes: this.cleanOptionalText(input.reviewNotes) ?? null,
    };

    if (input.action === CoachingReviewActionDto.APPROVE) {
      updateData.reviewStatus = 'VALIDATED';
      updateData.status = 'COMPLETED';
      updateData.reviewReason = null;
    } else {
      updateData.reviewStatus = 'REJECTED';
      updateData.status = 'NEEDS_REVIEW';
      if (!updateData.reviewNotes) {
        updateData.reviewNotes = 'Analyse rejetée lors de la revue humaine.';
      }
    }

    if (input.commercialId) {
      const commercial = await this.prisma.commercial.findUnique({
        where: { id: input.commercialId },
        select: {
          id: true,
          directeurId: true,
        },
      });

      if (!commercial) {
        throw new NotFoundException('Commercial introuvable');
      }

      if (
        currentUser.role === 'directeur' &&
        commercial.directeurId !== currentUser.id
      ) {
        throw new ForbiddenException(
          'Vous ne pouvez sélectionner qu’un commercial de votre équipe',
        );
      }

      updateData.commercialId = commercial.id;
      updateData.directeurId = commercial.directeurId ?? session.directeurId;
      updateData.confidenceScore = 1;
      updateData.identificationSource = 'HUMAN_REVIEW';
    }

    const updated = await this.prisma.coachingSession.update({
      where: { id: session.id },
      data: updateData,
      include: {
        commercial: true,
        salesPlanVersion: {
          include: {
            salesPlan: true,
          },
        },
        analysisJobs: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
        stepEvaluations: {
          orderBy: { ordre: 'asc' },
        },
        conversationEvaluations: {
          orderBy: { ordre: 'asc' },
        },
        keyMoments: {
          orderBy: [{ importance: 'desc' }, { startTime: 'asc' }],
        },
      },
    });

    return this.mapSession(updated);
  }

  async autoQueueLatestPublishedAnalysisForRecording(
    s3KeyOriginal: string,
  ): Promise<void> {
    return this.autoQueueLatestPublishedAnalysisForRecordingAttempt(
      s3KeyOriginal,
      0,
    );
  }

  private async autoQueueLatestPublishedAnalysisForRecordingAttempt(
    s3KeyOriginal: string,
    attempt: number,
  ): Promise<void> {
    if (!this.isAutoCoachingEnabled()) {
      return;
    }

    const speechScore = this.recordingService.getSpeechScores([
      s3KeyOriginal,
    ])[0];

    if (speechScore?.status !== 'ready') {
      if (attempt < this.resolveAutoQueueSpeechMaxAttempts()) {
        this.scheduleAutoQueueRetry(s3KeyOriginal, attempt + 1);
      } else {
        this.logger.log(
          `Auto-coaching différé puis ignoré pour ${s3KeyOriginal}: score parole indisponible.`,
        );
      }
      return;
    }

    const exploitability = scoreRecordingExploitability({
      item: {
        lastModified: new Date(),
        size: undefined,
      },
      speechScore,
      latestSessionStatus: null,
    });

    if (!isAutoAnalysisEligible(exploitability.status)) {
      this.logger.log(
        `Auto-coaching ignoré pour ${s3KeyOriginal}: ${exploitability.reasons.join(' | ')}`,
      );
      return;
    }

    const publishedVersion = await this.prisma.salesPlanVersion.findFirst({
      where: {
        status: 'PUBLISHED',
      },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      include: {
        salesPlan: true,
      },
    });

    if (!publishedVersion) {
      this.logger.log(
        `Auto-coaching ignoré pour ${s3KeyOriginal}: aucun plan publié.`,
      );
      return;
    }

    const roomName = this.extractRoomFromKey(s3KeyOriginal);
    const commercialId = this.extractCommercialIdFromRoomName(roomName);

    if (!commercialId) {
      this.logger.log(
        `Auto-coaching ignoré pour ${s3KeyOriginal}: commercial non identifiable.`,
      );
      return;
    }

    const commercial = await this.prisma.commercial.findUnique({
      where: { id: commercialId },
      select: {
        id: true,
        directeurId: true,
      },
    });

    if (!commercial) {
      this.logger.warn(
        `Auto-coaching ignoré pour ${s3KeyOriginal}: commercial ${commercialId} introuvable.`,
      );
      return;
    }

    let session = await this.findCoachingSessionByRecordingPlan(
      s3KeyOriginal,
      publishedVersion.id,
    );

    if (!session) {
      try {
        session = await this.prisma.coachingSession.create({
          data: {
            salesPlanVersionId: publishedVersion.id,
            s3KeyOriginal,
            roomName: roomName ?? null,
            commercialId: commercial.id,
            directeurId: commercial.directeurId ?? null,
            status: 'PENDING',
            reviewStatus: 'NOT_REQUIRED',
            createdByRole: 'system:auto',
            createdByUserId: 0,
          },
          include: {
            commercial: true,
            salesPlanVersion: {
              include: {
                salesPlan: true,
              },
            },
            analysisJobs: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
            stepEvaluations: {
              orderBy: { ordre: 'asc' },
            },
            conversationEvaluations: {
              orderBy: { ordre: 'asc' },
            },
            keyMoments: {
              orderBy: [{ importance: 'desc' }, { startTime: 'asc' }],
            },
          },
        });
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          session = await this.findCoachingSessionByRecordingPlan(
            s3KeyOriginal,
            publishedVersion.id,
          );
        } else {
          throw error;
        }
      }
    }

    if (!session) {
      return;
    }

    if (session.status === 'COMPLETED') {
      this.logger.log(
        `Auto-coaching ignoré pour ${s3KeyOriginal}: analyse déjà terminée.`,
      );
      return;
    }

    await this.enqueueAnalysisJob(
      session.id,
      { id: 0, role: 'system:auto' },
      exploitability.status === 'PRIORITY' ? 55 : 40,
    );

    this.logger.log(
      `Auto-coaching en file pour ${s3KeyOriginal} sur le plan ${publishedVersion.id}.`,
    );
  }

  private scheduleAutoQueueRetry(s3KeyOriginal: string, attempt: number): void {
    const existing = this.autoQueueRetryTimers.get(s3KeyOriginal);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.autoQueueRetryTimers.delete(s3KeyOriginal);
      void this.autoQueueLatestPublishedAnalysisForRecordingAttempt(
        s3KeyOriginal,
        attempt,
      ).catch((error) => {
        this.logger.warn(
          `Auto-coaching retry ignoré pour ${s3KeyOriginal}: ${error?.message || error}`,
        );
      });
    }, this.resolveAutoQueueSpeechRetryMs());

    this.autoQueueRetryTimers.set(s3KeyOriginal, timer);
  }

  private async findCoachingSessionByRecordingPlan(
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
      include: {
        commercial: true,
        salesPlanVersion: {
          include: {
            salesPlan: true,
          },
        },
        analysisJobs: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
        stepEvaluations: {
          orderBy: { ordre: 'asc' },
        },
        conversationEvaluations: {
          orderBy: { ordre: 'asc' },
        },
        keyMoments: {
          orderBy: [{ importance: 'desc' }, { startTime: 'asc' }],
        },
      },
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return Boolean(
      error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002',
    );
  }

  private assertAdminOrDirecteur(currentUser: CurrentUser): void {
    if (currentUser.role !== 'admin' && currentUser.role !== 'directeur') {
      throw new ForbiddenException('Accès réservé admin/directeur');
    }
  }

  private cleanOptionalText(value?: string | null): string | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeSteps(steps: CreateSalesPlanInput['steps']) {
    const normalized = steps
      .map((step, index) => ({
        ordre: step.ordre ?? index + 1,
        titre: step.titre.trim(),
        description: this.cleanOptionalText(step.description),
        expectedSignals: this.cleanOptionalText(step.expectedSignals),
        poids: this.normalizeWeight(step.poids),
      }))
      .filter((step) => step.titre.length > 0);

    if (normalized.length === 0) {
      throw new ForbiddenException(
        'Le plan de vente doit contenir au moins une étape nommée',
      );
    }

    return normalized.map((step, index) => ({
      ...step,
      ordre: index + 1,
    }));
  }

  private assertSharedPlanAccess(currentUser: CurrentUser): void {
    this.assertAdminOrDirecteur(currentUser);
  }

  private normalizeWeight(value?: number | null): number {
    const numeric = Number(value ?? 20);
    if (!Number.isFinite(numeric)) {
      return 20;
    }
    return Math.max(1, Math.min(100, Math.round(numeric)));
  }

  private async assertSessionAccess(
    session: {
      directeurId: number | null;
      commercial?: { directeurId: number | null } | null;
    },
    currentUser: CurrentUser,
  ): Promise<void> {
    this.assertAdminOrDirecteur(currentUser);
    if (currentUser.role === 'admin') {
      return;
    }

    const directeurId = session.directeurId ?? session.commercial?.directeurId;
    if (directeurId !== currentUser.id) {
      throw new ForbiddenException('Accès refusé à cette session coaching');
    }
  }

  private extractRoomFromKey(key: string): string | null {
    if (!key.startsWith(this.prefix)) {
      return null;
    }
    const remainder = key.slice(this.prefix.length);
    const [safeRoom] = remainder.split('/');
    if (!safeRoom) {
      return null;
    }
    return safeRoom.replace(/_/g, ':');
  }

  private extractCommercialIdFromRoomName(
    roomName?: string | null,
  ): number | null {
    if (!roomName) {
      return null;
    }
    const parts = roomName.split(':');
    if (parts.length !== 3) {
      return null;
    }
    if (parts[1]?.toUpperCase() !== 'COMMERCIAL') {
      return null;
    }
    const commercialId = Number(parts[2]);
    return Number.isFinite(commercialId) ? commercialId : null;
  }

  private async enqueueAnalysisJob(
    sessionId: number,
    currentUser: CurrentUser,
    priority: number,
  ): Promise<void> {
    await this.prisma.coachingAnalysisJob.upsert({
      where: { coachingSessionId: sessionId },
      create: {
        coachingSessionId: sessionId,
        priority,
        status: 'QUEUED',
        currentStep: 'En attente dans la file',
        createdByRole: currentUser.role,
        createdByUserId: currentUser.id,
      },
      update: {
        priority,
        status: 'QUEUED',
        attempts: 0,
        queuedAt: new Date(),
        startedAt: null,
        completedAt: null,
        failedAt: null,
        nextRunAt: null,
        lastHeartbeatAt: null,
        currentStep: 'En attente dans la file',
        failureReason: null,
      },
    });

    void this.pumpQueue();
  }

  private async recoverInterruptedQueueJobs(): Promise<void> {
    await this.prisma.coachingAnalysisJob.updateMany({
      where: {
        status: { in: ['QUEUED', 'PROCESSING'] },
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
    const job = await this.prisma.coachingAnalysisJob.findFirst({
      where: {
        status: 'QUEUED',
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
      },
      orderBy: [{ priority: 'desc' }, { queuedAt: 'asc' }],
    });

    if (!job) {
      return null;
    }

    return this.prisma.coachingAnalysisJob.update({
      where: { id: job.id },
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
  }

  private async runQueueJob(jobId: number): Promise<void> {
    const job = await this.prisma.coachingAnalysisJob.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      return;
    }

    const success = await this.processSession(job.coachingSessionId, job.id);
    const refreshed = await this.prisma.coachingAnalysisJob.findUnique({
      where: { id: job.id },
    });
    if (!refreshed) {
      return;
    }

    if (success) {
      await this.prisma.coachingAnalysisJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          currentStep: 'Analyse terminée',
          completedAt: new Date(),
          lastHeartbeatAt: new Date(),
          failureReason: null,
        },
      });
      return;
    }

    if (refreshed.attempts < refreshed.maxAttempts) {
      const nextRunAt = new Date(Date.now() + refreshed.attempts * 120_000);
      await this.prisma.coachingAnalysisJob.update({
        where: { id: job.id },
        data: {
          status: 'QUEUED',
          currentStep: `Nouvelle tentative prévue (${refreshed.attempts}/${refreshed.maxAttempts})`,
          nextRunAt,
          failedAt: new Date(),
          lastHeartbeatAt: new Date(),
          failureReason:
            'Le pipeline a échoué, une nouvelle tentative est planifiée.',
        },
      });
      return;
    }

    const session = await this.prisma.coachingSession.findUnique({
      where: { id: job.coachingSessionId },
      select: { failureReason: true },
    });

    await this.prisma.coachingAnalysisJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        currentStep: 'Analyse échouée',
        failedAt: new Date(),
        lastHeartbeatAt: new Date(),
        failureReason:
          session?.failureReason ??
          'Le pipeline a échoué après toutes les tentatives.',
      },
    });
  }

  private async updateAnalysisJobStep(
    jobId: number | undefined,
    currentStep: string,
  ): Promise<void> {
    if (!jobId) {
      return;
    }
    await this.prisma.coachingAnalysisJob.update({
      where: { id: jobId },
      data: {
        currentStep,
        lastHeartbeatAt: new Date(),
      },
    });
  }

  private async processSession(
    sessionId: number,
    jobId?: number,
  ): Promise<boolean> {
    const session = await this.prisma.coachingSession.findUnique({
      where: { id: sessionId },
      include: {
        commercial: true,
        salesPlanVersion: {
          include: {
            salesPlan: true,
            steps: {
              orderBy: { ordre: 'asc' },
            },
          },
        },
      },
    });

    if (!session) {
      return false;
    }

    await this.prisma.coachingSession.update({
      where: { id: sessionId },
      data: {
        status: 'PROCESSING',
      },
    });

    const tmpDir = path.join(
      os.tmpdir(),
      `coaching-session-${sessionId}-${Date.now()}`,
    );
    const localFile = path.join(tmpDir, 'recording.mp4');

    try {
      fs.mkdirSync(tmpDir, { recursive: true });

      await this.updateAnalysisJobStep(jobId, 'Téléchargement de l’audio');
      const downloaded = await this.downloadRecording(
        session.s3KeyOriginal,
        localFile,
      );
      if (!downloaded) {
        throw new Error("Téléchargement de l'enregistrement impossible");
      }

      await this.updateAnalysisJobStep(jobId, 'Transcription Whisper');
      let transcript: CoachingTranscriptPayload | null =
        await this.transcriptionService
          .transcribeFile(localFile)
          .then((result) =>
            result
              ? {
                  ...result,
                  source: 'WHISPER_FULL_RECORDING' as const,
                }
              : null,
          );

      if (!transcript || transcript.segments.length === 0) {
        await this.updateAnalysisJobStep(
          jobId,
          'Fallback sur les transcriptions segmentées',
        );
        transcript = await this.getTranscriptFromExistingSegments(
          session.s3KeyOriginal,
        );
      }

      if (!transcript || transcript.segments.length === 0) {
        throw new Error(
          'Whisper n’a retourné aucun segment exploitable et aucune transcription segmentée existante n’a été trouvée',
        );
      }

      const roomName =
        session.roomName || this.extractRoomFromKey(session.s3KeyOriginal);
      const inferredCommercialId =
        session.commercialId ?? this.extractCommercialIdFromRoomName(roomName);

      let confidenceScore = inferredCommercialId ? 0.95 : 0.35;
      let identificationSource = inferredCommercialId ? 'ROOM_NAME' : 'UNKNOWN';
      let reviewReason: string | null = null;
      let status: 'COMPLETED' | 'NEEDS_REVIEW' = 'COMPLETED';
      let reviewStatus: 'NOT_REQUIRED' | 'PENDING' = 'NOT_REQUIRED';

      if (transcript.source === 'RECORDING_SEGMENTS') {
        identificationSource =
          identificationSource === 'UNKNOWN'
            ? 'RECORDING_SEGMENTS'
            : `${identificationSource}+RECORDING_SEGMENTS`;
      }

      if (!inferredCommercialId) {
        status = 'NEEDS_REVIEW';
        reviewStatus = 'PENDING';
        reviewReason =
          'Le commercial n’a pas pu être identifié automatiquement à partir de la room.';
      }

      const transcriptText = this.buildTranscriptText(transcript.segments);
      const conversationBlocks = this.splitTranscriptIntoConversations(
        transcript.segments,
      );
      await this.updateAnalysisJobStep(
        jobId,
        'Réécriture lisible du transcript',
      );
      const readableTranscriptText =
        await this.rewriteTranscriptForReadability(transcriptText);
      await this.updateAnalysisJobStep(jobId, 'Évaluation globale IA');
      const evaluation = await this.evaluateTranscript(
        session.salesPlanVersion,
        transcriptText,
      );
      await this.updateAnalysisJobStep(jobId, 'Évaluation des conversations');
      const conversationEvaluations = await this.evaluateConversationBlocks(
        session.salesPlanVersion,
        conversationBlocks,
      );

      if (evaluation.usedFallback && status !== 'NEEDS_REVIEW') {
        status = 'NEEDS_REVIEW';
        reviewStatus = 'PENDING';
        reviewReason =
          'Le rapport a été calculé sans le LLM principal et nécessite une validation humaine.';
        confidenceScore = Math.min(confidenceScore, 0.7);
        identificationSource =
          identificationSource === 'UNKNOWN'
            ? 'FALLBACK'
            : `${identificationSource}+FALLBACK`;
      }

      await this.updateAnalysisJobStep(jobId, 'Finalisation du rapport');
      await this.prisma.$transaction(async (tx) => {
        await tx.coachingStepEvaluation.deleteMany({
          where: { coachingSessionId: session.id },
        });
        await tx.coachingConversationEvaluation.deleteMany({
          where: { coachingSessionId: session.id },
        });
        await tx.coachingKeyMoment.deleteMany({
          where: { coachingSessionId: session.id },
        });

        await tx.coachingSession.update({
          where: { id: session.id },
          data: {
            commercialId: inferredCommercialId ?? session.commercialId ?? null,
            directeurId:
              session.directeurId ?? session.commercial?.directeurId ?? null,
            roomName: roomName ?? session.roomName,
            status,
            reviewStatus,
            confidenceScore,
            identificationSource,
            transcriptText,
            readableTranscriptText,
            transcriptDurationSec: transcript.duration,
            whisperSegmentsCount: transcript.segments.length,
            overallScore: evaluation.overallScore ?? null,
            planCoverageScore: evaluation.planCoverageScore ?? null,
            executionQualityScore: evaluation.executionQualityScore ?? null,
            objectionHandlingScore: evaluation.objectionHandlingScore ?? null,
            listeningRatioScore: evaluation.listeningRatioScore ?? null,
            closingScore: evaluation.closingScore ?? null,
            summary: this.cleanOptionalText(evaluation.summary) ?? null,
            strengths: evaluation.strengths,
            improvements: evaluation.improvements,
            recommendations: evaluation.recommendations,
            llmModel: evaluation.usedFallback
              ? 'fallback-heuristic'
              : (this.vllmModel ?? null),
            llmRawResponse: evaluation.rawResponse ?? null,
            failureReason: null,
            reviewReason,
            processedAt: new Date(),
          },
        });

        if (evaluation.stepEvaluations.length > 0) {
          await tx.coachingStepEvaluation.createMany({
            data: evaluation.stepEvaluations.map((step) => ({
              coachingSessionId: session.id,
              salesPlanStepId:
                session.salesPlanVersion.steps.find(
                  (candidate) => candidate.ordre === step.ordre,
                )?.id ?? null,
              ordre: step.ordre,
              titre: step.titre,
              coverageStatus: step.coverageStatus,
              score: step.score ?? null,
              startTime: step.startTime ?? null,
              endTime: step.endTime ?? null,
              verbatim: this.cleanOptionalText(step.verbatim) ?? null,
              feedback: this.cleanOptionalText(step.feedback) ?? null,
              recommendation:
                this.cleanOptionalText(step.recommendation) ?? null,
            })),
          });
        }

        if (evaluation.keyMoments.length > 0) {
          await tx.coachingKeyMoment.createMany({
            data: evaluation.keyMoments.map((moment) => ({
              coachingSessionId: session.id,
              type: moment.type,
              title: moment.title,
              summary: this.cleanOptionalText(moment.summary) ?? null,
              startTime: moment.startTime ?? null,
              endTime: moment.endTime ?? null,
              verbatim: this.cleanOptionalText(moment.verbatim) ?? null,
              importance: moment.importance ?? null,
            })),
          });
        }

        if (conversationEvaluations.length > 0) {
          await tx.coachingConversationEvaluation.createMany({
            data: conversationEvaluations.map(({ block, evaluation }) => ({
              coachingSessionId: session.id,
              ordre: block.ordre,
              title: block.title,
              startTime: block.startTime,
              endTime: block.endTime,
              transcriptText: block.transcriptText,
              readableTranscriptText: block.readableTranscriptText,
              status: block.status,
              reviewReason:
                this.cleanOptionalText(block.reviewReason) ??
                (evaluation?.usedFallback
                  ? 'Conversation évaluée avec le fallback heuristique.'
                  : null),
              overallScore: evaluation?.overallScore ?? null,
              planCoverageScore: evaluation?.planCoverageScore ?? null,
              executionQualityScore: evaluation?.executionQualityScore ?? null,
              objectionHandlingScore:
                evaluation?.objectionHandlingScore ?? null,
              listeningRatioScore: evaluation?.listeningRatioScore ?? null,
              closingScore: evaluation?.closingScore ?? null,
              summary: this.cleanOptionalText(evaluation?.summary) ?? null,
              strengths: evaluation?.strengths ?? [],
              improvements: evaluation?.improvements ?? [],
              recommendations: evaluation?.recommendations ?? [],
              llmRawResponse: evaluation?.rawResponse ?? null,
            })),
          });
        }
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Traitement coaching ${sessionId} échoué: ${error?.message || error}`,
      );

      await this.prisma.coachingSession.update({
        where: { id: sessionId },
        data: {
          status: 'FAILED',
          reviewStatus: 'PENDING',
          failureReason:
            error?.message || 'Une erreur inconnue a interrompu l’analyse',
          reviewReason:
            'Analyse interrompue, une relance ou une revue humaine est nécessaire.',
          processedAt: new Date(),
        },
      });
      await this.updateAnalysisJobStep(jobId, 'Erreur pipeline');
      return false;
    } finally {
      this.cleanupDir(tmpDir);
    }
  }

  private async downloadRecording(
    s3Key: string,
    destinationPath: string,
  ): Promise<boolean> {
    try {
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
        }),
      );

      if (!response.Body) {
        return false;
      }

      const writeStream = fs.createWriteStream(destinationPath);
      await pipeline(response.Body as Readable, writeStream);
      return true;
    } catch (error) {
      this.logger.error(
        `Téléchargement S3 coaching impossible pour ${s3Key}: ${error?.message || error}`,
      );
      return false;
    }
  }

  private async getTranscriptFromExistingSegments(
    s3KeyOriginal: string,
  ): Promise<CoachingTranscriptPayload | null> {
    const segments = await this.prisma.recordingSegment.findMany({
      where: {
        s3KeyOriginal,
        transcription: {
          not: null,
        },
      },
      select: {
        startTime: true,
        endTime: true,
        transcription: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    const transcriptSegments = segments
      .map((segment) => ({
        start: segment.startTime,
        end: segment.endTime,
        text: segment.transcription?.trim() ?? '',
      }))
      .filter((segment) => segment.text.length > 0);

    if (transcriptSegments.length === 0) {
      return null;
    }

    this.logger.warn(
      `Whisper full-recording vide, fallback sur ${transcriptSegments.length} transcriptions segmentées pour ${s3KeyOriginal}`,
    );

    return {
      segments: transcriptSegments,
      duration: Math.max(...transcriptSegments.map((segment) => segment.end)),
      source: 'RECORDING_SEGMENTS',
    };
  }

  private buildTranscriptText(
    segments: Array<{ start: number; end: number; text: string }>,
  ): string {
    return segments
      .map((segment) => {
        const start = this.formatTimestamp(segment.start);
        const end = this.formatTimestamp(segment.end);
        return `[${start}-${end}] ${segment.text.trim()}`;
      })
      .join('\n');
  }

  private splitTranscriptIntoConversations(
    segments: Array<{ start: number; end: number; text: string }>,
  ): CoachingConversationBlock[] {
    const cleanSegments = segments
      .map((segment) => ({
        ...segment,
        text: segment.text.trim(),
      }))
      .filter((segment) => segment.text.length > 0)
      .sort((a, b) => a.start - b.start);

    if (cleanSegments.length === 0) {
      return [];
    }

    const blocks: Array<Array<{ start: number; end: number; text: string }>> =
      [];
    let current: Array<{ start: number; end: number; text: string }> = [];
    const pauseThresholdSec = 35;
    const minBlockTextLength = 80;
    const maxConversations = this.resolveMaxConversations();

    for (const segment of cleanSegments) {
      const previous = current[current.length - 1];
      const previousBlockText = current.map((item) => item.text).join(' ');
      const gap = previous ? segment.start - previous.end : 0;
      const shouldSplitOnPause = Boolean(
        previous &&
          gap >= pauseThresholdSec &&
          previousBlockText.length >= minBlockTextLength,
      );
      const shouldSplitOnGreeting = Boolean(
        previous &&
          this.hasConversationStartMarker(segment.text) &&
          previousBlockText.length >= minBlockTextLength,
      );
      const shouldSplitAfterClosing = Boolean(
        previous &&
          this.hasConversationEndMarker(previous.text) &&
          previousBlockText.length >= minBlockTextLength,
      );

      if (
        current.length > 0 &&
        (shouldSplitOnPause || shouldSplitOnGreeting || shouldSplitAfterClosing)
      ) {
        blocks.push(current);
        current = [];
      }

      current.push(segment);
    }

    if (current.length > 0) {
      blocks.push(current);
    }

    const mergedBlocks = this.mergeTinyConversationBlocks(
      blocks,
      minBlockTextLength,
    ).slice(0, maxConversations);

    return mergedBlocks.map((block, index) => {
      const transcriptText = this.buildTranscriptText(block);
      const startTime = block[0]?.start ?? 0;
      const endTime = block[block.length - 1]?.end ?? startTime;
      const usable = this.isConversationBlockUsable(transcriptText, block);

      return {
        ordre: index + 1,
        title: `Conversation ${index + 1} · ${this.formatTimestamp(startTime)}-${this.formatTimestamp(endTime)}`,
        startTime,
        endTime,
        transcriptText,
        segmentsCount: block.length,
        status: usable ? 'COMPLETED' : 'SKIPPED',
        reviewReason: usable
          ? null
          : 'Conversation trop courte ou trop pauvre pour une évaluation fiable.',
      };
    });
  }

  private mergeTinyConversationBlocks(
    blocks: Array<Array<{ start: number; end: number; text: string }>>,
    minTextLength: number,
  ): Array<Array<{ start: number; end: number; text: string }>> {
    return blocks.reduce<
      Array<Array<{ start: number; end: number; text: string }>>
    >((merged, block) => {
      const textLength = block.map((segment) => segment.text).join(' ').length;
      const previous = merged[merged.length - 1];

      if (textLength < minTextLength && previous) {
        previous.push(...block);
      } else {
        merged.push([...block]);
      }

      return merged;
    }, []);
  }

  private isConversationBlockUsable(
    transcriptText: string,
    block: Array<{ start: number; end: number; text: string }>,
  ): boolean {
    const duration =
      (block[block.length - 1]?.end ?? 0) - (block[0]?.start ?? 0);
    const words = transcriptText.split(/\s+/).filter(Boolean).length;
    return transcriptText.length >= 120 || words >= 25 || duration >= 20;
  }

  private hasConversationStartMarker(text: string): boolean {
    return /\b(bonjour|bonsoir|allo|allô|madame|monsieur)\b/i.test(text);
  }

  private hasConversationEndMarker(text: string): boolean {
    return /\b(au revoir|bonne journée|bonne soiree|bonne soirée|merci bonne|à bientôt|a bientot)\b/i.test(
      text,
    );
  }

  private async evaluateConversationBlocks(
    salesPlanVersion: {
      id: number;
      label: string | null;
      promptInstructions: string | null;
      steps: Array<{
        ordre: number;
        titre: string;
        description: string | null;
        expectedSignals: string | null;
        poids: number;
      }>;
    },
    blocks: CoachingConversationBlock[],
  ): Promise<
    Array<{
      block: CoachingConversationBlock;
      evaluation: SessionEvaluationPayload | null;
    }>
  > {
    const results: Array<{
      block: CoachingConversationBlock;
      evaluation: SessionEvaluationPayload | null;
    }> = [];

    for (const block of blocks) {
      if (block.status === 'SKIPPED') {
        results.push({
          block: {
            ...block,
            readableTranscriptText: await this.rewriteTranscriptForReadability(
              block.transcriptText,
            ),
          },
          evaluation: null,
        });
        continue;
      }

      try {
        const readableTranscriptText =
          await this.rewriteTranscriptForReadability(block.transcriptText);
        const evaluation = await this.evaluateTranscript(
          salesPlanVersion,
          block.transcriptText,
        );
        results.push({
          block: { ...block, readableTranscriptText },
          evaluation,
        });
      } catch (error) {
        this.logger.warn(
          `Évaluation conversation ${block.ordre} impossible: ${error?.message || error}`,
        );
        results.push({
          block: {
            ...block,
            status: 'FAILED',
            reviewReason:
              'Cette conversation n’a pas pu être évaluée, mais la session globale continue.',
          },
          evaluation: null,
        });
      }
    }

    return results;
  }

  private formatTimestamp(seconds: number): string {
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${secs}`;
  }

  private async evaluateTranscript(
    salesPlanVersion: {
      id: number;
      label: string | null;
      promptInstructions: string | null;
      steps: Array<{
        ordre: number;
        titre: string;
        description: string | null;
        expectedSignals: string | null;
        poids: number;
      }>;
    },
    transcriptText: string,
  ): Promise<SessionEvaluationPayload> {
    const llmEvaluation = await this.evaluateWithLlm(
      salesPlanVersion,
      transcriptText,
    );

    if (llmEvaluation) {
      return this.completeEvaluationPayload(
        salesPlanVersion,
        { ...llmEvaluation, usedFallback: false },
        transcriptText,
      );
    }

    return this.completeEvaluationPayload(
      salesPlanVersion,
      this.evaluateWithFallback(salesPlanVersion, transcriptText),
      transcriptText,
    );
  }

  private async rewriteTranscriptForReadability(
    transcriptText: string,
  ): Promise<string> {
    if (!transcriptText.trim()) {
      return transcriptText;
    }

    const rewritten = await this.rewriteTranscriptWithLlm(transcriptText);
    return rewritten || transcriptText;
  }

  private async rewriteTranscriptWithLlm(
    transcriptText: string,
  ): Promise<string | null> {
    if (!this.vllmBaseUrl || !this.vllmApiKey || !this.vllmModel) {
      return null;
    }

    const payload = {
      model: this.vllmModel,
      temperature: 0,
      max_tokens: 4500,
      messages: [
        {
          role: 'system',
          content:
            'Tu transformes des transcriptions commerciales hachées en dialogues lisibles. Tu ne changes jamais le sens, tu n’inventes rien, et tu signales les passages incertains.',
        },
        {
          role: 'user',
          content: [
            'Réécris le transcript ci-dessous en dialogue lisible et fluide.',
            'Règles strictes:',
            '- Ne change pas le sens.',
            '- N’ajoute aucune information absente du transcript.',
            '- Regroupe les fragments qui appartiennent à la même phrase ou au même tour de parole.',
            '- Supprime les ellipses répétitives de transcription comme "...", "....", "… … …".',
            '- Si un passage est incompréhensible, écris "[passage inaudible]" au lieu de garder des "...".',
            '- Structure en tours de parole avec "Commercial :", "Client :" ou "Intervenant :" si le locuteur est incertain.',
            '- Ne mets pas un timestamp à chaque phrase. Tu peux garder un timestamp au début d’un grand bloc seulement si utile.',
            '- Corrige seulement la ponctuation, les majuscules, les répétitions évidentes et la segmentation.',
            '- Retourne uniquement le texte réécrit, sans markdown.',
            '',
            this.truncateTranscriptForPrompt(
              this.prepareTranscriptForReadabilityPrompt(transcriptText),
            ),
          ].join('\n'),
        },
      ],
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.vllmTimeoutMs);

    try {
      const response = await fetch(
        `${this.vllmBaseUrl.replace(/\/$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.vllmApiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `vLLM repasse transcript a répondu ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const data = (await response.json()) as any;
      const content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        return null;
      }

      return this.normalizeReadableTranscript(content);
    } catch (error) {
      this.logger.warn(
        `Repasse transcript vLLM impossible: ${error?.message || error}`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeReadableTranscript(value: string): string | null {
    const cleaned = value
      .replace(/^```(?:text|markdown)?/i, '')
      .replace(/```$/i, '')
      .trim();

    if (cleaned.length < 20) {
      return null;
    }

    return cleaned;
  }

  private prepareTranscriptForReadabilityPrompt(
    transcriptText: string,
  ): string {
    const segments = this.parseTimestampedTranscript(transcriptText);
    if (segments.length === 0) {
      return this.cleanTranscriptNoiseForPrompt(transcriptText);
    }

    const grouped: Array<{
      start: number;
      end: number;
      text: string;
    }> = [];

    for (const segment of segments) {
      const text = this.cleanTranscriptNoiseForPrompt(segment.text);
      if (!text) {
        continue;
      }

      const previous = grouped[grouped.length - 1];
      const gap = previous
        ? segment.start - previous.end
        : Number.POSITIVE_INFINITY;
      const previousLooksOpen = previous
        ? !/[.!?]$/.test(previous.text.trim())
        : false;
      const currentLooksLikeContinuation =
        /^[,;:)]/.test(text) || /^[a-zàâäéèêëîïôöùûüç]/.test(text);

      if (
        previous &&
        gap <= 3.5 &&
        (previousLooksOpen ||
          currentLooksLikeContinuation ||
          previous.text.length < 500)
      ) {
        previous.end = segment.end;
        previous.text = `${previous.text} ${text}`.replace(/\s+/g, ' ').trim();
      } else {
        grouped.push({
          start: segment.start,
          end: segment.end,
          text,
        });
      }
    }

    return grouped
      .map(
        (group) =>
          `[${this.formatTimestamp(group.start)}-${this.formatTimestamp(group.end)}] ${group.text}`,
      )
      .join('\n');
  }

  private parseTimestampedTranscript(
    transcriptText: string,
  ): Array<{ start: number; end: number; text: string }> {
    return transcriptText
      .split('\n')
      .map((line) => {
        const match = line.match(
          /^\[(\d{1,3}):(\d{2})-(\d{1,3}):(\d{2})\]\s*(.*)$/,
        );
        if (!match) {
          return null;
        }

        const start = Number(match[1]) * 60 + Number(match[2]);
        const end = Number(match[3]) * 60 + Number(match[4]);
        const text = match[5]?.trim() ?? '';

        if (!Number.isFinite(start) || !Number.isFinite(end) || !text) {
          return null;
        }

        return { start, end, text };
      })
      .filter(
        (segment): segment is { start: number; end: number; text: string } =>
          Boolean(segment),
      );
  }

  private cleanTranscriptNoiseForPrompt(value: string): string {
    return value
      .replace(/(?:\.{2,}|…)+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async evaluateWithLlm(
    salesPlanVersion: {
      label: string | null;
      promptInstructions: string | null;
      steps: Array<{
        ordre: number;
        titre: string;
        description: string | null;
        expectedSignals: string | null;
        poids: number;
      }>;
    },
    transcriptText: string,
  ): Promise<SessionEvaluationPayload | null> {
    if (!this.vllmBaseUrl || !this.vllmApiKey || !this.vllmModel) {
      return null;
    }

    const payload = {
      model: this.vllmModel,
      temperature: 0.2,
      max_tokens: this.resolveEvaluationMaxTokens(
        salesPlanVersion.steps.length,
      ),
      messages: [
        {
          role: 'system',
          content:
            'Tu es un coach commercial Pro-Win. Tu évalues uniquement le plan fourni par l’utilisateur, sans imposer de trame standard. Réponds uniquement en JSON valide sans markdown.',
        },
        {
          role: 'user',
          content: this.buildLlmPrompt(
            salesPlanVersion,
            this.truncateTranscriptForPrompt(transcriptText),
          ),
        },
      ],
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.vllmTimeoutMs);

    try {
      const response = await fetch(
        `${this.vllmBaseUrl.replace(/\/$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.vllmApiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `vLLM a répondu ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const data = (await response.json()) as any;
      const content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        return null;
      }

      const parsed = this.parseLlmJson(content);
      if (!parsed) {
        return null;
      }

      return {
        overallScore: this.normalizeScore(parsed.overallScore),
        planCoverageScore: this.normalizeScore(parsed.planCoverageScore),
        executionQualityScore: this.normalizeScore(
          parsed.executionQualityScore,
        ),
        objectionHandlingScore: this.normalizeScore(
          parsed.objectionHandlingScore,
        ),
        listeningRatioScore: this.normalizeNullableScore(
          parsed.listeningRatioScore,
        ),
        closingScore: this.normalizeScore(parsed.closingScore),
        summary: this.normalizeText(parsed.summary),
        strengths: this.normalizeTextArray(parsed.strengths),
        improvements: this.normalizeTextArray(parsed.improvements),
        recommendations: this.normalizeTextArray(parsed.recommendations),
        keyMoments: Array.isArray(parsed.keyMoments)
          ? parsed.keyMoments
              .map((moment: any) => this.normalizeKeyMoment(moment))
              .filter(
                (moment: KeyMomentPayload | null): moment is KeyMomentPayload =>
                  Boolean(moment),
              )
              .slice(0, 8)
          : [],
        rawResponse: content,
        stepEvaluations: Array.isArray(parsed.stepEvaluations)
          ? parsed.stepEvaluations.map((step: any, index: number) => ({
              ordre: Number.isFinite(Number(step?.ordre))
                ? Number(step.ordre)
                : index + 1,
              titre:
                this.normalizeText(step?.titre) ||
                salesPlanVersion.steps[index]?.titre ||
                `Étape ${index + 1}`,
              coverageStatus: this.normalizeCoverageStatus(
                step?.coverageStatus,
              ),
              score: this.normalizeNullableScore(step?.score),
              startTime: this.normalizeNullableNumber(step?.startTime),
              endTime: this.normalizeNullableNumber(step?.endTime),
              verbatim: this.normalizeText(step?.verbatim),
              feedback: this.normalizeText(step?.feedback),
              recommendation: this.normalizeText(step?.recommendation),
            }))
          : [],
      };
    } catch (error) {
      this.logger.warn(`Appel vLLM impossible: ${error?.message || error}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private resolveVllmTimeoutMs(): number {
    const raw = Number(process.env.VLLM_TIMEOUT_MS);
    if (!Number.isFinite(raw) || raw < 10_000) {
      return 180_000;
    }
    return raw;
  }

  private resolveMaxTranscriptPromptChars(): number {
    const raw = Number(process.env.COACHING_MAX_TRANSCRIPT_PROMPT_CHARS);
    if (!Number.isFinite(raw) || raw < 5_000) {
      return 60_000;
    }
    return raw;
  }

  private resolveQueueConcurrency(): number {
    const raw = Number(process.env.COACHING_ANALYSIS_CONCURRENCY);
    if (!Number.isFinite(raw)) {
      return 1;
    }
    return Math.max(1, Math.min(5, Math.floor(raw)));
  }

  private resolveQueuePollMs(): number {
    const raw = Number(process.env.COACHING_QUEUE_POLL_MS);
    if (!Number.isFinite(raw)) {
      return 5_000;
    }
    return Math.max(2_000, Math.min(60_000, Math.floor(raw)));
  }

  private resolveAutoQueueSpeechRetryMs(): number {
    const raw = Number(process.env.COACHING_AUTO_SPEECH_RETRY_MS);
    if (!Number.isFinite(raw)) {
      return 60_000;
    }
    return Math.max(10_000, Math.min(10 * 60_000, Math.floor(raw)));
  }

  private resolveAutoQueueSpeechMaxAttempts(): number {
    const raw = Number(process.env.COACHING_AUTO_SPEECH_MAX_ATTEMPTS);
    if (!Number.isFinite(raw)) {
      return 8;
    }
    return Math.max(1, Math.min(30, Math.floor(raw)));
  }

  private isAutoCoachingEnabled(): boolean {
    const raw = process.env.COACHING_AUTO_ANALYZE_ENABLED;
    if (!raw) {
      return true;
    }
    return !['0', 'false', 'no', 'off'].includes(raw.toLowerCase());
  }

  private secondsSince(value: Date): number {
    return Math.max(0, Math.round((Date.now() - value.getTime()) / 1000));
  }

  private resolveMaxConversations(): number {
    const raw = Number(process.env.COACHING_MAX_CONVERSATIONS);
    if (!Number.isFinite(raw) || raw < 1) {
      return 12;
    }
    return Math.min(Math.floor(raw), 30);
  }

  private resolveEvaluationMaxTokens(stepCount: number): number {
    const dynamicBudget = 1400 + Math.max(1, stepCount) * 420;
    return Math.min(Math.max(dynamicBudget, 2500), 7000);
  }

  private truncateTranscriptForPrompt(transcriptText: string): string {
    if (transcriptText.length <= this.maxTranscriptPromptChars) {
      return transcriptText;
    }

    const headLength = Math.floor(this.maxTranscriptPromptChars * 0.65);
    const tailLength = this.maxTranscriptPromptChars - headLength;
    return [
      transcriptText.slice(0, headLength),
      '\n[TRANSCRIPT_TRONQUE_POUR_CONTEXTE]\n',
      transcriptText.slice(-tailLength),
    ].join('');
  }

  private buildLlmPrompt(
    salesPlanVersion: {
      label: string | null;
      promptInstructions: string | null;
      steps: Array<{
        ordre: number;
        titre: string;
        description: string | null;
        expectedSignals: string | null;
        poids: number;
      }>;
    },
    transcriptText: string,
  ): string {
    const steps = salesPlanVersion.steps
      .map(
        (step) =>
          `${step.ordre}. ${step.titre} | poids=${step.poids} | description=${step.description || 'n/a'} | signaux=${step.expectedSignals || 'n/a'}`,
      )
      .join('\n');

    return [
      `Plan de vente: ${salesPlanVersion.label || 'Version active'}`,
      salesPlanVersion.promptInstructions
        ? `Consignes additionnelles: ${salesPlanVersion.promptInstructions}`
        : null,
      `Nombre exact d'étapes à évaluer: ${salesPlanVersion.steps.length}`,
      'Règles importantes:',
      "- Le plan est entièrement dynamique: n'utilise aucune section prédéfinie comme ouverture/découverte/closing si elle n'existe pas dans le plan.",
      '- Retourne une entrée stepEvaluations pour chaque étape listée ci-dessous, dans le même ordre et avec le même numéro ordre.',
      "- Si une étape n'est pas observable dans le transcript, garde son titre exact et marque-la MISSING avec une recommandation concrète.",
      "- Ne fusionne pas deux étapes et n'ajoute jamais d'étape absente du plan fourni.",
      'Étapes libres du plan à évaluer:',
      steps,
      'Transcript:',
      transcriptText,
      'Retourne strictement un JSON avec les clés suivantes:',
      '{',
      '  "overallScore": number,',
      '  "planCoverageScore": number,',
      '  "executionQualityScore": number,',
      '  "objectionHandlingScore": number,',
      '  "listeningRatioScore": number | null,',
      '  "closingScore": number,',
      '  "summary": string,',
      '  "strengths": string[],',
      '  "improvements": string[],',
      '  "recommendations": string[],',
      '  "keyMoments": [',
      '    {',
      '      "type": "OBJECTION" | "ERREUR" | "BON_ARGUMENT" | "PROMESSE" | "SIGNAL_ACHAT" | "A_REVOIR",',
      '      "title": string,',
      '      "summary": string,',
      '      "startTime": number | null,',
      '      "endTime": number | null,',
      '      "verbatim": string,',
      '      "importance": number',
      '    }',
      '  ],',
      '  "stepEvaluations": [',
      '    {',
      '      "ordre": number,',
      '      "titre": string,',
      '      "coverageStatus": "COVERED" | "PARTIAL" | "MISSING",',
      '      "score": number,',
      '      "startTime": number | null,',
      '      "endTime": number | null,',
      '      "verbatim": string,',
      '      "feedback": string,',
      '      "recommendation": string',
      '    }',
      '  ]',
      '}',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private parseLlmJson(content: string): any | null {
    const trimmed = content.trim();

    try {
      return JSON.parse(trimmed);
    } catch {
      const fenceLess = trimmed
        .replace(/^```json/i, '')
        .replace(/^```/i, '')
        .replace(/```$/i, '')
        .trim();

      try {
        return JSON.parse(fenceLess);
      } catch {
        const firstBrace = fenceLess.indexOf('{');
        const lastBrace = fenceLess.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
          return null;
        }

        try {
          return JSON.parse(fenceLess.slice(firstBrace, lastBrace + 1));
        } catch {
          return null;
        }
      }
    }
  }

  private evaluateWithFallback(
    salesPlanVersion: {
      steps: Array<{
        ordre: number;
        titre: string;
        description: string | null;
        expectedSignals: string | null;
        poids: number;
      }>;
    },
    transcriptText: string,
  ): SessionEvaluationPayload {
    const lowerTranscript = transcriptText.toLowerCase();
    const totalWeight = salesPlanVersion.steps.reduce(
      (sum, step) => sum + step.poids,
      0,
    );

    const stepEvaluations = salesPlanVersion.steps.map((step) => {
      const sourceText = [
        step.titre,
        step.description || '',
        step.expectedSignals || '',
      ]
        .join(' ')
        .toLowerCase();

      const keywords = Array.from(
        new Set(
          sourceText
            .split(/[^a-zA-ZÀ-ÿ0-9]+/)
            .map((token) => token.trim())
            .filter((token) => token.length >= 4),
        ),
      ).slice(0, 8);

      const hits = keywords.filter((keyword) =>
        lowerTranscript.includes(keyword),
      );
      const ratio = keywords.length === 0 ? 0 : hits.length / keywords.length;

      let coverageStatus: StepEvaluationPayload['coverageStatus'] = 'MISSING';
      let score = 35;

      if (ratio >= 0.45) {
        coverageStatus = 'COVERED';
        score = 85;
      } else if (ratio >= 0.15) {
        coverageStatus = 'PARTIAL';
        score = 60;
      }

      const excerpt = this.extractBestVerbatim(transcriptText, hits[0]);
      const excerptRange = excerpt
        ? this.resolveExcerptTimeRange(transcriptText, excerpt)
        : null;

      return {
        ordre: step.ordre,
        titre: step.titre,
        coverageStatus,
        score,
        startTime: excerptRange?.start ?? null,
        endTime: excerptRange?.end ?? null,
        verbatim: excerpt,
        feedback:
          coverageStatus === 'COVERED'
            ? 'La transcription contient des signaux compatibles avec cette étape.'
            : coverageStatus === 'PARTIAL'
              ? 'L’étape apparaît partiellement dans la transcription et mérite une vérification humaine.'
              : 'Aucun signal clair de cette étape n’a été détecté automatiquement.',
        recommendation:
          coverageStatus === 'MISSING'
            ? `Renforcer explicitement l’étape "${step.titre}" pendant la trame commerciale.`
            : `Consolider la formulation de l’étape "${step.titre}" pour la rendre plus nette.`,
      };
    });

    const weightedScore = Math.round(
      stepEvaluations.reduce((sum, step) => {
        const sourceStep = salesPlanVersion.steps.find(
          (candidate) => candidate.ordre === step.ordre,
        );
        return sum + (step.score || 0) * (sourceStep?.poids || 0);
      }, 0) / Math.max(totalWeight, 1),
    );

    const weightedCoverageScore = Math.round(
      stepEvaluations.reduce((sum, step) => {
        const sourceStep = salesPlanVersion.steps.find(
          (candidate) => candidate.ordre === step.ordre,
        );
        const coverageValue =
          step.coverageStatus === 'COVERED'
            ? 100
            : step.coverageStatus === 'PARTIAL'
              ? 55
              : 0;
        return sum + coverageValue * (sourceStep?.poids || 0);
      }, 0) / Math.max(totalWeight, 1),
    );

    return {
      overallScore: weightedScore,
      planCoverageScore: weightedCoverageScore,
      executionQualityScore: weightedScore,
      objectionHandlingScore: lowerTranscript.includes('objection')
        ? 65
        : Math.max(45, weightedScore - 10),
      listeningRatioScore: null,
      closingScore:
        lowerTranscript.includes('rendez-vous') ||
        lowerTranscript.includes('contrat') ||
        lowerTranscript.includes('signature')
          ? 72
          : 48,
      summary:
        'Évaluation de secours calculée sans le LLM principal. Utiliser ce rapport pour tester le flow puis valider manuellement.',
      strengths: stepEvaluations
        .filter((step) => step.coverageStatus === 'COVERED')
        .slice(0, 3)
        .map((step) => `Étape bien visible: ${step.titre}`),
      improvements: stepEvaluations
        .filter((step) => step.coverageStatus !== 'COVERED')
        .slice(0, 3)
        .map((step) => `Travailler l’étape: ${step.titre}`),
      recommendations: [
        'Faire relire le rapport si le scoring paraît trop mécanique.',
        'Comparer le transcript avec la trame commerciale réelle avant validation finale.',
      ],
      keyMoments: this.buildFallbackKeyMoments(transcriptText),
      stepEvaluations,
      rawResponse: null,
      usedFallback: true,
    };
  }

  private completeEvaluationPayload(
    salesPlanVersion: {
      steps: Array<{
        ordre: number;
        titre: string;
        description: string | null;
        expectedSignals: string | null;
        poids: number;
      }>;
    },
    evaluation: SessionEvaluationPayload,
    transcriptText: string,
  ): SessionEvaluationPayload {
    const fallback = this.evaluateWithFallback(
      salesPlanVersion,
      transcriptText,
    );
    const byOrder = new Map(
      evaluation.stepEvaluations.map((step) => [step.ordre, step]),
    );

    const stepEvaluations = salesPlanVersion.steps.map((planStep) => {
      const existing = byOrder.get(planStep.ordre);
      const fallbackStep = fallback.stepEvaluations.find(
        (step) => step.ordre === planStep.ordre,
      );

      return {
        ordre: planStep.ordre,
        titre: existing?.titre || planStep.titre,
        coverageStatus:
          existing?.coverageStatus || fallbackStep?.coverageStatus || 'MISSING',
        score: existing?.score ?? fallbackStep?.score ?? null,
        startTime:
          existing?.startTime ??
          fallbackStep?.startTime ??
          this.resolveExcerptTimeRange(transcriptText, existing?.verbatim)
            ?.start ??
          null,
        endTime:
          existing?.endTime ??
          fallbackStep?.endTime ??
          this.resolveExcerptTimeRange(transcriptText, existing?.verbatim)
            ?.end ??
          null,
        verbatim: existing?.verbatim ?? fallbackStep?.verbatim ?? null,
        feedback: existing?.feedback ?? fallbackStep?.feedback ?? null,
        recommendation:
          existing?.recommendation ?? fallbackStep?.recommendation ?? null,
      };
    });

    const totalWeight = salesPlanVersion.steps.reduce(
      (sum, step) => sum + step.poids,
      0,
    );
    const weightedScore = Math.round(
      stepEvaluations.reduce((sum, step) => {
        const sourceStep = salesPlanVersion.steps.find(
          (candidate) => candidate.ordre === step.ordre,
        );
        return sum + (step.score || 0) * (sourceStep?.poids || 0);
      }, 0) / Math.max(totalWeight, 1),
    );

    return {
      ...evaluation,
      overallScore: evaluation.overallScore ?? weightedScore,
      planCoverageScore:
        evaluation.planCoverageScore ?? fallback.planCoverageScore,
      executionQualityScore: evaluation.executionQualityScore ?? weightedScore,
      objectionHandlingScore:
        evaluation.objectionHandlingScore ?? fallback.objectionHandlingScore,
      listeningRatioScore:
        evaluation.listeningRatioScore ?? fallback.listeningRatioScore,
      closingScore: evaluation.closingScore ?? fallback.closingScore,
      summary: evaluation.summary ?? fallback.summary,
      strengths:
        evaluation.strengths.length > 0
          ? evaluation.strengths
          : fallback.strengths,
      improvements:
        evaluation.improvements.length > 0
          ? evaluation.improvements
          : fallback.improvements,
      recommendations:
        evaluation.recommendations.length > 0
          ? evaluation.recommendations
          : fallback.recommendations,
      keyMoments:
        evaluation.keyMoments.length > 0
          ? evaluation.keyMoments.map((moment) =>
              this.completeKeyMomentTiming(transcriptText, moment),
            )
          : fallback.keyMoments,
      stepEvaluations,
    };
  }

  private extractBestVerbatim(
    transcriptText: string,
    keyword?: string,
  ): string | null {
    const lines = transcriptText.split('\n').filter(Boolean);
    if (!keyword) {
      return lines[0] || null;
    }
    const match = lines.find((line) =>
      line.toLowerCase().includes(keyword.toLowerCase()),
    );
    return match || lines[0] || null;
  }

  private normalizeCoverageStatus(
    value: unknown,
  ): 'COVERED' | 'PARTIAL' | 'MISSING' {
    if (value === 'COVERED' || value === 'PARTIAL' || value === 'MISSING') {
      return value;
    }
    return 'MISSING';
  }

  private normalizeText(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeTextArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean)
      .slice(0, 6);
  }

  private normalizeScore(value: unknown): number | null {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return null;
    }
    return Math.max(0, Math.min(100, Math.round(num)));
  }

  private normalizeNullableScore(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return this.normalizeScore(value);
  }

  private normalizeNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      return null;
    }
    return Math.round(num * 10) / 10;
  }

  private normalizeKeyMoment(value: any): KeyMomentPayload | null {
    const title = this.normalizeText(value?.title);
    if (!title) {
      return null;
    }

    return {
      type:
        this.normalizeText(value?.type)
          ?.toUpperCase()
          .replace(/[^A-Z0-9_]/g, '_')
          .slice(0, 40) || 'A_REVOIR',
      title,
      summary: this.normalizeText(value?.summary),
      startTime: this.normalizeNullableNumber(value?.startTime),
      endTime: this.normalizeNullableNumber(value?.endTime),
      verbatim: this.normalizeText(value?.verbatim),
      importance: this.normalizeNullableScore(value?.importance),
    };
  }

  private completeKeyMomentTiming(
    transcriptText: string,
    moment: KeyMomentPayload,
  ): KeyMomentPayload {
    if (moment.startTime !== null && moment.startTime !== undefined) {
      return moment;
    }

    const range = this.resolveExcerptTimeRange(
      transcriptText,
      moment.verbatim || moment.summary || moment.title,
    );

    return {
      ...moment,
      startTime: range?.start ?? null,
      endTime: range?.end ?? null,
    };
  }

  private resolveExcerptTimeRange(
    transcriptText: string,
    excerpt?: string | null,
  ): { start: number; end: number } | null {
    if (!excerpt) {
      return null;
    }

    const normalizedExcerpt = this.normalizeSearchText(excerpt);
    if (!normalizedExcerpt) {
      return null;
    }

    const segments = this.parseTimestampedTranscript(transcriptText);
    for (const segment of segments) {
      const normalizedSegment = this.normalizeSearchText(segment.text);
      if (
        normalizedSegment.includes(normalizedExcerpt) ||
        normalizedExcerpt.includes(normalizedSegment)
      ) {
        return { start: segment.start, end: segment.end };
      }
    }

    const strongestWords = normalizedExcerpt
      .split(' ')
      .filter((word) => word.length >= 4)
      .slice(0, 8);

    if (strongestWords.length === 0) {
      return null;
    }

    let bestMatch: { start: number; end: number; hits: number } | null = null;
    for (const segment of segments) {
      const normalizedSegment = this.normalizeSearchText(segment.text);
      const hits = strongestWords.filter((word) =>
        normalizedSegment.includes(word),
      ).length;
      if (hits > (bestMatch?.hits ?? 0)) {
        bestMatch = { start: segment.start, end: segment.end, hits };
      }
    }

    if (!bestMatch || bestMatch.hits < Math.min(2, strongestWords.length)) {
      return null;
    }

    return { start: bestMatch.start, end: bestMatch.end };
  }

  private normalizeSearchText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildFallbackKeyMoments(transcriptText: string): KeyMomentPayload[] {
    const moments: KeyMomentPayload[] = [];
    const patterns: Array<{ type: string; title: string; keywords: string[] }> =
      [
        {
          type: 'OBJECTION',
          title: 'Objection ou hesitation client',
          keywords: [
            'pas intéressé',
            'pas interesse',
            'trop cher',
            'réfléchir',
            'refus',
          ],
        },
        {
          type: 'SIGNAL_ACHAT',
          title: 'Signal d interet',
          keywords: [
            'combien',
            'rendez-vous',
            'contrat',
            'signature',
            'installer',
          ],
        },
        {
          type: 'PROMESSE',
          title: 'Promesse ou engagement',
          keywords: [
            'je vous rappelle',
            'on repasse',
            'je vous envoie',
            'demain',
          ],
        },
      ];

    const lowerTranscript = transcriptText.toLowerCase();
    for (const pattern of patterns) {
      const keyword = pattern.keywords.find((entry) =>
        lowerTranscript.includes(entry.toLowerCase()),
      );
      const match = keyword
        ? this.extractBestVerbatim(transcriptText, keyword)
        : null;
      if (!match) {
        continue;
      }

      const range = this.resolveExcerptTimeRange(transcriptText, match);
      moments.push({
        type: pattern.type,
        title: pattern.title,
        summary: 'Moment détecté automatiquement à partir du transcript.',
        startTime: range?.start ?? null,
        endTime: range?.end ?? null,
        verbatim: match,
        importance: 65,
      });
    }

    return moments.slice(0, 4);
  }

  private mapSession(session: any, audioUrl?: string): CoachingSessionDto {
    const analysisJob = session.analysisJobs?.[0]
      ? this.mapAnalysisJob(session.analysisJobs[0])
      : undefined;

    return {
      id: session.id,
      s3KeyOriginal: session.s3KeyOriginal,
      roomName: session.roomName ?? undefined,
      commercialId: session.commercialId ?? undefined,
      commercialNom: session.commercial
        ? `${session.commercial.prenom} ${session.commercial.nom}`
        : undefined,
      directeurId: session.directeurId ?? undefined,
      salesPlanVersionId: session.salesPlanVersionId,
      salesPlanNom: session.salesPlanVersion?.salesPlan?.nom ?? undefined,
      salesPlanVersionLabel: session.salesPlanVersion?.label ?? undefined,
      status: session.status,
      reviewStatus: session.reviewStatus,
      confidenceScore: session.confidenceScore ?? undefined,
      identificationSource: session.identificationSource ?? undefined,
      transcriptText: session.transcriptText ?? undefined,
      readableTranscriptText: session.readableTranscriptText ?? undefined,
      transcriptDurationSec: session.transcriptDurationSec ?? undefined,
      whisperSegmentsCount: session.whisperSegmentsCount ?? undefined,
      overallScore: session.overallScore ?? undefined,
      planCoverageScore: session.planCoverageScore ?? undefined,
      executionQualityScore: session.executionQualityScore ?? undefined,
      objectionHandlingScore: session.objectionHandlingScore ?? undefined,
      listeningRatioScore: session.listeningRatioScore ?? undefined,
      closingScore: session.closingScore ?? undefined,
      summary: session.summary ?? undefined,
      strengths: session.strengths ?? [],
      improvements: session.improvements ?? [],
      recommendations: session.recommendations ?? [],
      llmModel: session.llmModel ?? undefined,
      failureReason: session.failureReason ?? undefined,
      reviewReason: session.reviewReason ?? undefined,
      reviewNotes: session.reviewNotes ?? undefined,
      audioUrl,
      launchedAt: session.launchedAt,
      processedAt: session.processedAt ?? undefined,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      analysisJob,
      pipelineSteps: this.buildPipelineSteps(session, analysisJob),
      stepEvaluations:
        session.stepEvaluations?.map((step: any) => ({
          id: step.id,
          ordre: step.ordre,
          titre: step.titre,
          coverageStatus: step.coverageStatus,
          score: step.score ?? undefined,
          startTime: step.startTime ?? undefined,
          endTime: step.endTime ?? undefined,
          verbatim: step.verbatim ?? undefined,
          feedback: step.feedback ?? undefined,
          recommendation: step.recommendation ?? undefined,
        })) ?? [],
      keyMoments:
        session.keyMoments?.map((moment: any) => ({
          id: moment.id,
          type: moment.type,
          title: moment.title,
          summary: moment.summary ?? undefined,
          startTime: moment.startTime ?? undefined,
          endTime: moment.endTime ?? undefined,
          verbatim: moment.verbatim ?? undefined,
          importance: moment.importance ?? undefined,
          createdAt: moment.createdAt,
          updatedAt: moment.updatedAt,
        })) ?? [],
      conversationEvaluations:
        session.conversationEvaluations?.map((conversation: any) => ({
          id: conversation.id,
          ordre: conversation.ordre,
          title: conversation.title ?? undefined,
          startTime: conversation.startTime ?? undefined,
          endTime: conversation.endTime ?? undefined,
          transcriptText: conversation.transcriptText ?? undefined,
          readableTranscriptText:
            conversation.readableTranscriptText ?? undefined,
          status: conversation.status,
          reviewReason: conversation.reviewReason ?? undefined,
          overallScore: conversation.overallScore ?? undefined,
          planCoverageScore: conversation.planCoverageScore ?? undefined,
          executionQualityScore:
            conversation.executionQualityScore ?? undefined,
          objectionHandlingScore:
            conversation.objectionHandlingScore ?? undefined,
          listeningRatioScore: conversation.listeningRatioScore ?? undefined,
          closingScore: conversation.closingScore ?? undefined,
          summary: conversation.summary ?? undefined,
          strengths: conversation.strengths ?? [],
          improvements: conversation.improvements ?? [],
          recommendations: conversation.recommendations ?? [],
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        })) ?? [],
    };
  }

  private mapAnalysisJob(job: any): CoachingAnalysisJobDto {
    return {
      id: job.id,
      coachingSessionId: job.coachingSessionId,
      status: job.status,
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      currentStep: job.currentStep ?? undefined,
      failureReason: job.failureReason ?? undefined,
      queuedAt: job.queuedAt,
      startedAt: job.startedAt ?? undefined,
      completedAt: job.completedAt ?? undefined,
      failedAt: job.failedAt ?? undefined,
      nextRunAt: job.nextRunAt ?? undefined,
      lastHeartbeatAt: job.lastHeartbeatAt ?? undefined,
      waitSeconds:
        job.status === 'QUEUED'
          ? this.secondsSince(job.queuedAt)
          : job.startedAt
            ? Math.max(
                0,
                Math.round(
                  (job.startedAt.getTime() - job.queuedAt.getTime()) / 1000,
                ),
              )
            : undefined,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  private buildPipelineSteps(
    session: any,
    job?: CoachingAnalysisJobDto,
  ): Array<{
    key: string;
    label: string;
    status: string;
    timestamp?: Date;
    detail?: string;
  }> {
    const failed = session.status === 'FAILED' || job?.status === 'FAILED';
    const processing = session.status === 'PROCESSING';
    const completed =
      session.status === 'COMPLETED' || session.status === 'NEEDS_REVIEW';

    return [
      {
        key: 'queued',
        label: 'File d’attente',
        status: job
          ? this.pipelineStatus(Boolean(job.startedAt), false, false)
          : 'PENDING',
        timestamp: job?.queuedAt,
        detail: job?.currentStep,
      },
      {
        key: 'processing',
        label: 'Traitement audio',
        status: this.pipelineStatus(
          Boolean(session.transcriptText),
          processing,
          failed && !session.transcriptText,
        ),
        timestamp: job?.startedAt,
      },
      {
        key: 'readable_transcript',
        label: 'Transcript lisible',
        status: this.pipelineStatus(
          Boolean(session.readableTranscriptText),
          processing && Boolean(session.transcriptText),
          failed && Boolean(session.transcriptText),
        ),
      },
      {
        key: 'evaluation',
        label: 'Évaluation IA',
        status: this.pipelineStatus(
          Boolean(session.overallScore || session.summary),
          processing && Boolean(session.readableTranscriptText),
          failed && Boolean(session.readableTranscriptText),
        ),
      },
      {
        key: 'completed',
        label: 'Rapport disponible',
        status: this.pipelineStatus(
          completed,
          processing && Boolean(session.overallScore || session.summary),
          failed,
        ),
        timestamp: session.processedAt ?? job?.completedAt ?? job?.failedAt,
        detail: session.failureReason ?? session.reviewReason ?? undefined,
      },
    ];
  }

  private pipelineStatus(
    done: boolean,
    processing: boolean,
    failed: boolean,
  ): string {
    if (failed) {
      return 'FAILED';
    }
    if (done) {
      return 'COMPLETED';
    }
    if (processing) {
      return 'PROCESSING';
    }
    return 'PENDING';
  }

  private cleanupDir(dirPath: string): void {
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    } catch {
      // Nettoyage best effort
    }
  }
}
