import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { cleanOptionalText } from '../utils/coaching-common.utils';

@Injectable()
export class CoachingSessionPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async persistSessionAnalysis(payload: {
    session: {
      id: number;
      commercialId: number | null;
      directeurId: number | null;
      roomName: string | null;
      commercial: { directeurId: number | null } | null;
      salesPlanVersion: { steps: Array<{ id: number; ordre: number }> };
    };
    transcript: { segments: Array<unknown>; duration: number };
    transcriptText: string;
    readableTranscriptText: string;
    roomName: string | null;
    inferredCommercialId: number | null | undefined;
    evaluation: any;
    conversationEvaluations: Array<{ block: any; evaluation: any }>;
    statusContext: {
      status: 'COMPLETED' | 'NEEDS_REVIEW';
      reviewStatus: 'NOT_REQUIRED' | 'PENDING';
      reviewReason: string | null;
      confidenceScore: number;
      identificationSource: string;
    };
    llmModel: string | null;
  }): Promise<void> {
    const {
      session,
      transcript,
      transcriptText,
      readableTranscriptText,
      roomName,
      inferredCommercialId,
      evaluation,
      conversationEvaluations,
      statusContext,
      llmModel,
    } = payload;

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
          directeurId: session.directeurId ?? session.commercial?.directeurId ?? null,
          roomName: roomName ?? session.roomName,
          status: statusContext.status,
          reviewStatus: statusContext.reviewStatus,
          confidenceScore: statusContext.confidenceScore,
          identificationSource: statusContext.identificationSource,
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
          summary: cleanOptionalText(evaluation.summary) ?? null,
          strengths: evaluation.strengths,
          improvements: evaluation.improvements,
          recommendations: evaluation.recommendations,
          llmModel: evaluation.usedFallback ? 'fallback-heuristic' : llmModel,
          llmRawResponse: evaluation.rawResponse ?? null,
          failureReason: null,
          reviewReason: statusContext.reviewReason,
          processedAt: new Date(),
        },
      });

      if (evaluation.stepEvaluations.length > 0) {
        await tx.coachingStepEvaluation.createMany({
          data: evaluation.stepEvaluations.map((step: any) => ({
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
            verbatim: cleanOptionalText(step.verbatim) ?? null,
            feedback: cleanOptionalText(step.feedback) ?? null,
            recommendation: cleanOptionalText(step.recommendation) ?? null,
          })),
        });
      }

      if (evaluation.keyMoments.length > 0) {
        await tx.coachingKeyMoment.createMany({
          data: evaluation.keyMoments.map((moment: any) => ({
            coachingSessionId: session.id,
            type: moment.type,
            title: moment.title,
            summary: cleanOptionalText(moment.summary) ?? null,
            startTime: moment.startTime ?? null,
            endTime: moment.endTime ?? null,
            verbatim: cleanOptionalText(moment.verbatim) ?? null,
            importance: moment.importance ?? null,
          })),
        });
      }

      if (conversationEvaluations.length > 0) {
        await tx.coachingConversationEvaluation.createMany({
          data: conversationEvaluations.map(({ block, evaluation: convEval }) => ({
            coachingSessionId: session.id,
            ordre: block.ordre,
            title: block.title,
            startTime: block.startTime,
            endTime: block.endTime,
            transcriptText: block.transcriptText,
            readableTranscriptText: block.readableTranscriptText,
            status: block.status,
            reviewReason:
              cleanOptionalText(block.reviewReason) ??
              (convEval?.usedFallback
                ? 'Conversation évaluée avec le fallback heuristique.'
                : null),
            overallScore: convEval?.overallScore ?? null,
            planCoverageScore: convEval?.planCoverageScore ?? null,
            executionQualityScore: convEval?.executionQualityScore ?? null,
            objectionHandlingScore: convEval?.objectionHandlingScore ?? null,
            listeningRatioScore: convEval?.listeningRatioScore ?? null,
            closingScore: convEval?.closingScore ?? null,
            summary: cleanOptionalText(convEval?.summary) ?? null,
            strengths: convEval?.strengths ?? [],
            improvements: convEval?.improvements ?? [],
            recommendations: convEval?.recommendations ?? [],
            llmRawResponse: convEval?.rawResponse ?? null,
          })),
        });
      }
    });
  }
}
