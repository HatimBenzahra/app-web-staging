import { Injectable, Logger } from '@nestjs/common';
import { SalesPlanAgentService } from '../agents/sales-plan/sales-plan-agent.service';
import { SalesPlanValidator } from '../validators/sales-plan.validator';
import { buildTranscriptText } from '../utils/conversation-blocks.utils';
import { resolveExcerptTimeRange } from '../utils/transcript-parsing.utils';
import {
  resolveExcerptTimeRangeFromWords,
  TranscriptWordTiming,
} from '../utils/transcript-word-timing.utils';
import {
  normalizeNullableNumber,
  normalizeText,
  normalizeTextArray,
} from '../utils/evaluation-normalizers.utils';
import type {
  CriterionEvidencePayload,
  DeterministicScoringResult,
  QualityGateResult,
  SalesPlanApplicationPayload,
  SalesPlanStepApplicationPayload,
} from '../scoring/coaching-scoring.types';
import type { CoachingConversationBlock } from './coaching-engine.types';
import { isRecord } from './coaching-engine.types';

type SalesPlanStepInput = {
  ordre: number;
  titre: string;
  description: string | null;
  expectedSignals: string | null;
  poids: number;
};

@Injectable()
export class CoachingSalesPlanApplicationService {
  private readonly logger = new Logger(CoachingSalesPlanApplicationService.name);

  constructor(
    private readonly salesPlanAgent: SalesPlanAgentService,
    private readonly salesPlanValidator: SalesPlanValidator,
  ) {}

  async applyWithLlm(input: {
    block: CoachingConversationBlock;
    salesPlanVersion: {
      label: string | null;
      promptInstructions: string | null;
      steps: SalesPlanStepInput[];
    };
    status?: string | null;
    qualityGate: QualityGateResult;
    maxTranscriptPromptChars: number;
  }): Promise<SalesPlanApplicationPayload | null> {
    const result = await this.salesPlanAgent.run({
      jobId: null,
      candidateWindowOrder: input.block.ordre,
      block: input.block,
      status: input.status,
      qualityGate: input.qualityGate,
      maxTranscriptPromptChars: input.maxTranscriptPromptChars,
      salesPlanVersion: input.salesPlanVersion,
      rawTranscriptText: this.buildRawTranscriptForBlock(input.block),
    });
    if (!result) {
      return null;
    }

    const normalized = this.normalizeApplication(
      result.parsed,
      input.salesPlanVersion.steps,
      result.rawResponse,
    );
    if (normalized.steps.length === 0) {
      this.logger.warn('apply_sales_plan: aucune étape exploitable retournée');
      return null;
    }

    const validation = this.salesPlanValidator.validate(normalized);
    const evidenceCount = normalized.steps.reduce(
      (sum, step) => sum + step.evidence.length,
      0,
    );
    this.salesPlanAgent.logValidation({
      jobId: null,
      candidateWindowOrder: input.block.ordre,
      valid: validation.valid,
      reasons: validation.reasons,
      stepsCount: normalized.steps.length,
      evidenceCount,
    });
    this.logger.log(
      `apply_sales_plan: ${normalized.steps.filter((step) => step.observed).length}/${input.salesPlanVersion.steps.length} étape(s) observée(s), uncertainties=${normalized.uncertainties.length}`,
    );
    return normalized;
  }

  buildCriterionEvidences(
    application: SalesPlanApplicationPayload,
    salesPlanSteps: Array<{ ordre: number; titre: string }>,
    blockStartTime: number,
    transcriptText?: string,
    words: TranscriptWordTiming[] = [],
  ): CriterionEvidencePayload[] {
    const titleByOrder = new Map(
      salesPlanSteps.map((step) => [step.ordre, step.titre]),
    );
    return application.steps.map((step) =>
      this.buildCriterionEvidence(
        step,
        titleByOrder,
        blockStartTime,
        transcriptText,
        words,
      ),
    );
  }

  buildSummary(
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

  normalizeApplicationTime(
    value: number | null | undefined,
    blockStartTime: number,
  ): number | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return numeric < blockStartTime && numeric < 600
      ? Number((numeric + blockStartTime).toFixed(2))
      : Number(numeric.toFixed(2));
  }

  private buildRawTranscriptForBlock(block: CoachingConversationBlock): string {
    if (block.sourceTranscriptSegments?.length) {
      return buildTranscriptText(block.sourceTranscriptSegments);
    }
    return block.transcriptText;
  }

  private normalizeApplication(
    raw: Record<string, unknown>,
    salesPlanSteps: Array<{ ordre: number; titre: string }>,
    rawResponse: string,
  ): SalesPlanApplicationPayload {
    const stepOrders = new Set(salesPlanSteps.map((step) => step.ordre));
    const steps = (Array.isArray(raw.steps) ? raw.steps : [])
      .map((item) => this.normalizeStep(item, stepOrders))
      .filter((step): step is SalesPlanStepApplicationPayload =>
        Boolean(step),
      );
    return {
      conversationSummary: normalizeText(raw.conversationSummary),
      steps,
      keyMoments: this.normalizeKeyMoments(raw.keyMoments),
      strengths: normalizeTextArray(raw.strengths),
      improvements: normalizeTextArray(raw.improvements),
      recommendations: normalizeTextArray(raw.recommendations),
      uncertainties: normalizeTextArray(raw.uncertainties),
      rawResponse,
    };
  }

