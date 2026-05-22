import { Injectable, Logger } from '@nestjs/common';
import { completeEvaluationPayload, evaluateWithFallback } from '../utils/evaluation-fallback.utils';
import { cleanTranscriptForQuality } from '../utils/transcript-quality.utils';
import { resolveEvaluationBatchSize } from '../utils/coaching-env-resolvers.utils';
import { normalizeText } from '../utils/evaluation-normalizers.utils';
import { resolveExcerptTimeRange } from '../utils/transcript-parsing.utils';
import { resolveExcerptTimeRangeFromWords } from '../utils/transcript-word-timing.utils';
import {
  PLAN_APPLICATION_PROMPT_VERSION,
  REMARKS_PROMPT_VERSION,
  SCORING_SCHEMA_VERSION,
} from '../utils/coaching-llm-prompts.constants';
import { ConversationQualityGateService } from '../scoring/conversation-quality-gate.service';
import { CoachingScoringEngineService } from '../scoring/coaching-scoring-engine.service';
import type { SalesPlanApplicationPayload } from '../scoring/coaching-scoring.types';
import { CoachingAnalysisJobService } from './coaching-analysis-job.service';
import { CoachingConversationClassifierService } from './coaching-conversation-classifier.service';
import type {
  CoachingConversationBlock,
  SessionEvaluationPayload,
} from './coaching-engine.types';
import { CoachingLegacyEvaluationService } from './coaching-legacy-evaluation.service';
import { CoachingSalesPlanApplicationService } from './coaching-sales-plan-application.service';

type SalesPlanVersionInput = {
  id?: number;
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
};

type ConversationEvaluationResult = {
  block: CoachingConversationBlock;
  evaluation: SessionEvaluationPayload | null;
};

@Injectable()
export class CoachingConversationEvaluationService {
  private readonly logger = new Logger(CoachingConversationEvaluationService.name);

  constructor(
    private readonly jobs: CoachingAnalysisJobService,
    private readonly classifier: CoachingConversationClassifierService,
    private readonly qualityGate: ConversationQualityGateService,
    private readonly scoring: CoachingScoringEngineService,
    private readonly salesPlanApplication: CoachingSalesPlanApplicationService,
    private readonly legacyEvaluation: CoachingLegacyEvaluationService,
  ) {}

  async ensureEvaluation(
    salesPlanVersion: SalesPlanVersionInput,
    blocks: CoachingConversationBlock[],
    maxTranscriptPromptChars: number,
    jobId?: number,
  ): Promise<ConversationEvaluationResult[]> {
    const results: ConversationEvaluationResult[] = new Array(blocks.length);
    const batchSize = resolveEvaluationBatchSize();

    for (let start = 0; start < blocks.length; start += batchSize) {
      const end = Math.min(start + batchSize, blocks.length);
      await this.jobs.updateAnalysisJobStep(
        jobId,
        blocks.length === 1
          ? 'Stage 4 — Évaluation conversation 1/1'
          : `Stage 4 — Évaluation conversations ${start + 1}-${end}/${blocks.length}`,
      );
      await this.evaluateBatch(salesPlanVersion, blocks, start, end, results, maxTranscriptPromptChars);
    }

    const success = results.filter((result) => result.evaluation !== null).length;
    this.logger.log(`Stage 4 terminé: ${success}/${blocks.length} évaluation(s) réussie(s)`);
    return results;
  }

