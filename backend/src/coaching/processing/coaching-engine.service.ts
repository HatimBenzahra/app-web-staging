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
import {
  CoachingEvidenceReviewStatus,
  CoachingSessionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { RecordingService } from '../../recording/recording.service';
import { RecordingSegmentationService } from '../../recording/recording-segmentation.service';
import { TranscriptionService } from '../../transcription/transcription.service';
import {
  CoachingRecordingCandidatesInput,
  CoachingRecordingCandidatesPageDto,
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
  ReviewCoachingCriterionEvidenceInput,
  CoachingCriterionEvidenceDto,
  SalesPlanDto,
} from '../coaching.dto';
import { CoachingRecordingCatalogService } from '../domain/coaching-recording-catalog.service';
import { CoachingSalesPlanService } from '../domain/coaching-sales-plan.service';
import { CoachingVllmClient } from '../infrastructure/coaching-vllm-client.service';
import {
  buildTranscriptText,
  splitTranscriptIntoConversations,
  splitSegmentsIntoChunks,
  buildBlocksFromBoundaries,
} from '../utils/conversation-blocks.utils';
import {
  estimatePromptCharsApprox,
  truncateTranscriptForPrompt,
  resolveEvaluationMaxTokens,
  resolveRewriteMaxTokens,
  buildLlmSystemPrompt,
  buildLlmUserPrompt,
  parseLlmJson,
} from '../utils/coaching-llm-helpers.utils';
import {
  assertAdminOrDirecteur,
  assertSharedPlanAccess,
  cleanOptionalText,
  isUniqueConstraintError,
} from '../utils/coaching-common.utils';
import {
  evaluateWithFallback,
  completeEvaluationPayload,
} from '../utils/evaluation-fallback.utils';
import {
  DETECT_CHUNK_JSON_SCHEMA,
  DETECT_CHUNK_SYSTEM_PROMPT,
  REWRITE_SYSTEM_PROMPT,
  CLASSIFY_SYSTEM_PROMPT,
  CLASSIFY_JSON_SCHEMA,
  SESSION_EVALUATION_JSON_SCHEMA,
  COACHING_REMARKS_JSON_SCHEMA,
  COACHING_REMARKS_SYSTEM_PROMPT,
  APPLY_SALES_PLAN_JSON_SCHEMA,
  APPLY_SALES_PLAN_SYSTEM_PROMPT,
  EVIDENCE_EXTRACTION_JSON_SCHEMA,
  EVIDENCE_EXTRACTION_SYSTEM_PROMPT,
  EVIDENCE_PROMPT_VERSION,
  PLAN_APPLICATION_PROMPT_VERSION,
  REMARKS_PROMPT_VERSION,
  SCORING_SCHEMA_VERSION,
  buildApplySalesPlanUserPrompt,
  buildCoachingRemarksUserPrompt,
  buildEvidenceExtractionUserPrompt,
  buildClassifyUserPrompt,
  buildDetectChunkUserPrompt,
  buildRewriteUserPrompt,
} from '../utils/coaching-llm-prompts.constants';
import {
  aggregateConversationEvaluations,
  buildReadableTranscriptFromConversations,
} from '../utils/coaching-aggregation.utils';
import {
  cleanTranscriptNoiseForPrompt,
  prepareTranscriptForReadabilityPrompt,
} from '../utils/coaching-transcript-readability.utils';
import { cleanTranscriptForQuality } from '../utils/transcript-quality.utils';
import {
  isAutoCoachingEnabled,
  resolveAutoQueueSpeechMaxAttempts,
  resolveAutoQueueSpeechRetryMs,
  resolveConvClassifyEnabled,
  resolveConvClassifyMaxTokens,
  resolveDetectChunkChars,
  resolveEvaluationBatchSize,
  resolveMaxConversations,
  resolveMaxTranscriptPromptChars,
} from '../utils/coaching-env-resolvers.utils';
import { CoachingQueueService } from './coaching-queue.service';
import { CoachingSessionPersistenceService } from './coaching-session-persistence.service';
import { CoachingScoringEngineService } from '../scoring/coaching-scoring-engine.service';
import { ConversationQualityGateService } from '../scoring/conversation-quality-gate.service';
import { SalesPlanCriterionService } from '../scoring/sales-plan-criterion.service';
import {
  CriterionEvidencePayload,
  DeterministicScoringResult,
  EvidenceExtractionPayload,
  QualityGateResult,
  SalesPlanApplicationPayload,
  SalesPlanCriterionDefinition,
  SalesPlanStepApplicationPayload,
} from '../scoring/coaching-scoring.types';
import {
  normalizeText,
  normalizeTextArray,
  normalizeScore,
  normalizeNullableScore,
  normalizeNullableNumber,
  normalizeKeyMoment,
  normalizeCoverageStatus,
} from '../utils/evaluation-normalizers.utils';
import {
  mapSession,
  mapAnalysisJob,
  secondsSince,
} from '../utils/coaching-mapping.utils';
import {
  isAutoAnalysisEligible,
  scoreRecordingExploitability,
} from '../domain/coaching-recording-catalog.utils';

type CurrentUser = {
  id: number;
  role: string;
};

export const SESSION_FULL_INCLUDE =
  Prisma.validator<Prisma.CoachingSessionInclude>()({
    commercial: true,
    salesPlanVersion: { include: { salesPlan: true } },
    analysisJobs: { orderBy: { createdAt: 'desc' } },
    stepEvaluations: { orderBy: { ordre: 'asc' } },
    keyMoments: { orderBy: { startTime: 'asc' } },
    conversationEvaluations: {
      orderBy: { ordre: 'asc' },
      include: { criterionEvidences: { orderBy: { id: 'asc' } } },
    },
  });

export const SESSION_LIST_INCLUDE =
  Prisma.validator<Prisma.CoachingSessionInclude>()({
    commercial: true,
    salesPlanVersion: {
      select: {
        id: true,
        label: true,
        versionNumber: true,
        salesPlan: { select: { id: true, nom: true } },
      },
    },
    analysisJobs: { orderBy: { createdAt: 'desc' }, take: 1 },
  });

export type CoachingSessionWithFullRelations =
  Prisma.CoachingSessionGetPayload<{
    include: typeof SESSION_FULL_INCLUDE;
  }>;

export type CoachingSessionWithListRelations =
  Prisma.CoachingSessionGetPayload<{
    include: typeof SESSION_LIST_INCLUDE;
  }>;

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
  scoringMode?: string;
  scoringSchemaVersion?: string;
  evidencePromptVersion?: string;
  evaluationPromptVersion?: string;
  criterionEvidences?: CriterionEvidencePayload[];
};

type CoachingTranscriptPayload = {
  segments: Array<{
    start: number;
    end: number;
    text: string;
    type?: 'PROSPECT' | 'INTERNAL' | 'NOISE' | 'UNKNOWN';
    source?: string;
    confidence?: number;
    statut?: string | null;
    speechScore?: number | null;
  }>;
  duration: number;
  source:
    | 'WHISPER_FULL_RECORDING'
    | 'RECORDING_SEGMENTS'
    | 'RECORDING_CONVERSATION_SEGMENTS';
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
  segmentType?: 'PROSPECT' | 'INTERNAL' | 'NOISE' | 'UNKNOWN';
  segmentSource?: string | null;
  segmentConfidence?: number | null;
  segmentStatut?: string | null;
  speechScore?: number | null;
};

type ConversationDetectionSummary = {
  blocks: CoachingConversationBlock[];
  semanticDetectionUsed: boolean;
  detectedTotal: number;
  detectedProspect: number;
  detectedInternal: number;
  detectedNoise: number;
};

