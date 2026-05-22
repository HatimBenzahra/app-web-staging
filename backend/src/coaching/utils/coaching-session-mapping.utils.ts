import type {
  CoachingConversationStatusDto,
  CoachingReviewStatusDto,
  CoachingSessionDto,
  CoachingSessionStatusDto,
  CoachingStepCoverageStatusDto,
} from '../coaching.dto';
import {
  buildPipelineSteps,
  mapAnalysisJob,
  normalizeDialogueTurns,
  normalizeStringArray,
  SessionLike,
} from './coaching-mapping.utils';

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
    stepEvaluations: mapStepEvaluations(session),
    keyMoments: mapKeyMoments(session),
    conversationEvaluations: mapConversationEvaluations(session),
  };
}

function mapStepEvaluations(session: SessionLike) {
  return (
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
    })) ?? []
  );
}

function mapKeyMoments(session: SessionLike) {
  return (
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
    })) ?? []
  );
}

function mapConversationEvaluations(session: SessionLike) {
  return (
    session.conversationEvaluations?.map((conversation) => ({
      id: conversation.id,
      ordre: conversation.ordre,
      title: conversation.title ?? undefined,
      startTime: conversation.startTime ?? undefined,
      endTime: conversation.endTime ?? undefined,
      transcriptText: conversation.transcriptText ?? undefined,
      readableTranscriptText: conversation.readableTranscriptText ?? undefined,
      dialogueTurns: normalizeDialogueTurns(conversation.dialogueTurns),
      dialoguePromptVersion: conversation.dialoguePromptVersion ?? undefined,
      dialogueRawResponse: conversation.dialogueRawResponse ?? undefined,
      conversationKind: conversation.conversationKind ?? undefined,
      usableForScoring: conversation.usableForScoring ?? undefined,
      scoreabilityReason: conversation.scoreabilityReason ?? undefined,
      status: conversation.status as CoachingConversationStatusDto,
      reviewReason: conversation.reviewReason ?? undefined,
      overallScore: conversation.overallScore ?? undefined,
      planCoverageScore: conversation.planCoverageScore ?? undefined,
      executionQualityScore: conversation.executionQualityScore ?? undefined,
      objectionHandlingScore: conversation.objectionHandlingScore ?? undefined,
      listeningRatioScore: conversation.listeningRatioScore ?? undefined,
      closingScore: conversation.closingScore ?? undefined,
      summary: conversation.summary ?? undefined,
      strengths: conversation.strengths ?? [],
      improvements: conversation.improvements ?? [],
      recommendations: conversation.recommendations ?? [],
      scoringMode: conversation.scoringMode ?? undefined,
      scoringSchemaVersion: conversation.scoringSchemaVersion ?? undefined,
      evidencePromptVersion: conversation.evidencePromptVersion ?? undefined,
      evaluationPromptVersion: conversation.evaluationPromptVersion ?? undefined,
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
          evidenceCompleteness: evidence.evidenceCompleteness ?? undefined,
          missingBecause: evidence.missingBecause ?? undefined,
          scoreable: evidence.scoreable ?? true,
          sourceTurnIds: normalizeStringArray(evidence.sourceTurnIds),
          reviewStatus: evidence.reviewStatus,
        })) ?? [],
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    })) ?? []
  );
}