  async evaluateTranscript(
    salesPlanVersion: SalesPlanVersionInput,
    block: CoachingConversationBlock,
    maxTranscriptPromptChars: number,
  ): Promise<SessionEvaluationPayload | null> {
    if (this.resolveScoringMode() === 'evidence') {
      return this.evaluateTranscriptWithEvidence(
        salesPlanVersion,
        block,
        maxTranscriptPromptChars,
      );
    }

    const transcriptText = block.transcriptText;
    const llmEvaluation = await this.legacyEvaluation.evaluateWithLlm(
      salesPlanVersion,
      transcriptText,
      maxTranscriptPromptChars,
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

  private async evaluateBatch(
    salesPlanVersion: SalesPlanVersionInput,
    blocks: CoachingConversationBlock[],
    start: number,
    end: number,
    results: ConversationEvaluationResult[],
    maxTranscriptPromptChars: number,
  ): Promise<void> {
    const batchEntries = blocks
      .slice(start, end)
      .map((block, offset) => ({ block, idx: start + offset }));
    const settled = await Promise.allSettled(
      batchEntries.map((entry) =>
        this.evaluateOne(salesPlanVersion, entry.block, maxTranscriptPromptChars),
      ),
    );
    for (let i = 0; i < settled.length; i += 1) {
      const entry = batchEntries[i];
      const outcome = settled[i];
      results[entry.idx] =
        outcome.status === 'fulfilled'
          ? outcome.value
          : this.failedEvaluation(entry.block, outcome.reason);
    }
  }

  private async evaluateOne(
    salesPlanVersion: SalesPlanVersionInput,
    block: CoachingConversationBlock,
    maxTranscriptPromptChars: number,
  ): Promise<ConversationEvaluationResult> {
    const precheck = this.precheckBlock(block);
    if (precheck) {
      return precheck;
    }

    const evaluationBlock = this.prepareEvaluationBlock(block);
    const qualityGate = this.qualityGate.evaluate({
      status: evaluationBlock.segmentStatut,
      type: evaluationBlock.segmentType,
      source: evaluationBlock.segmentSource,
      confidence: evaluationBlock.segmentConfidence,
      speechScore: evaluationBlock.speechScore,
      durationSec: Math.max(0, evaluationBlock.endTime - evaluationBlock.startTime),
      transcriptText: evaluationBlock.transcriptText,
    });
    if (qualityGate.decision === 'SKIP' || qualityGate.decision === 'REVIEW_ONLY') {
      return {
        block: {
          ...evaluationBlock,
          status: qualityGate.decision === 'SKIP' ? 'SKIPPED' : 'NEEDS_REVIEW',
          reviewReason:
            qualityGate.reasons.join(' ') ||
            'Transcription insuffisante pour une évaluation fiable.',
        },
        evaluation: null,
      };
    }

    try {
      const effectivePlan = await this.classifier.resolveEffectivePlan(
        salesPlanVersion,
        evaluationBlock.transcriptText,
      );
      const evaluation = await this.evaluateTranscript(
        effectivePlan,
        evaluationBlock,
        maxTranscriptPromptChars,
      );
      return evaluation
        ? { block: evaluationBlock, evaluation }
        : {
            block: {
              ...evaluationBlock,
              status: 'NEEDS_REVIEW',
              reviewReason:
                'Le plan de vente n’a pas pu être appliqué automatiquement à cette conversation.',
            },
            evaluation: null,
          };
    } catch (error: unknown) {
      const msg = (error as { message?: string })?.message ?? String(error);
      this.logger.warn(`Stage 4: évaluation conv ${evaluationBlock.ordre} impossible: ${msg}`);
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
  }

  private precheckBlock(
    block: CoachingConversationBlock,
  ): ConversationEvaluationResult | null {
    if (block.status === 'SKIPPED') {
      return { block, evaluation: null };
    }
    if (block.usableForScoring === false) {
      return {
        block: {
          ...block,
          status: 'NEEDS_REVIEW',
          reviewReason:
            block.scoreabilityReason ??
            'Dialogue reconstruit non scorable automatiquement.',
        },
        evaluation: null,
      };
    }
    return null;
  }

  private prepareEvaluationBlock(block: CoachingConversationBlock): CoachingConversationBlock {
    const coachingTranscript = block.readableTranscriptText || block.transcriptText;
    const cleanedTranscript = cleanTranscriptForQuality(coachingTranscript);
    return {
      ...block,
      transcriptText: cleanedTranscript.cleanedText || coachingTranscript,
      readableTranscriptText:
        cleanedTranscript.cleanedText || block.readableTranscriptText,
    };
  }

  private async evaluateTranscriptWithEvidence(
    salesPlanVersion: SalesPlanVersionInput,
    block: CoachingConversationBlock,
    maxTranscriptPromptChars: number,
  ): Promise<SessionEvaluationPayload | null> {
    const qualityGate = this.qualityGate.evaluate({
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

    const application = await this.salesPlanApplication.applyWithLlm({
      block,
      salesPlanVersion,
      status: block.segmentStatut,
      qualityGate,
      maxTranscriptPromptChars,
    });
    if (!application || application.steps.filter((step) => step.observed).length === 0) {
      this.logger.warn(`apply_sales_plan: aucune étape observée pour conversation ${block.ordre}`);
      return null;
    }

    const scoring = this.scoring.calculateFromStepApplication({
      salesPlanSteps: salesPlanVersion.steps,
      application,
      qualityGateReviewReasons:
        qualityGate.decision === 'EVALUATE_WITH_REVIEW' ||
        qualityGate.decision === 'REVIEW_ONLY'
          ? qualityGate.reasons
          : [],
    });
    const evaluation = this.buildEvidenceEvaluation(
      salesPlanVersion,
      block,
      application,
      scoring,
    );
    return {
      ...completeEvaluationPayload(salesPlanVersion, evaluation, block.transcriptText),
      scoringMode: evaluation.scoringMode,
      scoringSchemaVersion: evaluation.scoringSchemaVersion,
      evidencePromptVersion: evaluation.evidencePromptVersion,
      evaluationPromptVersion: evaluation.evaluationPromptVersion,
      criterionEvidences: evaluation.criterionEvidences,
    };
  }

  private buildEvidenceEvaluation(
    salesPlanVersion: SalesPlanVersionInput,
    block: CoachingConversationBlock,
    application: SalesPlanApplicationPayload,
    scoring: ReturnType<CoachingScoringEngineService['calculateFromStepApplication']>,
  ): SessionEvaluationPayload {
    return {
      overallScore: scoring.overallScore,
      planCoverageScore: scoring.planCoverageScore,
      executionQualityScore: scoring.executionQualityScore,
      objectionHandlingScore: scoring.objectionHandlingScore,
      listeningRatioScore: scoring.listeningRatioScore,
      closingScore: scoring.closingScore,
      summary:
        application.conversationSummary ??
        this.salesPlanApplication.buildSummary(scoring, application),
      strengths: scoring.strengths,
      improvements: scoring.improvements,
      recommendations: scoring.recommendations,
      keyMoments: this.mapKeyMoments(application, block),
      stepEvaluations: scoring.stepEvaluations,
      rawResponse: application.rawResponse,
      usedFallback: false,
      scoringMode: 'step_application',
      scoringSchemaVersion: SCORING_SCHEMA_VERSION,
      evidencePromptVersion: PLAN_APPLICATION_PROMPT_VERSION,
      evaluationPromptVersion: REMARKS_PROMPT_VERSION,
      criterionEvidences: this.salesPlanApplication.buildCriterionEvidences(
        application,
        salesPlanVersion.steps,
        block.startTime,
        block.transcriptText,
        block.words ?? [],
      ),
    };
  }

  private mapKeyMoments(
    application: SalesPlanApplicationPayload,
    block: CoachingConversationBlock,
  ) {
    return application.keyMoments.map((event) => {
      const verbatim = normalizeText(event.verbatim);
      const wordRange = verbatim
        ? resolveExcerptTimeRangeFromWords(block.words ?? [], verbatim)
        : null;
      const fallbackRange = verbatim
        ? resolveExcerptTimeRange(block.transcriptText, verbatim)
        : null;
      const startTime =
        event.startTime !== null && event.startTime !== undefined
          ? this.salesPlanApplication.normalizeApplicationTime(
              event.startTime,
              block.startTime,
            )
          : (wordRange?.start ?? fallbackRange?.start ?? null);
      const endTime =
        event.endTime !== null && event.endTime !== undefined
          ? this.salesPlanApplication.normalizeApplicationTime(
              event.endTime,
              block.startTime,
            )
          : (wordRange?.end ?? fallbackRange?.end ?? null);
      return {
        type: event.type,
        title: event.title ?? event.type,
        summary: event.summary,
        startTime,
        endTime,
        verbatim: event.verbatim,
        importance: event.importance,
      };
    });
  }

  private failedEvaluation(
    block: CoachingConversationBlock,
    reason: unknown,
  ): ConversationEvaluationResult {
    this.logger.warn(
      `Stage 4: éval conv ${block.ordre} rejet: ${(reason as { message?: string })?.message || reason}`,
    );
    return {
      block: {
        ...block,
        status: 'FAILED',
        reviewReason:
          'Cette conversation n’a pas pu être évaluée (exception non gérée).',
      },
      evaluation: null,
    };
  }

  private resolveScoringMode(): 'legacy' | 'evidence' {
    return process.env.COACHING_SCORING_MODE === 'legacy' ? 'legacy' : 'evidence';
  }
}
