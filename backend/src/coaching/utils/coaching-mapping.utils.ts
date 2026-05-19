/**
 * Mapping utilities: Prisma rows → GraphQL DTOs.
 * Pure functions, no DI.
 */

import type {
  CoachingAnalysisJobStatusDto,
  CoachingConversationStatusDto,
  CoachingSessionDto,
  CoachingAnalysisJobDto,
  CoachingReviewStatusDto,
  CoachingSessionStatusDto,
  CoachingStepCoverageStatusDto,
} from '../coaching.dto';

type AnalysisJobLike = {
  id: number;
  coachingSessionId: number;
  status: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  currentStep?: string | null;
  failureReason?: string | null;
  queuedAt: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  nextRunAt?: Date | null;
  lastHeartbeatAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type StepEvaluationLike = {
  id: number;
  ordre: number;
  titre: string;
  coverageStatus: string;
  score?: number | null;
  startTime?: number | null;
  endTime?: number | null;
  verbatim?: string | null;
  feedback?: string | null;
  recommendation?: string | null;
};

type KeyMomentLike = {
  id: number;
  type: string;
  title: string;
  summary?: string | null;
  startTime?: number | null;
  endTime?: number | null;
  verbatim?: string | null;
  importance?: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type CriterionEvidenceLike = {
  id: number;
  stepOrder: number;
  criterionKey: string;
  criterionLabel: string;
  found: boolean;
  quality: string;
  confidence: number;
  verbatim?: string | null;
  startTime?: number | null;
  endTime?: number | null;
  reason?: string | null;
  reviewStatus: string;
};

type ConversationEvaluationLike = {
  id: number;
  ordre: number;
  title?: string | null;
  startTime?: number | null;
  endTime?: number | null;
  transcriptText?: string | null;
  readableTranscriptText?: string | null;
  status: string;
  reviewReason?: string | null;
  overallScore?: number | null;
  planCoverageScore?: number | null;
  executionQualityScore?: number | null;
  objectionHandlingScore?: number | null;
  listeningRatioScore?: number | null;
  closingScore?: number | null;
  summary?: string | null;
  strengths?: string[];
  improvements?: string[];
  recommendations?: string[];
  scoringMode?: string | null;
  scoringSchemaVersion?: string | null;
  evidencePromptVersion?: string | null;
  evaluationPromptVersion?: string | null;
  criterionEvidences?: CriterionEvidenceLike[];
  createdAt: Date;
  updatedAt: Date;
};

type SessionLike = {
  id: number;
  s3KeyOriginal: string;
  roomName?: string | null;
  commercialId?: number | null;
  commercial?: { prenom: string; nom: string; directeurId?: number | null } | null;
  directeurId?: number | null;
  salesPlanVersionId: number;
  salesPlanVersion?: {
    label?: string | null;
    salesPlan?: { nom?: string | null } | null;
  } | null;
  status: string;
  reviewStatus: string;
  confidenceScore?: number | null;
  identificationSource?: string | null;
  transcriptText?: string | null;
  readableTranscriptText?: string | null;
  transcriptDurationSec?: number | null;
  whisperSegmentsCount?: number | null;
  overallScore?: number | null;
  planCoverageScore?: number | null;
  executionQualityScore?: number | null;
  objectionHandlingScore?: number | null;
  listeningRatioScore?: number | null;
  closingScore?: number | null;
  summary?: string | null;
  strengths?: string[];
  improvements?: string[];
  recommendations?: string[];
  llmModel?: string | null;
  scoringMode?: string | null;
  scoringSchemaVersion?: string | null;
  evidencePromptVersion?: string | null;
  evaluationPromptVersion?: string | null;
  failureReason?: string | null;
  reviewReason?: string | null;
  reviewNotes?: string | null;
  launchedAt: Date;
  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  analysisJobs?: AnalysisJobLike[];
  stepEvaluations?: StepEvaluationLike[];
  keyMoments?: KeyMomentLike[];
  conversationEvaluations?: ConversationEvaluationLike[];
};

export function secondsSince(value: Date): number {
  return Math.max(0, Math.round((Date.now() - value.getTime()) / 1000));
}

export function pipelineStatus(
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

export function mapAnalysisJob(job: AnalysisJobLike): CoachingAnalysisJobDto {
  return {
    id: job.id,
    coachingSessionId: job.coachingSessionId,
    status: job.status as CoachingAnalysisJobStatusDto,
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
        ? secondsSince(job.queuedAt)
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

export function buildPipelineSteps(
  session: SessionLike,
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
        ? pipelineStatus(Boolean(job.startedAt), false, false)
        : 'PENDING',
      timestamp: job?.queuedAt,
      detail: job?.currentStep,
    },
    {
      key: 'processing',
      label: 'Traitement audio',
      status: pipelineStatus(
        Boolean(session.transcriptText),
        processing,
        failed && !session.transcriptText,
      ),
      timestamp: job?.startedAt,
    },
    {
      key: 'readable_transcript',
      label: 'Transcript lisible',
      status: pipelineStatus(
        Boolean(session.readableTranscriptText),
        processing && Boolean(session.transcriptText),
        failed && Boolean(session.transcriptText),
      ),
    },
    {
      key: 'evaluation',
      label: 'Évaluation IA',
      status: pipelineStatus(
        Boolean(session.overallScore || session.summary),
        processing && Boolean(session.readableTranscriptText),
        failed && Boolean(session.readableTranscriptText),
      ),
    },
    {
      key: 'completed',
      label: 'Rapport disponible',
      status: pipelineStatus(
        completed,
        processing && Boolean(session.overallScore || session.summary),
        failed,
      ),
      timestamp: session.processedAt ?? job?.completedAt ?? job?.failedAt,
      detail: session.failureReason ?? session.reviewReason ?? undefined,
    },
  ];
}

export function mapSession(
  session: SessionLike,
  audioUrl?: string,
): CoachingSessionDto {
  const analysisJob = session.analysisJobs?.[0]
    ? mapAnalysisJob(session.analysisJobs[0])
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
    status: session.status as CoachingSessionStatusDto,
    reviewStatus: session.reviewStatus as CoachingReviewStatusDto,
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
    scoringMode: session.scoringMode ?? undefined,
    scoringSchemaVersion: session.scoringSchemaVersion ?? undefined,
    evidencePromptVersion: session.evidencePromptVersion ?? undefined,
    evaluationPromptVersion: session.evaluationPromptVersion ?? undefined,
    failureReason: session.failureReason ?? undefined,
    reviewReason: session.reviewReason ?? undefined,
    reviewNotes: session.reviewNotes ?? undefined,
    audioUrl,
    launchedAt: session.launchedAt,
    processedAt: session.processedAt ?? undefined,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    analysisJob,
    pipelineSteps: buildPipelineSteps(session, analysisJob),
    stepEvaluations:
      session.stepEvaluations?.map((step) => ({
        id: step.id,
        ordre: step.ordre,
        titre: step.titre,
        coverageStatus: step.coverageStatus as CoachingStepCoverageStatusDto,
        score: step.score ?? undefined,
        startTime: step.startTime ?? undefined,
        endTime: step.endTime ?? undefined,
        verbatim: step.verbatim ?? undefined,
        feedback: step.feedback ?? undefined,
        recommendation: step.recommendation ?? undefined,
      })) ?? [],
    keyMoments:
      session.keyMoments?.map((moment) => ({
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
      session.conversationEvaluations?.map((conversation) => ({
        id: conversation.id,
        ordre: conversation.ordre,
        title: conversation.title ?? undefined,
        startTime: conversation.startTime ?? undefined,
        endTime: conversation.endTime ?? undefined,
        transcriptText: conversation.transcriptText ?? undefined,
        readableTranscriptText:
          conversation.readableTranscriptText ?? undefined,
        status: conversation.status as CoachingConversationStatusDto,
        reviewReason: conversation.reviewReason ?? undefined,
        overallScore: conversation.overallScore ?? undefined,
        planCoverageScore: conversation.planCoverageScore ?? undefined,
        executionQualityScore: conversation.executionQualityScore ?? undefined,
        objectionHandlingScore:
          conversation.objectionHandlingScore ?? undefined,
        listeningRatioScore: conversation.listeningRatioScore ?? undefined,
        closingScore: conversation.closingScore ?? undefined,
        summary: conversation.summary ?? undefined,
        strengths: conversation.strengths ?? [],
        improvements: conversation.improvements ?? [],
        recommendations: conversation.recommendations ?? [],
        scoringMode: conversation.scoringMode ?? undefined,
        scoringSchemaVersion: conversation.scoringSchemaVersion ?? undefined,
        evidencePromptVersion: conversation.evidencePromptVersion ?? undefined,
        evaluationPromptVersion:
          conversation.evaluationPromptVersion ?? undefined,
        criterionEvidences:
          conversation.criterionEvidences?.map((evidence) => ({
            id: evidence.id,
            stepOrder: evidence.stepOrder,
            criterionKey: evidence.criterionKey,
            criterionLabel: evidence.criterionLabel,
            found: evidence.found,
            quality: evidence.quality,
            confidence: evidence.confidence,
            verbatim: evidence.verbatim ?? undefined,
            startTime: evidence.startTime ?? undefined,
            endTime: evidence.endTime ?? undefined,
            reason: evidence.reason ?? undefined,
            reviewStatus: evidence.reviewStatus,
          })) ?? [],
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      })) ?? [],
  };
}
