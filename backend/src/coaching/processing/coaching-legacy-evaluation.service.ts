import { Injectable, Logger } from '@nestjs/common';
import { CoachingVllmClient } from '../infrastructure/coaching-vllm-client.service';
import {
  buildLlmSystemPrompt,
  buildLlmUserPrompt,
  estimatePromptCharsApprox,
  parseLlmJson,
  resolveEvaluationMaxTokens,
  truncateTranscriptForPrompt,
} from '../utils/coaching-llm-helpers.utils';
import { SESSION_EVALUATION_JSON_SCHEMA } from '../utils/coaching-llm-prompts.constants';
import {
  normalizeCoverageStatus,
  normalizeKeyMoment,
  normalizeNullableNumber,
  normalizeNullableScore,
  normalizeScore,
  normalizeText,
  normalizeTextArray,
} from '../utils/evaluation-normalizers.utils';
import type {
  KeyMomentPayload,
  SessionEvaluationPayload,
} from './coaching-engine.types';
import { isRecord } from './coaching-engine.types';

@Injectable()
export class CoachingLegacyEvaluationService {
  private readonly logger = new Logger(CoachingLegacyEvaluationService.name);
  private readonly contextWindowTokens = (() => {
    const raw = Number(process.env.VLLM_CONTEXT_WINDOW_TOKENS);
    return !Number.isFinite(raw) || raw < 2048 ? 24576 : Math.floor(raw);
  })();
  private readonly tokensPerCharEstimate = 1 / 3.5;
  private readonly safetyMarginTokens = 500;

  constructor(private readonly vllmClient: CoachingVllmClient) {}

  async evaluateWithLlm(
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
    maxTranscriptPromptChars: number,
  ): Promise<SessionEvaluationPayload | null> {
    if (!this.vllmClient.isConfigured()) {
      return null;
    }

    const messages = [
      { role: 'system', content: buildLlmSystemPrompt(salesPlanVersion) },
      {
        role: 'user',
        content: buildLlmUserPrompt(
          truncateTranscriptForPrompt(transcriptText, maxTranscriptPromptChars),
        ),
      },
    ];
    const promptCharsApprox = estimatePromptCharsApprox(messages);
    const maxTokens = resolveEvaluationMaxTokens(
      salesPlanVersion.steps.length,
      promptCharsApprox,
      {
        contextWindowTokens: this.contextWindowTokens,
        tokensPerCharEstimate: this.tokensPerCharEstimate,
        safetyMarginTokens: this.safetyMarginTokens,
      },
    );
    if (maxTokens < 1000) {
      this.logger.warn(
        `evaluate_session: prompt trop long (${promptCharsApprox} chars ≈ ${Math.ceil(promptCharsApprox * this.tokensPerCharEstimate)} tokens) pour ${this.contextWindowTokens} tokens de contexte. Bascule sur fallback.`,
      );
      return null;
    }

    const result = await this.vllmClient.chat(
      {
        model: this.vllmClient.model,
        temperature: 0.2,
        max_tokens: maxTokens,
        messages,
        response_format: {
          type: 'json_schema',
          json_schema: SESSION_EVALUATION_JSON_SCHEMA,
        },
      },
      { step: 'evaluate_session' },
    );
    if (!result) {
      return null;
    }
    return this.normalizeLegacyEvaluation(result.content, salesPlanVersion);
  }

  private normalizeLegacyEvaluation(
    content: string,
    salesPlanVersion: {
      steps: Array<{ titre: string }>;
    },
  ): SessionEvaluationPayload | null {
    try {
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
        keyMoments: this.normalizeKeyMoments(parsed.keyMoments),
        rawResponse: content,
        stepEvaluations: this.normalizeStepEvaluations(
          parsed.stepEvaluations,
          salesPlanVersion,
        ),
      };
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message ?? String(error);
      this.logger.warn(`Parsing évaluation LLM impossible: ${message}`);
      return null;
    }
  }

  private normalizeKeyMoments(value: unknown): KeyMomentPayload[] {
    return Array.isArray(value)
      ? value
          .map((moment: unknown) => normalizeKeyMoment(moment))
          .filter((moment): moment is KeyMomentPayload => Boolean(moment))
          .slice(0, 8)
      : [];
  }

  private normalizeStepEvaluations(
    value: unknown,
    salesPlanVersion: { steps: Array<{ titre: string }> },
  ) {
    return Array.isArray(value)
      ? value.map((stepValue: unknown, index: number) => {
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
      : [];
  }
}
