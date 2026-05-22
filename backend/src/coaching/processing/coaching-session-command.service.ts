import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CoachingEvidenceReviewStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import {
  CoachingCriterionEvidenceDto,
  CoachingReviewActionDto,
  CoachingSessionDto,
  LaunchCoachingAnalysisInput,
  ReviewCoachingCriterionEvidenceInput,
  ReviewCoachingSessionInput,
} from '../coaching.dto';
import {
  assertAdminOrDirecteur,
  assertSharedPlanAccess,
  cleanOptionalText,
  isUniqueConstraintError,
} from '../utils/coaching-common.utils';
import { mapSession } from '../utils/coaching-mapping.utils';
import {
  extractCommercialIdFromRoomName,
  extractRoomFromRecordingKey,
} from '../utils/coaching-room-key.utils';
import type { CurrentUser } from './coaching-engine.types';
import { CoachingAnalysisJobService } from './coaching-analysis-job.service';
import { CoachingSessionQueryService } from './coaching-session-query.service';

const SESSION_INCLUDE = {
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
export class CoachingSessionCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: CoachingAnalysisJobService,
    private readonly query: CoachingSessionQueryService,
  ) {}

  async launchCoachingAnalysis(
    input: LaunchCoachingAnalysisInput,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    assertAdminOrDirecteur(currentUser);
    const version = await this.prisma.salesPlanVersion.findUnique({
      where: { id: input.salesPlanVersionId },
      include: { salesPlan: true, steps: { orderBy: { ordre: 'asc' } } },
    });
    if (!version) throw new NotFoundException('Version de plan introuvable');
    assertSharedPlanAccess(currentUser);
    if (version.status !== 'PUBLISHED') {
      throw new ForbiddenException(
        'Seule une version publiée peut être utilisée pour une analyse coaching',
      );
    }

    const roomName = extractRoomFromRecordingKey(input.s3KeyOriginal);
    const commercialId = extractCommercialIdFromRoomName(roomName);
    const commercial = commercialId
      ? await this.prisma.commercial.findUnique({
          where: { id: commercialId },
          select: { id: true, directeurId: true },
        })
      : null;
    if (
      currentUser.role === 'directeur' &&
      (!commercial || commercial.directeurId !== currentUser.id)
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez analyser que les enregistrements de votre équipe',
      );
    }

    const existing = await this.findByRecordingPlan(input.s3KeyOriginal, version.id);
    if (existing) {
      if (['PENDING', 'FAILED'].includes(existing.status)) {
        await this.jobs.enqueueAnalysisJob(existing.id, currentUser, 50);
      }
      return mapSession((await this.findByRecordingPlan(input.s3KeyOriginal, version.id)) ?? existing);
    }

    const session = await this.createSession(input, currentUser, version.id, roomName, commercial);
    await this.jobs.enqueueAnalysisJob(session.id, currentUser, 50);
    return mapSession((await this.findFullSession(session.id)) ?? session);
  }

  async relaunchCoachingAnalysis(
    id: number,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    const session = await this.prisma.coachingSession.findUnique({
      where: { id },
      include: { commercial: true, salesPlanVersion: { include: { salesPlan: true } } },
    });
    if (!session) throw new NotFoundException('Session coaching introuvable');
    await this.query.assertSessionAccess(session, currentUser);
    await this.prisma.$transaction(async (tx) => {
      await tx.coachingStepEvaluation.deleteMany({ where: { coachingSessionId: id } });
      await tx.coachingConversationEvaluation.deleteMany({ where: { coachingSessionId: id } });
      await tx.coachingKeyMoment.deleteMany({ where: { coachingSessionId: id } });
      await tx.coachingSession.update({
        where: { id },
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
    await this.jobs.enqueueAnalysisJob(id, currentUser, 80);
    const refreshed = await this.findFullSession(id);
    if (!refreshed) throw new NotFoundException('Session coaching introuvable');
    return mapSession(refreshed);
  }

  async reviewCoachingSession(
    input: ReviewCoachingSessionInput,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    assertAdminOrDirecteur(currentUser);
    const session = await this.prisma.coachingSession.findUnique({
      where: { id: input.sessionId },
      include: { commercial: true, salesPlanVersion: { include: { salesPlan: true } } },
    });
    if (!session) throw new NotFoundException('Session coaching introuvable');
    await this.query.assertSessionAccess(session, currentUser);
    const updateData = await this.buildReviewUpdate(input, currentUser, session.directeurId);
    const updated = await this.prisma.coachingSession.update({
      where: { id: session.id },
      data: updateData,
      include: SESSION_INCLUDE,
    });
    return mapSession(updated);
  }

  async reviewCoachingCriterionEvidence(
    input: ReviewCoachingCriterionEvidenceInput,
    currentUser: CurrentUser,
  ): Promise<CoachingCriterionEvidenceDto> {
    assertAdminOrDirecteur(currentUser);
    const evidence = await this.prisma.coachingCriterionEvidence.findUnique({
      where: { id: input.evidenceId },
      include: {
        coachingConversationEvaluation: {
          include: { coachingSession: { include: { commercial: true } } },
        },
      },
    });
    if (!evidence) throw new NotFoundException('Preuve coaching introuvable');
    await this.query.assertSessionAccess(
      evidence.coachingConversationEvaluation.coachingSession,
      currentUser,
    );
    const reviewStatus = String(input.reviewStatus || '').toUpperCase();
    if (!Object.values(CoachingEvidenceReviewStatus).includes(reviewStatus as CoachingEvidenceReviewStatus)) {
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
      evidenceCompleteness: updated.evidenceCompleteness ?? undefined,
      missingBecause: updated.missingBecause ?? undefined,
      scoreable: updated.scoreable,
      sourceTurnIds: Array.isArray(updated.sourceTurnIds)
        ? updated.sourceTurnIds.filter((item): item is string => typeof item === 'string')
        : [],
      reviewStatus: updated.reviewStatus,
    };
  }

  private async createSession(
    input: LaunchCoachingAnalysisInput,
    currentUser: CurrentUser,
    salesPlanVersionId: number,
    roomName: string | null,
    commercial: { id: number; directeurId: number | null } | null,
  ) {
    try {
      return await this.prisma.coachingSession.create({
        data: {
          salesPlanVersionId,
          s3KeyOriginal: input.s3KeyOriginal,
          roomName,
          commercialId: commercial?.id ?? null,
          directeurId: commercial?.directeurId ?? null,
          status: 'PENDING',
          reviewStatus: 'NOT_REQUIRED',
          createdByRole: currentUser.role,
          createdByUserId: currentUser.id,
        },
        include: SESSION_INCLUDE,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existing = await this.findByRecordingPlan(input.s3KeyOriginal, salesPlanVersionId);
        if (existing) return existing;
      }
      throw error;
    }
  }

  private async buildReviewUpdate(
    input: ReviewCoachingSessionInput,
    currentUser: CurrentUser,
    fallbackDirecteurId: number | null,
  ): Promise<Prisma.CoachingSessionUncheckedUpdateInput> {
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
      updateData.reviewNotes ||= 'Analyse rejetée lors de la revue humaine.';
    }
    if (input.commercialId) {
      const commercial = await this.prisma.commercial.findUnique({
        where: { id: input.commercialId },
        select: { id: true, directeurId: true },
      });
      if (!commercial) throw new NotFoundException('Commercial introuvable');
      if (currentUser.role === 'directeur' && commercial.directeurId !== currentUser.id) {
        throw new ForbiddenException(
          'Vous ne pouvez sélectionner qu’un commercial de votre équipe',
        );
      }
      updateData.commercialId = commercial.id;
      updateData.directeurId = commercial.directeurId ?? fallbackDirecteurId;
      updateData.confidenceScore = 1;
      updateData.identificationSource = 'HUMAN_REVIEW';
    }
    return updateData;
  }

  private async findByRecordingPlan(s3KeyOriginal: string, salesPlanVersionId: number) {
    return this.prisma.coachingSession.findUnique({
      where: { s3KeyOriginal_salesPlanVersionId: { s3KeyOriginal, salesPlanVersionId } },
      include: SESSION_INCLUDE,
    });
  }

  private async findFullSession(id: number) {
    return this.prisma.coachingSession.findUnique({ where: { id }, include: SESSION_INCLUDE });
  }
}
