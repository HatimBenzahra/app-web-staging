/**
 * Mapping utilities: Prisma rows → GraphQL DTOs.
 * Pure functions, no DI.
 */

import type {
  CoachingSessionDto,
  CoachingAnalysisJobDto,
} from '../coaching.dto';

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

export function mapAnalysisJob(job: any): CoachingAnalysisJobDto {
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
  session: any,
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
    pipelineSteps: buildPipelineSteps(session, analysisJob),
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
        executionQualityScore: conversation.executionQualityScore ?? undefined,
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
