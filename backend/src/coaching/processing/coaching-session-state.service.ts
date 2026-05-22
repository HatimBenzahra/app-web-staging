import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CoachingAnalysisJobService } from './coaching-analysis-job.service';
import type {
  CoachingConversationBlock,
  CoachingTranscriptPayload,
  ConversationDetectionSummary,
  SessionEvaluationPayload,
  SessionStatusContext,
} from './coaching-engine.types';

@Injectable()
export class CoachingSessionStateService {
  private readonly logger = new Logger(CoachingSessionStateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: CoachingAnalysisJobService,
  ) {}

  async markAsProcessing(sessionId: number): Promise<void> {
    await this.prisma.coachingSession.update({
      where: { id: sessionId },
      data: { status: 'PROCESSING' },
    });
  }

  initializeStatusContext(
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

  applySegmentationSource(
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

  async applyDetectionOutcome(
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
    await this.jobs.updateAnalysisJobStep(
      jobId,
      'Aucune conversation prospect détectée',
    );
    context.status = 'NEEDS_REVIEW';
    context.reviewStatus = 'PENDING';
    context.reviewReason =
      'Aucune conversation prospect identifiée automatiquement. À valider manuellement.';
    context.confidenceScore = Math.min(context.confidenceScore, 0.5);
  }

  buildNonEvaluableEvaluation(
    salesPlanVersion: { steps: Array<{ ordre: number; titre: string }> },
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

  applyFallbackReviewStatus(
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

  logPipelineMetrics(payload: {
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
      const pipelineMs = Date.now() - payload.pipelineStartedAt;
      const duration = payload.transcript.duration > 0 ? payload.transcript.duration : 1;
      const yieldChars = (payload.transcriptText.length / duration) * 60;
      const success = payload.conversationEvaluations.filter((c) => c.evaluation).length;
      const skipped = payload.conversationEvaluations.filter(
        (c) => c.block.status === 'SKIPPED',
      ).length;
      const failed = payload.conversationEvaluations.filter(
        (c) => c.block.status === 'FAILED',
      ).length;
      this.logger.log(
        `pipeline.metrics sessionId=${payload.sessionId} pipelineMs=${pipelineMs} transcriptCacheHit=${payload.transcriptCacheHit} whisperSegments=${payload.transcript.segments.length} whisperDurationSec=${Math.round(duration)} whisperYieldCharsPerMin=${Math.round(yieldChars)} detectionSemanticUsed=${payload.detection.semanticDetectionUsed} detectionTotal=${payload.detection.detectedTotal} detectionProspect=${payload.detection.detectedProspect} detectionInternal=${payload.detection.detectedInternal} detectionNoise=${payload.detection.detectedNoise} conversationsKept=${payload.detection.blocks.length} evaluationsSuccess=${success} evaluationsSkipped=${skipped} evaluationsFailed=${failed} aggregationUsed=${payload.aggregationUsed} finalStatus=${payload.finalStatus} usedFallback=${payload.usedFallback}`,
      );
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message ?? String(error);
      this.logger.warn(`pipeline.metrics log échoué: ${message}`);
    }
  }
}
