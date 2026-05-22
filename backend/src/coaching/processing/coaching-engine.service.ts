import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  CoachingRecordingCandidatesInput,
  CoachingRecordingCandidatesPageDto,
  CoachingAnalysisQueueInput,
  CoachingQueueStateDto,
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
import { buildTranscriptText } from '../utils/conversation-blocks.utils';
import { completeEvaluationPayload } from '../utils/evaluation-fallback.utils';
import {
  aggregateConversationEvaluations,
  buildReadableTranscriptFromConversations,
} from '../utils/coaching-aggregation.utils';
import { resolveMaxTranscriptPromptChars } from '../utils/coaching-env-resolvers.utils';
import { CoachingQueueService } from './coaching-queue.service';
import { CoachingAutoQueueService } from './coaching-auto-queue.service';
import { CoachingAnalysisJobService } from './coaching-analysis-job.service';
import { CoachingSessionCommandService } from './coaching-session-command.service';
import { CoachingSessionQueryService } from './coaching-session-query.service';
import { CoachingSessionPersistenceService } from './coaching-session-persistence.service';
import { CoachingTranscriptLoaderService } from './coaching-transcript-loader.service';
import { CoachingConversationDetectorService } from './coaching-conversation-detector.service';
import { CoachingReadableTranscriptService } from './coaching-readable-transcript.service';
import { CoachingSessionStateService } from './coaching-session-state.service';
import { CoachingConversationEvaluationService } from './coaching-conversation-evaluation.service';
import {
  extractCommercialIdFromRoomName,
  extractRoomFromRecordingKey,
} from '../utils/coaching-room-key.utils';
import {
  CoachingConversationBlock,
  CurrentUser,
  SessionEvaluationPayload,
} from './coaching-engine.types';

@Injectable()
export class CoachingEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CoachingEngineService.name);
  private readonly maxTranscriptPromptChars = resolveMaxTranscriptPromptChars();

  constructor(
    private readonly prisma: PrismaService,
    private readonly recordingCatalogService: CoachingRecordingCatalogService,
    private readonly salesPlanService: CoachingSalesPlanService,
    private readonly vllmClient: CoachingVllmClient,
    private readonly queueService: CoachingQueueService,
    private readonly autoQueueService: CoachingAutoQueueService,
    private readonly analysisJobService: CoachingAnalysisJobService,
    private readonly sessionCommandService: CoachingSessionCommandService,
    private readonly sessionQueryService: CoachingSessionQueryService,
    private readonly transcriptLoaderService: CoachingTranscriptLoaderService,
    private readonly conversationDetectorService: CoachingConversationDetectorService,
    private readonly readableTranscriptService: CoachingReadableTranscriptService,
    private readonly sessionStateService: CoachingSessionStateService,
    private readonly conversationEvaluationService: CoachingConversationEvaluationService,
    private readonly persistenceService: CoachingSessionPersistenceService,
  ) {}

  onModuleInit(): void {
    this.queueService.initialize((sessionId, jobId) =>
      this.processSession(sessionId, jobId),
    );
    this.queueService.start();
  }

  onModuleDestroy(): void {
    this.queueService.stop();
    this.autoQueueService.stop();
  }

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
    return this.sessionQueryService.getCoachingSessions(input, currentUser);
  }

  async getAnalysisQueue(
    input: CoachingAnalysisQueueInput | undefined,
    currentUser: CurrentUser,
  ): Promise<CoachingQueueStateDto> {
    return this.sessionQueryService.getAnalysisQueue(input, currentUser);
  }

  async getCoachingSession(
    id: number,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    return this.sessionQueryService.getCoachingSession(id, currentUser);
  }

  async launchCoachingAnalysis(
    input: LaunchCoachingAnalysisInput,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    return this.sessionCommandService.launchCoachingAnalysis(input, currentUser);
  }

  async relaunchCoachingAnalysis(
    id: number,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    return this.sessionCommandService.relaunchCoachingAnalysis(id, currentUser);
  }

  async reviewCoachingSession(
    input: ReviewCoachingSessionInput,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    return this.sessionCommandService.reviewCoachingSession(input, currentUser);
  }

  async reviewCoachingCriterionEvidence(
    input: ReviewCoachingCriterionEvidenceInput,
    currentUser: CurrentUser,
  ): Promise<CoachingCriterionEvidenceDto> {
    return this.sessionCommandService.reviewCoachingCriterionEvidence(
      input,
      currentUser,
    );
  }

  async autoQueueLatestPublishedAnalysisForRecording(
    s3KeyOriginal: string,
  ): Promise<void> {
    return this.autoQueueService.autoQueueLatestPublishedAnalysisForRecording(
      s3KeyOriginal,
    );
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

    await this.sessionStateService.markAsProcessing(sessionId);

    try {
      const transcript = await this.transcriptLoaderService.ensureTranscription(
        session,
        jobId,
      );
      const roomName =
        session.roomName || extractRoomFromRecordingKey(session.s3KeyOriginal);
      const inferredCommercialId =
        session.commercialId ?? extractCommercialIdFromRoomName(roomName);
      const transcriptCacheHit = transcript.source === 'RECORDING_SEGMENTS';
      const statusContext = this.sessionStateService.initializeStatusContext(
        inferredCommercialId,
        transcript.source,
      );
      this.sessionStateService.applySegmentationSource(transcript, statusContext);
      const transcriptText = buildTranscriptText(transcript.segments);

      const detection = await this.conversationDetectorService.ensureConversations(
        session.id,
        transcript,
        jobId,
      );
      await this.sessionStateService.applyDetectionOutcome(
        session.id,
        detection,
        statusContext,
        jobId,
      );

      const readableBlocks = await this.readableTranscriptService.ensureReadableConversations(
        detection.blocks,
        jobId,
      );

      const conversationEvaluations =
        await this.conversationEvaluationService.ensureEvaluation(
          session.salesPlanVersion,
          readableBlocks,
          this.maxTranscriptPromptChars,
          jobId,
        );
      const readableTranscriptText = buildReadableTranscriptFromConversations(
        conversationEvaluations,
        transcriptText,
      );
      await this.analysisJobService.updateAnalysisJobStep(
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
      this.sessionStateService.applyFallbackReviewStatus(evaluation, statusContext);

      await this.analysisJobService.updateAnalysisJobStep(jobId, 'Finalisation du rapport');
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

      this.sessionStateService.logPipelineMetrics({
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
      await this.analysisJobService.updateAnalysisJobStep(jobId, 'Erreur pipeline');
      return false;
    }
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
      return this.sessionStateService.buildNonEvaluableEvaluation(
        session.salesPlanVersion,
        reason,
      );
    }

    await this.analysisJobService.updateAnalysisJobStep(
      jobId,
      'Évaluation globale IA (fallback — aucune conversation exploitable)',
    );
    const fallbackEvaluation =
      await this.conversationEvaluationService.evaluateTranscript(
        session.salesPlanVersion,
        {
          ordre: 1,
          title: 'Session complète',
          startTime: 0,
          endTime: 0,
          transcriptText,
          segmentsCount: 1,
          status: 'NEEDS_REVIEW',
          reviewReason:
            'Évaluation globale fallback, aucune conversation exploitable isolée.',
        },
        this.maxTranscriptPromptChars,
      );
    return (
      fallbackEvaluation ??
      this.sessionStateService.buildNonEvaluableEvaluation(
        session.salesPlanVersion,
        'Le plan de vente n’a pas pu être appliqué automatiquement au transcript.',
      )
    );
  }

}