type SessionStatusContext = {
  status: 'COMPLETED' | 'NEEDS_REVIEW';
  reviewStatus: 'NOT_REQUIRED' | 'PENDING';
  reviewReason: string | null;
  confidenceScore: number;
  identificationSource: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

@Injectable()
export class CoachingEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CoachingEngineService.name);
  private readonly prefix = process.env.S3_PREFIX || 'recordings/';
  private readonly maxTranscriptPromptChars = resolveMaxTranscriptPromptChars();
  private readonly vllmContextWindowTokens = (() => {
    const raw = Number(process.env.VLLM_CONTEXT_WINDOW_TOKENS);
    return !Number.isFinite(raw) || raw < 2048 ? 24576 : Math.floor(raw);
  })();
  private readonly vllmTokensPerCharEstimate = 1 / 3.5;
  private readonly vllmContextSafetyMarginTokens = 500;
  private readonly autoQueueRetryTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RecordingService))
    private readonly recordingService: RecordingService,
    private readonly segmentationService: RecordingSegmentationService,
    private readonly recordingCatalogService: CoachingRecordingCatalogService,
    private readonly transcriptionService: TranscriptionService,
    private readonly salesPlanService: CoachingSalesPlanService,
    private readonly vllmClient: CoachingVllmClient,
    private readonly queueService: CoachingQueueService,
    private readonly persistenceService: CoachingSessionPersistenceService,
    private readonly criterionService: SalesPlanCriterionService,
    private readonly qualityGateService: ConversationQualityGateService,
    private readonly scoringEngineService: CoachingScoringEngineService,
  ) {}

  onModuleInit(): void {
    this.queueService.initialize((sessionId, jobId) =>
      this.processSession(sessionId, jobId),
    );
    this.queueService.start();
  }

  onModuleDestroy(): void {
    this.queueService.stop();
    for (const timer of this.autoQueueRetryTimers.values()) {
      clearTimeout(timer);
    }
    this.autoQueueRetryTimers.clear();
  }

  // Sales plan CRUD : délégation à CoachingSalesPlanService
  async getSalesPlans(currentUser: CurrentUser): Promise<SalesPlanDto[]> {
    return this.salesPlanService.getSalesPlans(currentUser);
  }

  async createSalesPlan(
    input: CreateSalesPlanInput,
    currentUser: CurrentUser,
  ): Promise<SalesPlanDto> {
    return this.salesPlanService.createSalesPlan(input, currentUser);
  }

  async createSalesPlanVersion(
    input: CreateSalesPlanVersionInput,
    currentUser: CurrentUser,
  ): Promise<SalesPlanDto> {
    return this.salesPlanService.createSalesPlanVersion(input, currentUser);
  }

  async publishSalesPlanVersion(
    versionId: number,
    currentUser: CurrentUser,
  ): Promise<SalesPlanDto> {
    return this.salesPlanService.publishSalesPlanVersion(
      versionId,
      currentUser,
    );
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
    assertAdminOrDirecteur(currentUser);

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
      items: sessions.map((session) => mapSession(session)),
      total,
      limit,
      offset,
    };
  }

  private buildCoachingSessionsWhere(
    input: CoachingSessionsInput | undefined,
    currentUser: CurrentUser,
  ): Prisma.CoachingSessionWhereInput {
    const andConditions: Prisma.CoachingSessionWhereInput[] = [];

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
      const searchConditions: Prisma.CoachingSessionWhereInput[] = [
        {
          commercial: {
            OR: [
              { nom: { contains: search, mode: 'insensitive' } },
              { prenom: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
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
        andConditions.push({ status: input.status as CoachingSessionStatus });
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
    assertAdminOrDirecteur(currentUser);
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
        concurrency: 1,
        oldestQueuedAgeSeconds: oldestQueued
          ? secondsSince(oldestQueued.queuedAt)
          : undefined,
      },
      jobs: jobs.map((job) => mapAnalysisJob(job)),
      total,
      limit,
      offset,
    };
  }

  async getCoachingSession(
    id: number,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    assertAdminOrDirecteur(currentUser);

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

    return mapSession(session, audioUrl);
  }

  async launchCoachingAnalysis(
    input: LaunchCoachingAnalysisInput,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    assertAdminOrDirecteur(currentUser);

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

    assertSharedPlanAccess(currentUser);
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
        return mapSession(queuedExistingSession ?? existingSession);
      }
      return mapSession(existingSession);
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
      if (isUniqueConstraintError(error)) {
        session = await this.findCoachingSessionByRecordingPlan(
          input.s3KeyOriginal,
          version.id,
        );
        if (session) {
          return mapSession(session);
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

    return mapSession(queuedSession ?? session!);
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

    if (!refreshed) {
      throw new NotFoundException('Session coaching introuvable');
    }

    return mapSession(refreshed);
  }

  async reviewCoachingSession(
    input: ReviewCoachingSessionInput,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    assertAdminOrDirecteur(currentUser);

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

    const updateData: Prisma.CoachingSessionUncheckedUpdateInput = {
      reviewNotes: cleanOptionalText(input.reviewNotes) ?? null,
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

    return mapSession(updated);
  }

  async reviewCoachingCriterionEvidence(
    input: ReviewCoachingCriterionEvidenceInput,
    currentUser: CurrentUser,
  ): Promise<CoachingCriterionEvidenceDto> {
    assertAdminOrDirecteur(currentUser);

    const evidence =
      await this.prisma.coachingCriterionEvidence.findUnique({
        where: { id: input.evidenceId },
        include: {
          coachingConversationEvaluation: {
            include: { coachingSession: { include: { commercial: true } } },
          },
        },
      });

    if (!evidence) {
      throw new NotFoundException('Preuve coaching introuvable');
    }

    await this.assertSessionAccess(
      evidence.coachingConversationEvaluation.coachingSession,
      currentUser,
    );

    const allowed = Object.values(CoachingEvidenceReviewStatus);
    const reviewStatus = String(input.reviewStatus || '').toUpperCase();
    if (!allowed.includes(reviewStatus as CoachingEvidenceReviewStatus)) {
      throw new ForbiddenException('Statut de revue invalide');
    }

    const updated = await this.prisma.coachingCriterionEvidence.update({
      where: { id: input.evidenceId },
      data: {
        reviewStatus: reviewStatus as CoachingEvidenceReviewStatus,
        reason: cleanOptionalText(input.reason) ?? evidence.reason,
      },
    });

    return {
      id: updated.id,
      stepOrder: updated.stepOrder,
      criterionKey: updated.criterionKey,
      criterionLabel: updated.criterionLabel,
      found: updated.found,
      quality: updated.quality,
      confidence: updated.confidence,
      verbatim: updated.verbatim ?? undefined,
      startTime: updated.startTime ?? undefined,
      endTime: updated.endTime ?? undefined,
      reason: updated.reason ?? undefined,
      reviewStatus: updated.reviewStatus,
    };
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
    if (!isAutoCoachingEnabled()) {
      return;
    }

    const speechScore = this.recordingService.getSpeechScores([
      s3KeyOriginal,
    ])[0];

    if (speechScore?.status !== 'ready') {
      if (attempt < resolveAutoQueueSpeechMaxAttempts()) {
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
        if (isUniqueConstraintError(error)) {
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
    }, resolveAutoQueueSpeechRetryMs());

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
  private async assertSessionAccess(
    session: {
      directeurId: number | null;
      commercial?: { directeurId: number | null } | null;
    },
    currentUser: CurrentUser,
  ): Promise<void> {
    assertAdminOrDirecteur(currentUser);
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

    this.queueService.triggerPump();
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
    const pipelineStartedAt = Date.now();
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

    await this.markSessionAsProcessing(sessionId);

    try {
      const transcript = await this.ensureTranscription(session, jobId);
      const roomName =
        session.roomName || this.extractRoomFromKey(session.s3KeyOriginal);
      const inferredCommercialId =
        session.commercialId ?? this.extractCommercialIdFromRoomName(roomName);
      const transcriptCacheHit = transcript.source === 'RECORDING_SEGMENTS';
      const statusContext = this.initializeSessionStatusContext(
        inferredCommercialId,
        transcript.source,
      );
      this.applySegmentationSourceToStatusContext(transcript, statusContext);
      const transcriptText = buildTranscriptText(transcript.segments);

      const detection = await this.ensureConversations(
        session,
        transcript,
        jobId,
      );
      await this.applyConversationDetectionOutcome(
        session.id,
        detection,
        statusContext,
        jobId,
      );

      const readableBlocks = await this.ensureReadableConversations(
        detection.blocks,
        jobId,
      );

      const conversationEvaluations = await this.ensureEvaluation(
        session.salesPlanVersion,
        readableBlocks,
        jobId,
      );
      const readableTranscriptText = buildReadableTranscriptFromConversations(
        conversationEvaluations,
        transcriptText,
      );
      await this.updateAnalysisJobStep(
        jobId,
        'Agrégation de l’évaluation globale',
      );
      const aggregated = aggregateConversationEvaluations(
        session.salesPlanVersion,
        conversationEvaluations,
      );
      const evaluation = await this.resolveSessionEvaluation(
        session,
        transcriptText,
        conversationEvaluations,
        aggregated,
        jobId,
      );
      this.applyFallbackReviewStatus(evaluation, statusContext);

      await this.updateAnalysisJobStep(jobId, 'Finalisation du rapport');
      await this.persistenceService.persistSessionAnalysis({
        session,
        transcript,
        transcriptText,
        readableTranscriptText,
        roomName,
        inferredCommercialId,
        evaluation,
        conversationEvaluations,
        statusContext,
        llmModel: this.vllmClient.model ?? null,
      });

      this.logPipelineMetrics({
        sessionId: session.id,
        pipelineStartedAt,
        transcriptCacheHit,
        transcript,
        transcriptText,
        detection,
        conversationEvaluations,
        aggregationUsed: aggregated !== null,
        finalStatus: statusContext.status,
        usedFallback: evaluation.usedFallback === true,
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
    }
  }

  private async markSessionAsProcessing(sessionId: number): Promise<void> {
    await this.prisma.coachingSession.update({
      where: { id: sessionId },
      data: { status: 'PROCESSING' },
    });
  }

  private initializeSessionStatusContext(
    inferredCommercialId: number | null | undefined,
    transcriptSource: CoachingTranscriptPayload['source'],
  ): SessionStatusContext {
    const context: SessionStatusContext = {
      status: 'COMPLETED',
      reviewStatus: 'NOT_REQUIRED',
      reviewReason: null,
      confidenceScore: inferredCommercialId ? 0.95 : 0.35,
      identificationSource: inferredCommercialId ? 'ROOM_NAME' : 'UNKNOWN',
    };

    if (
      transcriptSource === 'RECORDING_SEGMENTS' ||
      transcriptSource === 'RECORDING_CONVERSATION_SEGMENTS'
    ) {
      context.identificationSource =
        context.identificationSource === 'UNKNOWN'
          ? transcriptSource
          : `${context.identificationSource}+${transcriptSource}`;
    }

    if (!inferredCommercialId) {
      context.status = 'NEEDS_REVIEW';
      context.reviewStatus = 'PENDING';
      context.reviewReason =
        'Le commercial n’a pas pu être identifié automatiquement à partir de la room.';
    }

    return context;
  }

  private applySegmentationSourceToStatusContext(
    transcript: CoachingTranscriptPayload,
    context: SessionStatusContext,
  ): void {
    if (transcript.source !== 'RECORDING_CONVERSATION_SEGMENTS') {
      return;
    }

    const sources = Array.from(
      new Set(
        transcript.segments
          .map((segment) => segment.source)
          .filter((source): source is string => Boolean(source)),
      ),
    );
    if (sources.length === 0) {
      return;
    }

    const suffix = `SEGMENTATION_${sources.join('+')}`;
    context.identificationSource =
      context.identificationSource === 'UNKNOWN'
        ? suffix
        : `${context.identificationSource}+${suffix}`;
    if (sources.some((source) => source === 'AUDIO_TRANSCRIPT')) {
      context.status = 'NEEDS_REVIEW';
      context.reviewStatus = 'PENDING';
      context.reviewReason =
        context.reviewReason ??
        'Segmentation audio fallback sans événement porte, revue recommandée.';
      context.confidenceScore = Math.min(context.confidenceScore, 0.55);
    }
  }

  private async applyConversationDetectionOutcome(
    sessionId: number,
    detection: ConversationDetectionSummary,
    context: SessionStatusContext,
    jobId?: number,
  ): Promise<void> {
    if (!detection.semanticDetectionUsed || detection.blocks.length > 0) {
      return;
    }

    this.logger.warn(
      `Session ${sessionId}: aucune conversation prospect détectée (${detection.detectedTotal} bloc(s) classés non-prospect)`,
    );
    await this.updateAnalysisJobStep(
      jobId,
      'Aucune conversation prospect détectée',
    );
    context.status = 'NEEDS_REVIEW';
    context.reviewStatus = 'PENDING';
    context.reviewReason =
      'Aucune conversation prospect identifiée automatiquement. À valider manuellement.';
    context.confidenceScore = Math.min(context.confidenceScore, 0.5);
  }

  private async resolveSessionEvaluation(
    session: {
      id: number;
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
          id: number;
        }>;
      };
    },
    transcriptText: string,
    conversationEvaluations: Array<{
      block: CoachingConversationBlock;
      evaluation: SessionEvaluationPayload | null;
    }>,
    aggregated: SessionEvaluationPayload | null,
    jobId?: number,
  ): Promise<SessionEvaluationPayload> {
    if (aggregated) {
      const evaluation = completeEvaluationPayload(
        session.salesPlanVersion,
        aggregated,
        transcriptText,
      );
      this.logger.log(
        `Évaluation globale construite par agrégation de ${conversationEvaluations.filter((c) => c.evaluation).length}/${conversationEvaluations.length} conversations (session ${session.id})`,
      );
      return evaluation;
    }

    if (conversationEvaluations.length > 0) {
      const reviewReasons = conversationEvaluations
        .map((entry) => entry.block.reviewReason?.trim())
        .filter((reason): reason is string => Boolean(reason));
      const reason =
        reviewReasons[0] ??
        'Aucune conversation n’a une transcription assez fiable pour calculer un score.';
      return this.buildNonEvaluableEvaluation(session.salesPlanVersion, reason);
    }

    await this.updateAnalysisJobStep(
      jobId,
      'Évaluation globale IA (fallback — aucune conversation exploitable)',
    );
    const fallbackEvaluation = await this.evaluateTranscript(session.salesPlanVersion, {
      ordre: 1,
      title: 'Session complète',
      startTime: 0,
      endTime: 0,
      transcriptText,
      segmentsCount: 1,
      status: 'NEEDS_REVIEW',
      reviewReason:
        'Évaluation globale fallback, aucune conversation exploitable isolée.',
    });
    return (
      fallbackEvaluation ??
      this.buildNonEvaluableEvaluation(
        session.salesPlanVersion,
        'Le plan de vente n’a pas pu être appliqué automatiquement au transcript.',
      )
    );
  }

  private buildNonEvaluableEvaluation(
    salesPlanVersion: {
      steps: Array<{
        ordre: number;
        titre: string;
      }>;
    },
    reason: string,
  ): SessionEvaluationPayload {
    return {
      overallScore: null,
      planCoverageScore: null,
      executionQualityScore: null,
      objectionHandlingScore: null,
      listeningRatioScore: null,
      closingScore: null,
      summary: `Score non calculé: ${reason}`,
      strengths: [],
      improvements: ['Transcription insuffisante pour un coaching fiable.'],
      recommendations: [
        'Revoir l’audio ou relancer la transcription avant d’utiliser ce rapport pour évaluer le commercial.',
      ],
      keyMoments: [],
      stepEvaluations: salesPlanVersion.steps.map((step) => ({
        ordre: step.ordre,
        titre: step.titre,
        coverageStatus: 'MISSING',
        score: null,
        startTime: null,
        endTime: null,
        verbatim: null,
        feedback: 'Non évalué: transcription inexploitable.',
        recommendation: 'Valider la qualité audio/transcription avant scoring.',
      })),
      rawResponse: 'NON_EVALUABLE_TRANSCRIPT',
      usedFallback: true,
    };
  }

  private applyFallbackReviewStatus(
    evaluation: SessionEvaluationPayload,
    context: SessionStatusContext,
  ): void {
    if (!evaluation.usedFallback || context.status === 'NEEDS_REVIEW') {
      return;
    }

    context.status = 'NEEDS_REVIEW';
    context.reviewStatus = 'PENDING';
    context.reviewReason =
      evaluation.rawResponse === 'NON_EVALUABLE_TRANSCRIPT'
        ? (evaluation.summary ??
          'Transcription inexploitable, score non calculé.')
        : 'Le rapport a été calculé sans le LLM principal et nécessite une validation humaine.';
    context.confidenceScore = Math.min(context.confidenceScore, 0.7);
    context.identificationSource =
      context.identificationSource === 'UNKNOWN'
        ? 'FALLBACK'
        : `${context.identificationSource}+FALLBACK`;
  }

  private logPipelineMetrics(payload: {
    sessionId: number;
    pipelineStartedAt: number;
    transcriptCacheHit: boolean;
    transcript: CoachingTranscriptPayload;
    transcriptText: string;
    detection: ConversationDetectionSummary;
    conversationEvaluations: Array<{
      block: CoachingConversationBlock;
      evaluation: SessionEvaluationPayload | null;
    }>;
    aggregationUsed: boolean;
    finalStatus: 'COMPLETED' | 'NEEDS_REVIEW';
    usedFallback: boolean;
  }): void {
    try {
      const pipelineDurationMs = Date.now() - payload.pipelineStartedAt;
      const whisperDuration =
        payload.transcript.duration && payload.transcript.duration > 0
          ? payload.transcript.duration
          : 1;
      const whisperYieldCharsPerMin =
        (payload.transcriptText.length / whisperDuration) * 60;
      const evaluationsSuccess = payload.conversationEvaluations.filter(
        (c) => c.evaluation !== null,
      ).length;
      const evaluationsSkipped = payload.conversationEvaluations.filter(
        (c) => c.block.status === 'SKIPPED',
      ).length;
      const evaluationsFailed = payload.conversationEvaluations.filter(
        (c) => c.block.status === 'FAILED',
      ).length;

      this.logger.log(
        `pipeline.metrics sessionId=${payload.sessionId} ` +
          `pipelineMs=${pipelineDurationMs} ` +
          `transcriptCacheHit=${payload.transcriptCacheHit} ` +
          `whisperSegments=${payload.transcript.segments.length} ` +
          `whisperDurationSec=${Math.round(whisperDuration)} ` +
          `whisperYieldCharsPerMin=${Math.round(whisperYieldCharsPerMin)} ` +
          `detectionSemanticUsed=${payload.detection.semanticDetectionUsed} ` +
          `detectionTotal=${payload.detection.detectedTotal} ` +
          `detectionProspect=${payload.detection.detectedProspect} ` +
          `detectionInternal=${payload.detection.detectedInternal} ` +
          `detectionNoise=${payload.detection.detectedNoise} ` +
          `conversationsKept=${payload.detection.blocks.length} ` +
          `evaluationsSuccess=${evaluationsSuccess} ` +
          `evaluationsSkipped=${evaluationsSkipped} ` +
          `evaluationsFailed=${evaluationsFailed} ` +
          `aggregationUsed=${payload.aggregationUsed} ` +
          `finalStatus=${payload.finalStatus} ` +
          `usedFallback=${payload.usedFallback}`,
      );
    } catch (metricsErr: unknown) {
      const msg =
        (metricsErr as { message?: string })?.message ?? String(metricsErr);
      this.logger.warn(`pipeline.metrics log échoué: ${msg}`);
    }
  }

  private async ensureConversations(
    session: { id: number },
    transcript: CoachingTranscriptPayload,
    jobId?: number,
  ): Promise<{
    blocks: CoachingConversationBlock[];
    semanticDetectionUsed: boolean;
    detectedTotal: number;
    detectedProspect: number;
    detectedInternal: number;
    detectedNoise: number;
  }> {
    await this.updateAnalysisJobStep(
      jobId,
      'Stage 2 — Découpage en conversations',
    );

    if (transcript.source === 'RECORDING_CONVERSATION_SEGMENTS') {
      const canonicalBlocks =
        this.buildBlocksFromCanonicalConversationSegments(transcript);
      if (canonicalBlocks.length > 0) {
        const detectedInternal = transcript.segments.filter(
          (segment) => segment.type === 'INTERNAL',
        ).length;
        const detectedNoise = transcript.segments.filter(
          (segment) => segment.type === 'NOISE',
        ).length;
        const detectedProspect = transcript.segments.filter(
          (segment) =>
            segment.type === 'PROSPECT' || segment.type === 'UNKNOWN',
        ).length;

        this.logger.log(
          `Session ${session.id} — Stage 2: ${canonicalBlocks.length} conversation(s) depuis segmentation canonique (${detectedProspect} prospect/unknown, ${detectedInternal} internal, ${detectedNoise} noise)`,
        );
        return {
          blocks: canonicalBlocks,
          semanticDetectionUsed: false,
          detectedTotal: transcript.segments.length,
          detectedProspect,
          detectedInternal,
          detectedNoise,
        };
      }
    }

    const detectedBoundaries = await this.detectConversationsWithLlm(
      transcript,
      jobId,
    );
    const prospectBoundaries = detectedBoundaries.filter(
      (b) => b.type === 'prospect',
    );
    const detectedInternal = detectedBoundaries.filter(
      (b) => b.type === 'internal',
    ).length;
    const detectedNoise = detectedBoundaries.filter(
      (b) => b.type === 'noise',
    ).length;

    let blocks: CoachingConversationBlock[];
    let semanticDetectionUsed = false;

    if (detectedBoundaries.length > 0) {
      semanticDetectionUsed = true;
      blocks = buildBlocksFromBoundaries(
        prospectBoundaries,
        transcript.segments,
        resolveMaxConversations(),
      );
      this.logger.log(
        `Session ${session.id} — Stage 2: ${detectedBoundaries.length} bloc(s) détecté(s) (${prospectBoundaries.length} prospect, ${detectedInternal} internal, ${detectedNoise} noise) → ${blocks.length} conversation(s) à évaluer`,
      );
    } else {
      this.logger.warn(
        `Session ${session.id} — Stage 2: LLM détection indisponible, fallback heuristique`,
      );
      blocks = splitTranscriptIntoConversations(
        transcript.segments,
        resolveMaxConversations(),
      );
      this.logger.log(
        `Session ${session.id} — Stage 2: ${blocks.length} conversation(s) construite(s) (fallback heuristique)`,
      );
    }

    return {
      blocks,
      semanticDetectionUsed,
      detectedTotal: detectedBoundaries.length,
      detectedProspect: prospectBoundaries.length,
      detectedInternal,
      detectedNoise,
    };
  }

  private buildBlocksFromCanonicalConversationSegments(
    transcript: CoachingTranscriptPayload,
  ): CoachingConversationBlock[] {
    const maxConversations = resolveMaxConversations();
    return transcript.segments
      .filter((segment) => {
        const text = segment.text.trim();
        if (text.length === 0) {
          return false;
        }
        return segment.type !== 'INTERNAL' && segment.type !== 'NOISE';
      })
      .slice(0, maxConversations)
      .map((segment, index) => ({
        ordre: index + 1,
        title: `Conversation ${index + 1}`,
        startTime: segment.start,
        endTime: segment.end,
        transcriptText: segment.text.trim(),
        segmentsCount: 1,
        status:
          segment.type === 'UNKNOWN' || (segment.confidence ?? 1) < 0.7
            ? 'NEEDS_REVIEW'
            : 'COMPLETED',
        reviewReason:
          segment.type === 'UNKNOWN'
            ? 'Segment canonique non classifié, revue recommandée.'
            : (segment.confidence ?? 1) < 0.7
              ? 'Segment canonique à faible confiance.'
            : null,
        segmentType: segment.type,
        segmentSource: segment.source ?? null,
        segmentConfidence: segment.confidence ?? null,
        segmentStatut: segment.statut ?? null,
        speechScore: segment.speechScore ?? null,
      }));
  }

  private async ensureTranscription(
    session: { id: number; s3KeyOriginal: string },
    jobId?: number,
  ): Promise<CoachingTranscriptPayload> {
    const s3Key = session.s3KeyOriginal;

    let transcript = await this.loadTranscriptFromConversationSegments(s3Key);
    if (transcript) {
      await this.segmentationService.attachSegmentsToSession(
        s3Key,
        session.id,
      );
      const totalChars = transcript.segments.reduce(
        (sum, s) => sum + s.text.length,
        0,
      );
      this.logger.log(
        `Session ${session.id} — Stage 1: transcript depuis segmentation canonique (${transcript.segments.length} segments, ${totalChars} chars)`,
      );
      await this.updateAnalysisJobStep(
        jobId,
        `Segmentation canonique en cache (${transcript.segments.length} segments)`,
      );
      return transcript;
    }

    transcript = await this.loadTranscriptFromSegments(s3Key);
    if (transcript) {
      await this.segmentationService.syncFromRecordingSegments(s3Key);
      const canonicalTranscript =
        await this.loadTranscriptFromConversationSegments(s3Key);
      if (canonicalTranscript) {
        await this.segmentationService.attachSegmentsToSession(
          s3Key,
          session.id,
        );
        return canonicalTranscript;
      }

      const totalChars = transcript.segments.reduce(
        (sum, s) => sum + s.text.length,
        0,
      );
      this.logger.log(
        `Session ${session.id} — Stage 1: transcript depuis DB (${transcript.segments.length} segments, ${totalChars} chars)`,
      );
      await this.updateAnalysisJobStep(
        jobId,
        `Transcript en cache (${transcript.segments.length} segments)`,
      );
      return transcript;
    }

    this.logger.log(
      `Session ${session.id} — Stage 1: aucun segment en DB, déclenchement Analyse IA biblio (Whisper)`,
    );
    await this.updateAnalysisJobStep(
      jobId,
      'Analyse IA en cours (transcription Whisper + segmentation)',
    );
    const whisperResult = await this.transcriptionService.processRecording(s3Key);
    await this.segmentationService.ensureSegmentsForRecording(
      s3Key,
      whisperResult,
    );

    transcript = await this.loadTranscriptFromConversationSegments(s3Key);
    if (transcript) {
      await this.segmentationService.attachSegmentsToSession(
        s3Key,
        session.id,
      );
      const totalChars = transcript.segments.reduce(
        (sum, s) => sum + s.text.length,
        0,
      );
      this.logger.log(
        `Session ${session.id} — Stage 1: transcript généré depuis segmentation canonique (${transcript.segments.length} segments, ${totalChars} chars)`,
      );
      return transcript;
    }

    transcript = await this.loadTranscriptFromSegments(s3Key);
    if (!transcript) {
      throw new Error(
        "L'Analyse IA n'a produit aucun segment exploitable pour cet audio. Vérifier l'audio source.",
      );
    }
    const totalChars = transcript.segments.reduce(
      (sum, s) => sum + s.text.length,
      0,
    );
    this.logger.log(
      `Session ${session.id} — Stage 1: transcript généré (${transcript.segments.length} segments, ${totalChars} chars)`,
    );
    return transcript;
  }

  private async loadTranscriptFromConversationSegments(
    s3KeyOriginal: string,
  ): Promise<CoachingTranscriptPayload | null> {
    const segments =
      await this.segmentationService.getUsableSegmentsForCoaching(
        s3KeyOriginal,
      );

    const transcriptSegments = segments
      .map((segment) => ({
        start: segment.startTime,
        end: segment.endTime,
        text: segment.text?.trim() ?? '',
        type: segment.type as
          | 'PROSPECT'
          | 'INTERNAL'
          | 'NOISE'
          | 'UNKNOWN',
        source: segment.source,
        confidence: segment.confidence,
        statut: segment.statut ?? null,
        speechScore: segment.speechScore ?? null,
      }))
      .filter((segment) => segment.text.length > 0);

    if (transcriptSegments.length === 0) {
      return null;
    }

    return {
      segments: transcriptSegments,
      duration: Math.max(...transcriptSegments.map((segment) => segment.end)),
      source: 'RECORDING_CONVERSATION_SEGMENTS',
    };
  }

  private async loadTranscriptFromSegments(
    s3KeyOriginal: string,
  ): Promise<CoachingTranscriptPayload | null> {
    const segments = await this.prisma.recordingSegment.findMany({
      where: {
        s3KeyOriginal,
        transcription: { not: null },
      },
      select: {
        startTime: true,
        endTime: true,
        transcription: true,
      },
      orderBy: { startTime: 'asc' },
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

    return {
      segments: transcriptSegments,
      duration: Math.max(...transcriptSegments.map((segment) => segment.end)),
      source: 'RECORDING_SEGMENTS',
    };
  }

  private async detectConversationsWithLlm(
    transcript: CoachingTranscriptPayload,
    jobId?: number,
  ): Promise<
    Array<{
      startTime: number;
      endTime: number;
      type: 'prospect' | 'internal' | 'noise';
      reason: string;
    }>
  > {
    if (!this.vllmClient.isConfigured()) {
      this.logger.warn(
        'vLLM non configuré, détection sémantique des conversations désactivée',
      );
      return [];
    }

    const segments = transcript.segments
      .map((s) => ({ ...s, text: s.text.trim() }))
      .filter((s) => s.text.length > 0)
      .sort((a, b) => a.start - b.start);

    if (segments.length === 0) {
      return [];
    }

    const promptOverheadTokens = 1500;
    const outputTokens = 1800;
    const contextBudgetTokens =
      this.vllmContextWindowTokens -
      promptOverheadTokens -
      outputTokens -
      this.vllmContextSafetyMarginTokens;
    const contextBudgetChars = Math.floor(
      contextBudgetTokens / this.vllmTokensPerCharEstimate,
    );
    const chunkCharCap = resolveDetectChunkChars();
    const chunkBudgetChars = Math.max(
      4000,
      Math.min(chunkCharCap, contextBudgetChars),
    );

    const chunks = splitSegmentsIntoChunks(segments, chunkBudgetChars);
    if (chunks.length === 0) {
      return [];
    }

    type Conv = {
      startTime: number;
      endTime: number;
      type: 'prospect' | 'internal' | 'noise';
      reason: string;
    };
    type StreamState = {
      conversation_open: boolean;
      current_start_time: number | null;
      current_summary: string;
    };

    const closedConversations: Conv[] = [];
    let state: StreamState = {
      conversation_open: false,
      current_start_time: null,
      current_summary: '',
    };
    let failedChunks = 0;

    for (let i = 0; i < chunks.length; i += 1) {
      await this.updateAnalysisJobStep(
        jobId,
        `Détection conversations ${i + 1}/${chunks.length}`,
      );

      const isLast = i === chunks.length - 1;
      const result = await this.detectChunkConversations(
        chunks[i],
        state,
        isLast,
      );

      if (!result) {
        failedChunks += 1;
        state = {
          conversation_open: false,
          current_start_time: null,
          current_summary: '',
        };
        continue;
      }

      closedConversations.push(...result.closed_conversations);
      state = result.state;
    }

    if (state.conversation_open && state.current_start_time != null) {
      const lastTimestamp =
        segments[segments.length - 1]?.end ?? state.current_start_time;
      closedConversations.push({
        startTime: state.current_start_time,
        endTime: Math.max(lastTimestamp, state.current_start_time),
        type: 'prospect',
        reason: 'Conversation ouverte en fin de transcript (fermeture auto)',
      });
    }

    if (failedChunks === chunks.length) {
      this.logger.warn(
        `Détection sémantique totalement échouée (${failedChunks}/${chunks.length} chunks)`,
      );
      return [];
    }

    this.logger.log(
      `Détection sémantique terminée: ${closedConversations.length} conversations sur ${chunks.length} chunks (${failedChunks} chunk(s) en échec)`,
    );

    return closedConversations;
  }

  private async detectChunkConversations(
    chunkSegments: Array<{ start: number; end: number; text: string }>,
    state: {
      conversation_open: boolean;
      current_start_time: number | null;
      current_summary: string;
    },
    isLastChunk: boolean,
  ): Promise<{
    closed_conversations: Array<{
      startTime: number;
      endTime: number;
      type: 'prospect' | 'internal' | 'noise';
      reason: string;
    }>;
    state: {
      conversation_open: boolean;
      current_start_time: number | null;
      current_summary: string;
    };
  } | null> {
    const chunkText = buildTranscriptText(chunkSegments);

    const systemMessage = DETECT_CHUNK_SYSTEM_PROMPT;
    const userMessage = buildDetectChunkUserPrompt(
      JSON.stringify(state, null, 2),
      chunkText,
      isLastChunk,
    );

    const messages = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage },
    ];

    const promptCharsApprox = estimatePromptCharsApprox(messages);
    const promptTokensEstimate = Math.ceil(
      promptCharsApprox * this.vllmTokensPerCharEstimate,
    );
    const availableForOutput =
      this.vllmContextWindowTokens -
      promptTokensEstimate -
      this.vllmContextSafetyMarginTokens;
    const maxTokens = Math.max(800, Math.min(2000, availableForOutput));

    if (availableForOutput < 800) {
      this.logger.warn(
        `detect_conversations: prompt trop long (${promptTokensEstimate} tokens), skip chunk`,
      );
      return null;
    }

    const payload = {
      model: this.vllmClient.model,
      temperature: 0.1,
      max_tokens: maxTokens,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: DETECT_CHUNK_JSON_SCHEMA,
      },
    };

    const llmResult = await this.vllmClient.chat(payload, {
      step: 'detect_conversations',
    });
    if (!llmResult) return null;

    const parsed = parseLlmJson(llmResult.content);
    if (!parsed || typeof parsed !== 'object') {
      this.logger.warn('detect_conversations: JSON mal formé, chunk skippé');
      return null;
    }

    const parsedRecord = isRecord(parsed) ? parsed : {};
    const rawClosed = Array.isArray(parsedRecord.closed_conversations)
      ? parsedRecord.closed_conversations
      : [];

    const closed_conversations = rawClosed
      .map((candidate: unknown) => {
        const c = isRecord(candidate) ? candidate : {};
        const start = Number(c.startTime);
        const end = Number(c.endTime);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
          return null;
        }
        const typeRaw = String(c.type ?? '').toLowerCase();
        const type: 'prospect' | 'internal' | 'noise' =
          typeRaw === 'prospect'
            ? 'prospect'
            : typeRaw === 'internal'
              ? 'internal'
              : 'noise';
        const reason =
          typeof c.reason === 'string' ? c.reason.slice(0, 300) : '';
        return { startTime: start, endTime: end, type, reason };
      })
      .filter(
        (
          c: unknown,
        ): c is {
          startTime: number;
          endTime: number;
          type: 'prospect' | 'internal' | 'noise';
          reason: string;
        } => Boolean(c),
      );

    const rawState = isRecord(parsedRecord.state) ? parsedRecord.state : {};
    const newState = {
      conversation_open: Boolean(rawState.conversation_open),
      current_start_time: Number.isFinite(Number(rawState.current_start_time))
        ? Number(rawState.current_start_time)
        : null,
      current_summary:
        typeof rawState.current_summary === 'string'
          ? rawState.current_summary.slice(0, 300)
          : '',
    };

    return { closed_conversations, state: newState };
  }

  private async ensureReadableConversations(
    blocks: CoachingConversationBlock[],
    jobId?: number,
  ): Promise<CoachingConversationBlock[]> {
    if (blocks.length === 0) {
      return [];
    }

    const total = blocks.length;
    const batchSize = resolveEvaluationBatchSize();
    const results: CoachingConversationBlock[] = new Array(blocks.length);

    for (let start = 0; start < blocks.length; start += batchSize) {
      const end = Math.min(start + batchSize, blocks.length);
      await this.updateAnalysisJobStep(
        jobId,
        total === 1
          ? 'Stage 3 — Réécriture conversation 1/1'
          : `Stage 3 — Réécriture conversations ${start + 1}-${end}/${total}`,
      );

      const batchEntries = blocks
        .slice(start, end)
        .map((block, offset) => ({ block, idx: start + offset }));

      const settled = await Promise.allSettled(
        batchEntries.map(async ({ block }) => {
          const rewritten = await this.rewriteTranscriptForReadability(
            block.transcriptText,
          );
          return {
            ...block,
            readableTranscriptText: rewritten || block.transcriptText,
          };
        }),
      );

      for (let i = 0; i < settled.length; i += 1) {
        const entry = batchEntries[i];
        const outcome = settled[i];
        if (outcome.status === 'fulfilled') {
          results[entry.idx] = outcome.value;
        } else {
          this.logger.warn(
            `Stage 3: réécriture conv ${entry.block.ordre} échouée — garde transcript brut`,
          );
          results[entry.idx] = {
            ...entry.block,
            readableTranscriptText: entry.block.transcriptText,
          };
        }
      }
    }

    this.logger.log(
      `Stage 3 terminé: ${blocks.length} conversation(s) réécrite(s)`,
    );
    return results;
  }

  private async ensureEvaluation(
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
        id?: number;
      }>;
    },
    blocks: CoachingConversationBlock[],
    jobId?: number,
  ): Promise<
    Array<{
      block: CoachingConversationBlock;
      evaluation: SessionEvaluationPayload | null;
    }>
  > {
    const results: Array<{
      block: CoachingConversationBlock;
      evaluation: SessionEvaluationPayload | null;
    }> = new Array(blocks.length);

    const total = blocks.length;
    const batchSize = resolveEvaluationBatchSize();

    const evalOne = async (
      block: CoachingConversationBlock,
    ): Promise<{
      block: CoachingConversationBlock;
      evaluation: SessionEvaluationPayload | null;
    }> => {
      if (block.status === 'SKIPPED') {
        return { block, evaluation: null };
      }
      const cleanedTranscript = cleanTranscriptForQuality(block.transcriptText);
      const evaluationBlock: CoachingConversationBlock = {
        ...block,
        transcriptText: cleanedTranscript.cleanedText || block.transcriptText,
        readableTranscriptText:
          cleanedTranscript.cleanedText || block.readableTranscriptText,
      };
      const qualityGate = this.qualityGateService.evaluate({
        status: evaluationBlock.segmentStatut,
        type: evaluationBlock.segmentType,
        source: evaluationBlock.segmentSource,
        confidence: evaluationBlock.segmentConfidence,
        speechScore: evaluationBlock.speechScore,
        durationSec: Math.max(0, evaluationBlock.endTime - evaluationBlock.startTime),
        transcriptText: evaluationBlock.transcriptText,
      });
      const qualityReason = qualityGate.reasons.join(' ');
      if (
        qualityGate.decision === 'SKIP' ||
        qualityGate.decision === 'REVIEW_ONLY'
      ) {
        return {
          block: {
            ...evaluationBlock,
            status:
              qualityGate.decision === 'SKIP' ? 'SKIPPED' : 'NEEDS_REVIEW',
            reviewReason:
              qualityReason ||
              'Transcription insuffisante pour une évaluation fiable.',
          },
          evaluation: null,
        };
      }

      try {
        const classifyResult = resolveConvClassifyEnabled()
          ? await this.classifyConversation(
              salesPlanVersion,
              evaluationBlock.transcriptText,
            )
          : null;
        const effectivePlan = classifyResult
          ? this.filterPlanByStepOrders(
              salesPlanVersion,
              classifyResult.applicableStepOrders,
            )
          : salesPlanVersion;
        const evaluation = await this.evaluateTranscript(
          effectivePlan,
          evaluationBlock,
        );
        if (!evaluation) {
          return {
            block: {
              ...evaluationBlock,
              status: 'NEEDS_REVIEW',
              reviewReason:
                'Le plan de vente n’a pas pu être appliqué automatiquement à cette conversation.',
            },
            evaluation: null,
          };
        }
        return { block: evaluationBlock, evaluation };
      } catch (error: unknown) {
        const msg = (error as { message?: string })?.message ?? String(error);
        this.logger.warn(
          `Stage 4: évaluation conv ${evaluationBlock.ordre} impossible: ${msg}`,
        );
        return {
          block: {
            ...evaluationBlock,
            status: 'FAILED',
            reviewReason:
              'Cette conversation n’a pas pu être évaluée, mais la session globale continue.',
          },
          evaluation: null,
        };
      }
    };

    for (let start = 0; start < blocks.length; start += batchSize) {
      const end = Math.min(start + batchSize, blocks.length);
      await this.updateAnalysisJobStep(
        jobId,
        total === 1
          ? 'Stage 4 — Évaluation conversation 1/1'
          : `Stage 4 — Évaluation conversations ${start + 1}-${end}/${total}`,
      );

      const batchEntries = blocks
        .slice(start, end)
        .map((block, offset) => ({ block, idx: start + offset }));

      const settled = await Promise.allSettled(
        batchEntries.map((entry) => evalOne(entry.block)),
      );

      for (let i = 0; i < settled.length; i += 1) {
        const entry = batchEntries[i];
        const outcome = settled[i];
        if (outcome.status === 'fulfilled') {
          results[entry.idx] = outcome.value;
        } else {
          this.logger.warn(
            `Stage 4: éval conv ${entry.block.ordre} rejet: ${outcome.reason?.message || outcome.reason}`,
          );
          results[entry.idx] = {
            block: {
              ...entry.block,
              status: 'FAILED',
              reviewReason:
                'Cette conversation n’a pas pu être évaluée (exception non gérée).',
            },
            evaluation: null,
          };
        }
      }
    }

    const success = results.filter((r) => r.evaluation !== null).length;
    this.logger.log(
      `Stage 4 terminé: ${success}/${blocks.length} évaluation(s) réussie(s)`,
    );
    return results;
  }

  private async evaluateTranscript(
    salesPlanVersion: {
      id: number;
      label: string | null;
      promptInstructions: string | null;
      steps: Array<{
        id?: number;
        ordre: number;
        titre: string;
        description: string | null;
        expectedSignals: string | null;
        poids: number;
      }>;
    },
    block: CoachingConversationBlock,
  ): Promise<SessionEvaluationPayload | null> {
    if (this.resolveScoringMode() === 'evidence') {
      return this.evaluateTranscriptWithEvidence(
        salesPlanVersion,
        block,
      );
    }

    const transcriptText = block.transcriptText;
    const llmEvaluation = await this.evaluateWithLlm(
      salesPlanVersion,
      transcriptText,
    );

    if (llmEvaluation) {
      return completeEvaluationPayload(
        salesPlanVersion,
        { ...llmEvaluation, usedFallback: false },
        transcriptText,
      );
    }

    return completeEvaluationPayload(
      salesPlanVersion,
      evaluateWithFallback(salesPlanVersion, transcriptText),
      transcriptText,
    );
  }

  private async evaluateTranscriptWithEvidence(
    salesPlanVersion: {
      id: number;
      label: string | null;
      promptInstructions: string | null;
      steps: Array<{
        id?: number;
        ordre: number;
        titre: string;
        description: string | null;
        expectedSignals: string | null;
        poids: number;
      }>;
    },
    block: CoachingConversationBlock,
  ): Promise<SessionEvaluationPayload | null> {
    const qualityGate = this.qualityGateService.evaluate({
      status: block.segmentStatut,
      type: block.segmentType,
      source: block.segmentSource,
      confidence: block.segmentConfidence,
      speechScore: block.speechScore,
      durationSec: Math.max(0, block.endTime - block.startTime),
      transcriptText: block.transcriptText,
    });

    if (qualityGate.decision === 'SKIP') {
      return null;
    }

    const application = await this.applySalesPlanWithLlm({
      block,
      salesPlanVersion,
      status: block.segmentStatut,
      qualityGate,
    });

    if (!application || application.steps.length === 0) {
      return null;
    }

    const observedSteps = application.steps.filter((step) => step.observed);
    if (observedSteps.length === 0) {
      this.logger.warn(
        `apply_sales_plan: aucune étape observée pour conversation ${block.ordre}`,
      );
      return null;
    }

    const scoring = this.scoringEngineService.calculateFromStepApplication({
      salesPlanSteps: salesPlanVersion.steps,
      application,
      qualityGateReviewReasons:
        qualityGate.decision === 'EVALUATE_WITH_REVIEW' ||
        qualityGate.decision === 'REVIEW_ONLY'
          ? qualityGate.reasons
          : [],
    });

    const criterionEvidences = this.buildCriterionEvidencesFromStepApplication(
      application,
      salesPlanVersion.steps,
      block.startTime,
    );

    const evidenceEvaluation: SessionEvaluationPayload = {
      overallScore: scoring.overallScore,
      planCoverageScore: scoring.planCoverageScore,
      executionQualityScore: scoring.executionQualityScore,
      objectionHandlingScore: scoring.objectionHandlingScore,
      listeningRatioScore: scoring.listeningRatioScore,
      closingScore: scoring.closingScore,
      summary:
        application.conversationSummary ??
        this.buildStepApplicationSummary(scoring, application),
      strengths: scoring.strengths,
      improvements: scoring.improvements,
      recommendations: scoring.recommendations,
      keyMoments: application.keyMoments.map((event) => ({
        type: event.type,
        title: event.title ?? event.type,
        summary: event.summary,
        startTime: this.normalizeApplicationTime(event.startTime, block.startTime),
        endTime: this.normalizeApplicationTime(event.endTime, block.startTime),
        verbatim: event.verbatim,
        importance: event.importance,
      })),
      stepEvaluations: scoring.stepEvaluations,
      rawResponse: application.rawResponse,
      usedFallback: false,
      scoringMode: 'step_application',
      scoringSchemaVersion: SCORING_SCHEMA_VERSION,
      evidencePromptVersion: PLAN_APPLICATION_PROMPT_VERSION,
      evaluationPromptVersion: REMARKS_PROMPT_VERSION,
      criterionEvidences,
    };

    return {
      ...completeEvaluationPayload(
        salesPlanVersion,
        evidenceEvaluation,
        block.transcriptText,
      ),
      scoringMode: evidenceEvaluation.scoringMode,
      scoringSchemaVersion: evidenceEvaluation.scoringSchemaVersion,
      evidencePromptVersion: evidenceEvaluation.evidencePromptVersion,
      evaluationPromptVersion: evidenceEvaluation.evaluationPromptVersion,
      criterionEvidences: evidenceEvaluation.criterionEvidences,
    };
  }

  private async applySalesPlanWithLlm(input: {
    block: CoachingConversationBlock;
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
    };
    status?: string | null;
    qualityGate: QualityGateResult;
  }): Promise<SalesPlanApplicationPayload | null> {
    if (!this.vllmClient.isConfigured()) {
      return null;
    }

    const result = await this.vllmClient.chat(
      {
        model: this.vllmClient.model,
        temperature: 0.2,
        max_tokens: 2400,
        messages: [
          { role: 'system', content: APPLY_SALES_PLAN_SYSTEM_PROMPT },
          {
            role: 'user',
            content: buildApplySalesPlanUserPrompt({
              transcriptText: truncateTranscriptForPrompt(
                input.block.transcriptText,
                this.maxTranscriptPromptChars,
              ),
              status: input.status,
              segmentMetadata: {
                startTime: input.block.startTime,
                endTime: input.block.endTime,
                durationSec: input.block.endTime - input.block.startTime,
                source: input.block.segmentSource,
                type: input.block.segmentType,
                confidence: input.block.segmentConfidence,
                speechScore: input.block.speechScore,
                qualityGate: input.qualityGate,
              },
              salesPlan: {
                label: input.salesPlanVersion.label,
                promptInstructions: input.salesPlanVersion.promptInstructions,
                steps: input.salesPlanVersion.steps,
              },
            }),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: APPLY_SALES_PLAN_JSON_SCHEMA,
        },
      },
      { step: 'apply_sales_plan' },
    );
    if (!result) return null;

    const parsed = parseLlmJson(result.content);
    if (!isRecord(parsed)) {
      this.logger.warn(
        `apply_sales_plan: JSON invalide ou non objet. raw="${result.content.slice(0, 1200)}"`,
      );
      return null;
    }

    const normalized = this.normalizeSalesPlanApplication(
      parsed,
      input.salesPlanVersion.steps,
      result.content,
    );
    if (normalized.steps.length === 0) {
      this.logger.warn('apply_sales_plan: aucune étape exploitable retournée');
      return null;
    }

    this.logger.log(
      `apply_sales_plan: ${normalized.steps.filter((step) => step.observed).length}/${input.salesPlanVersion.steps.length} étape(s) observée(s), uncertainties=${normalized.uncertainties.length}`,
    );
    return normalized;
  }

  private normalizeSalesPlanApplication(
    raw: Record<string, unknown>,
    salesPlanSteps: Array<{
      ordre: number;
      titre: string;
    }>,
    rawResponse: string,
  ): SalesPlanApplicationPayload {
    const stepOrders = new Set(salesPlanSteps.map((step) => step.ordre));
    const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
    const steps = rawSteps
      .map((item): SalesPlanStepApplicationPayload | null => {
        if (!isRecord(item)) return null;
        const stepOrder = Number(item.stepOrder);
        if (!Number.isFinite(stepOrder) || !stepOrders.has(stepOrder)) {
          return null;
        }
        const observed = Boolean(item.observed);
        const evidence = Array.isArray(item.evidence)
          ? item.evidence
              .map((evidenceItem) => {
                if (!isRecord(evidenceItem)) return null;
                const verbatim = normalizeText(evidenceItem.verbatim);
                if (!verbatim) return null;
                return {
                  verbatim,
                  startTime: normalizeNullableNumber(evidenceItem.startTime),
                  endTime: normalizeNullableNumber(evidenceItem.endTime),
                  reason: normalizeText(evidenceItem.reason),
                };
              })
              .filter(
                (
                  evidenceItem,
                ): evidenceItem is {
                  verbatim: string;
                  startTime: number | null;
                  endTime: number | null;
                  reason: string | null;
                } => Boolean(evidenceItem),
              )
          : [];
        return {
          stepOrder,
          stepTitle: normalizeText(item.stepTitle),
          observed,
          quality: this.normalizeApplicationQuality(item.quality, observed),
          confidence: this.normalizeConfidence(item.confidence),
          evidence,
          whatWentWell: normalizeTextArray(item.whatWentWell),
          whatIsMissing: normalizeTextArray(item.whatIsMissing),
          coachingAdvice: normalizeTextArray(item.coachingAdvice),
          reasoning: normalizeText(item.reasoning),
        };
      })
      .filter(
        (step): step is SalesPlanStepApplicationPayload => Boolean(step),
      );

    return {
      conversationSummary: normalizeText(raw.conversationSummary),
      steps,
      keyMoments: Array.isArray(raw.keyMoments)
        ? raw.keyMoments
            .map((item) => {
              if (!isRecord(item)) return null;
              const type = normalizeText(item.type) ?? 'A_REVOIR';
              return {
                type,
                title: normalizeText(item.title),
                summary: normalizeText(item.summary),
                verbatim: normalizeText(item.verbatim),
                startTime: normalizeNullableNumber(item.startTime),
                endTime: normalizeNullableNumber(item.endTime),
                importance: normalizeNullableNumber(item.importance),
              };
            })
            .filter(
              (
                item,
              ): item is {
                type: string;
                title: string | null;
                summary: string | null;
                verbatim: string | null;
                startTime: number | null;
                endTime: number | null;
                importance: number | null;
              } => Boolean(item),
            )
        : [],
      strengths: normalizeTextArray(raw.strengths),
      improvements: normalizeTextArray(raw.improvements),
      recommendations: normalizeTextArray(raw.recommendations),
      uncertainties: normalizeTextArray(raw.uncertainties),
      rawResponse,
    };
  }

  private buildCriterionEvidencesFromStepApplication(
    application: SalesPlanApplicationPayload,
    salesPlanSteps: Array<{
      ordre: number;
      titre: string;
    }>,
    blockStartTime: number,
  ): CriterionEvidencePayload[] {
    const titleByOrder = new Map(
      salesPlanSteps.map((step) => [step.ordre, step.titre]),
    );
    return application.steps.map((step) => {
      const evidence = step.evidence[0];
      const verbatim = normalizeText(evidence?.verbatim);
      const found = step.observed && Boolean(verbatim);
      return {
        salesPlanStepId: null,
        salesPlanCriterionId: null,
        stepOrder: step.stepOrder,
        criterionKey: `step_${step.stepOrder}`,
        criterionLabel:
          titleByOrder.get(step.stepOrder) ??
          step.stepTitle ??
          `Étape ${step.stepOrder}`,
        found,
        quality: found ? step.quality : 'MISSING',
        confidence: step.confidence,
        verbatim: found ? verbatim : null,
        startTime: this.normalizeApplicationTime(
          evidence?.startTime,
          blockStartTime,
        ),
        endTime: this.normalizeApplicationTime(evidence?.endTime, blockStartTime),
        reason:
          evidence?.reason ??
          step.reasoning ??
          (found
            ? 'Étape observée dans le transcript.'
            : 'Étape non observée dans le transcript.'),
        reviewStatus: step.confidence < 0.55 ? 'PENDING' : 'NOT_REQUIRED',
      };
    });
  }

  private buildStepApplicationSummary(
    scoring: DeterministicScoringResult,
    application: SalesPlanApplicationPayload,
  ): string {
    const observed = application.steps.filter((step) => step.observed).length;
    const total = application.steps.length;
    const uncertainty = application.uncertainties.length
      ? ` Incertitudes: ${application.uncertainties.slice(0, 2).join(' ')}`
      : '';
    return `Plan de vente appliqué à la conversation: ${observed}/${total} étape(s) observée(s), score backend ${scoring.overallScore}/100.${uncertainty}`;
  }

  private normalizeApplicationQuality(
    value: unknown,
    observed: boolean,
  ): 'MISSING' | 'WEAK' | 'PARTIAL' | 'COMPLETE' {
    if (!observed) return 'MISSING';
    if (
      value === 'COMPLETE' ||
      value === 'PARTIAL' ||
      value === 'WEAK' ||
      value === 'MISSING'
    ) {
      return value;
    }
    return 'PARTIAL';
  }

  private normalizeConfidence(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0.6;
    return Math.max(0, Math.min(1, numeric));
  }

  private normalizeApplicationTime(
    value: number | null | undefined,
    blockStartTime: number,
  ): number | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return numeric < blockStartTime && numeric < 600
      ? Number((numeric + blockStartTime).toFixed(2))
      : Number(numeric.toFixed(2));
  }

  private async extractEvidenceWithLlm(input: {
    block: CoachingConversationBlock;
    criteria: SalesPlanCriterionDefinition[];
    status?: string | null;
    qualityGate: QualityGateResult;
  }): Promise<EvidenceExtractionPayload | null> {
    if (!this.vllmClient.isConfigured()) {
      return null;
    }

    const messages = [
      { role: 'system', content: EVIDENCE_EXTRACTION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildEvidenceExtractionUserPrompt({
          transcriptText: truncateTranscriptForPrompt(
            input.block.transcriptText,
            this.maxTranscriptPromptChars,
          ),
          status: input.status,
          segmentMetadata: {
            startTime: input.block.startTime,
            endTime: input.block.endTime,
            durationSec: input.block.endTime - input.block.startTime,
            source: input.block.segmentSource,
            type: input.block.segmentType,
            confidence: input.block.segmentConfidence,
            speechScore: input.block.speechScore,
            qualityGate: input.qualityGate,
          },
          criteria: input.criteria,
        }),
      },
    ];

    const result = await this.vllmClient.chat(
      {
        model: this.vllmClient.model,
        temperature: 0.1,
        max_tokens: 2500,
        messages,
        response_format: {
          type: 'json_schema',
          json_schema: EVIDENCE_EXTRACTION_JSON_SCHEMA,
        },
      },
      { step: 'extract_evidence' },
    );
    if (!result) return null;

    const parsed = parseLlmJson(result.content);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const parsedRecord = isRecord(parsed) ? parsed : {};
    return {
      segmentQuality: isRecord(parsedRecord.segmentQuality)
        ? parsedRecord.segmentQuality
        : undefined,
      criteriaEvidence: Array.isArray(parsedRecord.criteriaEvidence)
        ? parsedRecord.criteriaEvidence
        : [],
      keyEvents: Array.isArray(parsedRecord.keyEvents) ? parsedRecord.keyEvents : [],
      uncertainties: Array.isArray(parsedRecord.uncertainties)
        ? parsedRecord.uncertainties.filter(
            (uncertainty): uncertainty is string =>
              typeof uncertainty === 'string',
          )
        : [],
      rawResponse: result.content,
    };
  }

  private async generateEvidenceBasedRemarks(input: {
    status?: string | null;
    scoring: DeterministicScoringResult;
    evidence: EvidenceExtractionPayload;
  }): Promise<{
    summary?: string | null;
    strengths: string[];
    improvements: string[];
    recommendations: string[];
  } | null> {
    if (!this.vllmClient.isConfigured()) {
      return null;
    }

    const result = await this.vllmClient.chat(
      {
        model: this.vllmClient.model,
        temperature: 0.2,
        max_tokens: 1600,
        messages: [
          { role: 'system', content: COACHING_REMARKS_SYSTEM_PROMPT },
          {
            role: 'user',
            content: buildCoachingRemarksUserPrompt({
              status: input.status,
              scores: {
                overallScore: input.scoring.overallScore,
                stepEvaluations: input.scoring.stepEvaluations,
                reviewRequired: input.scoring.reviewRequired,
                reviewReason: input.scoring.reviewReason,
              },
              evidence: {
                criteriaEvidence: input.evidence.criteriaEvidence,
                keyEvents: input.evidence.keyEvents,
                uncertainties: input.evidence.uncertainties,
              },
            }),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: COACHING_REMARKS_JSON_SCHEMA,
        },
      },
      { step: 'generate_evidence_remarks' },
    );
    if (!result) return null;
    const parsed = parseLlmJson(result.content);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const parsedRecord = isRecord(parsed) ? parsed : {};
    return {
      summary: normalizeText(parsedRecord.summary),
      strengths: normalizeTextArray(parsedRecord.strengths),
      improvements: normalizeTextArray(parsedRecord.improvements),
      recommendations: [
        ...normalizeTextArray(parsedRecord.recommendations),
        ...normalizeTextArray(parsedRecord.trainingActions),
      ].slice(0, 8),
    };
  }

  private buildMissingEvidencePayload(
    criteria: SalesPlanCriterionDefinition[],
    reason: string,
  ): EvidenceExtractionPayload {
    return {
      segmentQuality: { evaluable: false, reason, confidence: 0.3 },
      criteriaEvidence: criteria.map((criterion) => ({
        salesPlanStepId: criterion.salesPlanStepId ?? null,
        salesPlanCriterionId: criterion.id ?? null,
        stepOrder: criterion.stepOrder,
        criterionKey: criterion.key,
        criterionLabel: criterion.label,
        found: false,
        quality: 'MISSING',
        confidence: 0.8,
        verbatim: null,
        startTime: null,
        endTime: null,
        reason,
      })) as CriterionEvidencePayload[],
      keyEvents: [],
      uncertainties: [reason],
    };
  }

  private buildEvidenceSummary(
    scoring: { overallScore: number; reviewRequired: boolean; reviewReason?: string | null },
    qualityGate: QualityGateResult,
  ): string {
    const review = scoring.reviewRequired
      ? ` Revue recommandée: ${scoring.reviewReason || qualityGate.reasons.join(' ')}`
      : '';
    return `Score calculé à partir des preuves observables (${scoring.overallScore}/100).${review}`;
  }

  private resolveScoringMode(): 'legacy' | 'evidence' {
    return process.env.COACHING_SCORING_MODE === 'legacy'
      ? 'legacy'
      : 'evidence';
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
    if (!this.vllmClient.isConfigured()) {
      return null;
    }

    const messages = [
      {
        role: 'system',
        content: REWRITE_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: buildRewriteUserPrompt(
          truncateTranscriptForPrompt(
            prepareTranscriptForReadabilityPrompt(transcriptText),
            this.maxTranscriptPromptChars,
          ),
        ),
      },
    ];

    const promptCharsApprox = estimatePromptCharsApprox(messages);
    const maxTokens = resolveRewriteMaxTokens(promptCharsApprox, {
      contextWindowTokens: this.vllmContextWindowTokens,
      tokensPerCharEstimate: this.vllmTokensPerCharEstimate,
      safetyMarginTokens: this.vllmContextSafetyMarginTokens,
    });

    if (maxTokens < 800) {
      this.logger.warn(
        `rewrite_transcript: prompt trop long (${promptCharsApprox} chars ≈ ${Math.ceil(promptCharsApprox * this.vllmTokensPerCharEstimate)} tokens) pour ${this.vllmContextWindowTokens} tokens de contexte. Skip rewrite.`,
      );
      return null;
    }

    const payload = {
      model: this.vllmClient.model,
      temperature: 0,
      max_tokens: maxTokens,
      messages,
    };

    const result = await this.vllmClient.chat(payload, {
      step: 'rewrite_transcript',
    });
    if (!result) {
      return null;
    }
    return this.normalizeReadableTranscript(result.content);
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

  private filterPlanByStepOrders<
    T extends {
      steps: Array<{
        ordre: number;
        titre: string;
        description: string | null;
        expectedSignals: string | null;
        poids: number;
      }>;
    },
  >(salesPlanVersion: T, applicableStepOrders: number[]): T {
    const allowed = new Set(applicableStepOrders);
    return {
      ...salesPlanVersion,
      steps: salesPlanVersion.steps.filter((step) => allowed.has(step.ordre)),
    };
  }

  private async classifyConversation(
    salesPlanVersion: {
      steps: Array<{
        ordre: number;
        titre: string;
        expectedSignals: string | null;
      }>;
    },
    transcriptText: string,
  ): Promise<{
    type: string;
    applicableStepOrders: number[];
    reason: string;
  } | null> {
    if (!this.vllmClient.isConfigured()) {
      return null;
    }
    if (!transcriptText.trim()) {
      return null;
    }

    const SHORT_THRESHOLD = 10_000;
    const WINDOW_CHARS = 700;
    let snippet: string;
    if (transcriptText.length <= SHORT_THRESHOLD) {
      const head = transcriptText.slice(0, WINDOW_CHARS);
      const tail =
        transcriptText.length > WINDOW_CHARS * 2
          ? '\n[...]\n' + transcriptText.slice(-WINDOW_CHARS)
          : '';
      snippet = head + tail;
    } else {
      const len = transcriptText.length;
      const w = WINDOW_CHARS;
      const half = Math.floor(w / 2);
      const startPositions = [
        0,
        Math.max(w, Math.floor(len * 0.25) - half),
        Math.max(w, Math.floor(len * 0.5) - half),
        Math.max(w, Math.floor(len * 0.75) - half),
      ];
      const windows = startPositions.map((pos, idx) => {
        const chunk = transcriptText.slice(pos, pos + w);
        const label = ['debut', 'quart', 'mi-parcours', 'trois-quart'][idx];
        return `[fenêtre ${label}]\n${chunk}`;
      });
      const tail = `[fenêtre fin]\n${transcriptText.slice(-w)}`;
      snippet = [...windows, tail].join('\n[...]\n');
    }

    const stepsList = salesPlanVersion.steps
      .map(
        (step) =>
          `${step.ordre}. ${step.titre}${step.expectedSignals ? ' — ' + step.expectedSignals.slice(0, 180) : ''}`,
      )
      .join('\n');

    const messages = [
      {
        role: 'system',
        content: CLASSIFY_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: buildClassifyUserPrompt(stepsList, snippet),
      },
    ];

    const payload = {
      model: this.vllmClient.model,
      temperature: 0,
      max_tokens: resolveConvClassifyMaxTokens(),
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: CLASSIFY_JSON_SCHEMA,
      },
    };

    const result = await this.vllmClient.chat(payload, {
      step: 'conv_classify',
    });
    if (!result) {
      return null;
    }

    const parsed = parseLlmJson(result.content);
    if (
      !isRecord(parsed) ||
      typeof parsed.type !== 'string' ||
      !Array.isArray(parsed.applicableStepOrders)
    ) {
      return null;
    }

    const validOrders = new Set(
      salesPlanVersion.steps.map((step) => step.ordre),
    );
    const filtered: number[] = (parsed.applicableStepOrders as unknown[])
      .map((order) => Number(order))
      .filter((order) => Number.isFinite(order) && validOrders.has(order));

    if (filtered.length === 0) {
      this.logger.warn(
        `conv_classify type=${parsed.type} a renvoyé 0 phase applicable — bascule sur plan complet`,
      );
      return {
        type: parsed.type,
        applicableStepOrders: [...validOrders],
        reason: typeof parsed.reason === 'string' ? parsed.reason : '',
      };
    }

    const uniqueSorted = Array.from(new Set(filtered)).sort((a, b) => a - b);
    this.logger.log(
      `conv_classify type=${parsed.type} applicable=[${uniqueSorted.join(',')}] reason="${(typeof parsed.reason === 'string' ? parsed.reason : '').slice(0, 100)}"`,
    );

    return {
      type: parsed.type,
      applicableStepOrders: uniqueSorted,
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    };
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
    if (!this.vllmClient.isConfigured()) {
      return null;
    }

    const messages = [
      {
        role: 'system',
        content: buildLlmSystemPrompt(salesPlanVersion),
      },
      {
        role: 'user',
        content: buildLlmUserPrompt(
          truncateTranscriptForPrompt(
            transcriptText,
            this.maxTranscriptPromptChars,
          ),
        ),
      },
    ];

    const promptCharsApprox = estimatePromptCharsApprox(messages);
    const maxTokens = resolveEvaluationMaxTokens(
      salesPlanVersion.steps.length,
      promptCharsApprox,
      {
        contextWindowTokens: this.vllmContextWindowTokens,
        tokensPerCharEstimate: this.vllmTokensPerCharEstimate,
        safetyMarginTokens: this.vllmContextSafetyMarginTokens,
      },
    );

    if (maxTokens < 1000) {
      this.logger.warn(
        `evaluate_session: prompt trop long (${promptCharsApprox} chars ≈ ${Math.ceil(promptCharsApprox * this.vllmTokensPerCharEstimate)} tokens) pour ${this.vllmContextWindowTokens} tokens de contexte. Bascule sur fallback.`,
      );
      return null;
    }

    const payload = {
      model: this.vllmClient.model,
      temperature: 0.2,
      max_tokens: maxTokens,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: SESSION_EVALUATION_JSON_SCHEMA,
      },
    };

    const result = await this.vllmClient.chat(payload, {
      step: 'evaluate_session',
    });
    if (!result) {
      return null;
    }

    try {
      const content = result.content;
      const parsed = parseLlmJson(content);
      if (!isRecord(parsed)) {
        return null;
      }

      return {
        overallScore: normalizeScore(parsed.overallScore),
        planCoverageScore: normalizeScore(parsed.planCoverageScore),
        executionQualityScore: normalizeScore(parsed.executionQualityScore),
        objectionHandlingScore: normalizeScore(parsed.objectionHandlingScore),
        listeningRatioScore: normalizeNullableScore(parsed.listeningRatioScore),
        closingScore: normalizeScore(parsed.closingScore),
        summary: normalizeText(parsed.summary),
        strengths: normalizeTextArray(parsed.strengths),
        improvements: normalizeTextArray(parsed.improvements),
        recommendations: normalizeTextArray(parsed.recommendations),
        keyMoments: Array.isArray(parsed.keyMoments)
          ? parsed.keyMoments
              .map((moment: unknown) => normalizeKeyMoment(moment))
              .filter(
                (moment: KeyMomentPayload | null): moment is KeyMomentPayload =>
                  Boolean(moment),
              )
              .slice(0, 8)
          : [],
        rawResponse: content,
        stepEvaluations: Array.isArray(parsed.stepEvaluations)
          ? parsed.stepEvaluations.map((stepValue: unknown, index: number) => {
              const step = isRecord(stepValue) ? stepValue : {};
              return {
              ordre: Number.isFinite(Number(step.ordre))
                ? Number(step.ordre)
                : index + 1,
              titre:
                normalizeText(step.titre) ||
                salesPlanVersion.steps[index]?.titre ||
                `Étape ${index + 1}`,
              coverageStatus: normalizeCoverageStatus(step.coverageStatus),
              score: normalizeNullableScore(step.score),
              startTime: normalizeNullableNumber(step.startTime),
              endTime: normalizeNullableNumber(step.endTime),
              verbatim: normalizeText(step.verbatim),
              feedback: normalizeText(step.feedback),
              recommendation: normalizeText(step.recommendation),
            };
            })
          : [],
      };
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message ?? String(error);
      this.logger.warn(`Parsing évaluation LLM impossible: ${message}`);
      return null;
    }
  }

}