  private normalizeStep(
    value: unknown,
    stepOrders: Set<number>,
  ): SalesPlanStepApplicationPayload | null {
    if (!isRecord(value)) {
      return null;
    }
    const stepOrder = Number(value.stepOrder);
    if (!Number.isFinite(stepOrder) || !stepOrders.has(stepOrder)) {
      return null;
    }
    const observed = Boolean(value.observed);
    return {
      stepOrder,
      stepTitle: normalizeText(value.stepTitle),
      observed,
      quality: this.normalizeQuality(value.quality, observed),
      confidence: this.normalizeConfidence(value.confidence),
      evidence: this.normalizeEvidence(value.evidence),
      evidenceCompleteness: this.normalizeEvidenceCompleteness(
        value.evidenceCompleteness,
        observed,
      ),
      missingBecause: this.normalizeMissingBecause(value.missingBecause, observed),
      scoreable: value.scoreable !== false,
      whatWentWell: normalizeTextArray(value.whatWentWell),
      whatIsMissing: normalizeTextArray(value.whatIsMissing),
      coachingAdvice: normalizeTextArray(value.coachingAdvice),
      reasoning: normalizeText(value.reasoning),
    };
  }

  private normalizeEvidence(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item) => {
        if (!isRecord(item)) {
          return null;
        }
        const verbatim = normalizeText(item.verbatim);
        return verbatim
          ? {
              verbatim,
              startTime: normalizeNullableNumber(item.startTime),
              endTime: normalizeNullableNumber(item.endTime),
              reason: normalizeText(item.reason),
              sourceTurnIds: normalizeTextArray(item.sourceTurnIds),
            }
          : null;
      })
      .filter(
        (
          item,
        ): item is {
          verbatim: string;
          startTime: number | null;
          endTime: number | null;
          reason: string | null;
          sourceTurnIds: string[];
        } => Boolean(item),
      );
  }

  private normalizeKeyMoments(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item) => {
        if (!isRecord(item)) {
          return null;
        }
        return {
          type: normalizeText(item.type) ?? 'A_REVOIR',
          title: normalizeText(item.title),
          summary: normalizeText(item.summary),
          verbatim: normalizeText(item.verbatim),
          startTime: normalizeNullableNumber(item.startTime),
          endTime: normalizeNullableNumber(item.endTime),
          importance: normalizeNullableNumber(item.importance),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }

  private buildCriterionEvidence(
    step: SalesPlanStepApplicationPayload,
    titleByOrder: Map<number, string>,
    blockStartTime: number,
    transcriptText?: string,
    words: TranscriptWordTiming[] = [],
  ): CriterionEvidencePayload {
    const evidence = step.evidence[0];
    const verbatim = normalizeText(evidence?.verbatim);
    const scoreable = step.scoreable !== false;
    const hasVerbatim = step.observed && Boolean(verbatim);
    const found = hasVerbatim && scoreable;
    const wordRange = hasVerbatim
      ? resolveExcerptTimeRangeFromWords(words, verbatim)
      : null;
    const fallbackRange = hasVerbatim
      ? resolveExcerptTimeRange(transcriptText ?? '', verbatim)
      : null;
    const startTime =
      evidence?.startTime !== null && evidence?.startTime !== undefined
        ? this.normalizeApplicationTime(evidence.startTime, blockStartTime)
        : (wordRange?.start ?? fallbackRange?.start ?? null);
    const endTime =
      evidence?.endTime !== null && evidence?.endTime !== undefined
        ? this.normalizeApplicationTime(evidence.endTime, blockStartTime)
        : (wordRange?.end ?? fallbackRange?.end ?? null);

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
      verbatim: step.observed && verbatim ? verbatim : null,
      startTime,
      endTime,
      reason:
        evidence?.reason ??
        step.reasoning ??
        (found
          ? 'Étape observée dans le transcript.'
          : 'Étape non observée dans le transcript.'),
      evidenceCompleteness: step.evidenceCompleteness,
      missingBecause: step.missingBecause,
      scoreable,
      sourceTurnIds: evidence?.sourceTurnIds ?? [],
      reviewStatus:
        step.confidence < 0.55 || !scoreable ? 'PENDING' : 'NOT_REQUIRED',
    };
  }

  private normalizeQuality(value: unknown, observed: boolean) {
    if (!observed) {
      return 'MISSING';
    }
    return value === 'COMPLETE' ||
      value === 'PARTIAL' ||
      value === 'WEAK' ||
      value === 'MISSING'
      ? value
      : 'PARTIAL';
  }

  private normalizeEvidenceCompleteness(value: unknown, observed: boolean) {
    return value === 'FULL' ||
      value === 'PARTIAL' ||
      value === 'UNCERTAIN' ||
      value === 'NONE'
      ? value
      : observed
        ? 'PARTIAL'
        : 'NONE';
  }

  private normalizeMissingBecause(value: unknown, observed: boolean) {
    return value === 'NOT_OBSERVED' ||
      value === 'TRANSCRIPT_UNCLEAR' ||
      value === 'NOT_APPLICABLE'
      ? value
      : observed
        ? null
        : 'NOT_OBSERVED';
  }

  private normalizeConfidence(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : 0.6;
  }
}
