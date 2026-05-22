import { Injectable } from '@nestjs/common';
import { CoachingVllmClient } from '../infrastructure/coaching-vllm-client.service';
import {
  buildClassifyUserPrompt,
  CLASSIFY_JSON_SCHEMA,
  CLASSIFY_SYSTEM_PROMPT,
} from '../utils/coaching-llm-prompts.constants';
import { parseLlmJson } from '../utils/coaching-llm-helpers.utils';
import {
  resolveConvClassifyEnabled,
  resolveConvClassifyMaxTokens,
} from '../utils/coaching-env-resolvers.utils';
import { isRecord } from './coaching-engine.types';

type SalesPlanWithSteps = {
  steps: Array<{
    ordre: number;
    titre: string;
    description: string | null;
    expectedSignals: string | null;
    poids: number;
  }>;
};

@Injectable()
export class CoachingConversationClassifierService {
  constructor(private readonly vllmClient: CoachingVllmClient) {}

  async resolveEffectivePlan<T extends SalesPlanWithSteps>(
    salesPlanVersion: T,
    transcriptText: string,
  ): Promise<T> {
    const classification = await this.classifyConversation(
      salesPlanVersion,
      transcriptText,
    );
    if (!classification) {
      return salesPlanVersion;
    }
    const allowed = new Set(classification.applicableStepOrders);
    return {
      ...salesPlanVersion,
      steps: salesPlanVersion.steps.filter((step) => allowed.has(step.ordre)),
    };
  }

  private async classifyConversation(
    salesPlanVersion: {
      steps: Array<{
        ordre: number;
        titre: string;
        expectedSignals: string | null;
      }>;
    },
    transcriptText: string,
  ): Promise<{
    type: string;
    applicableStepOrders: number[];
    reason: string;
  } | null> {
    if (
      !resolveConvClassifyEnabled() ||
      !this.vllmClient.isConfigured() ||
      !transcriptText.trim()
    ) {
      return null;
    }

    const messages = [
      { role: 'system', content: CLASSIFY_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildClassifyUserPrompt(
          this.buildStepsList(salesPlanVersion),
          this.buildSnippet(transcriptText),
        ),
      },
    ];

    const result = await this.vllmClient.chat(
      {
        model: this.vllmClient.model,
        temperature: 0,
        max_tokens: resolveConvClassifyMaxTokens(),
        messages,
        response_format: { type: 'json_schema', json_schema: CLASSIFY_JSON_SCHEMA },
      },
      { step: 'conv_classify' },
    );
    if (!result) {
      return null;
    }

    const parsed = parseLlmJson(result.content);
    if (!isRecord(parsed)) {
      return null;
    }

    const orders = Array.isArray(parsed.applicableStepOrders)
      ? parsed.applicableStepOrders
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0)
      : [];
    if (orders.length === 0) {
      return null;
    }

    return {
      type: typeof parsed.type === 'string' ? parsed.type : 'UNKNOWN',
      applicableStepOrders: orders,
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    };
  }

  private buildStepsList(salesPlanVersion: {
    steps: Array<{
      ordre: number;
      titre: string;
      expectedSignals: string | null;
    }>;
  }): string {
    return salesPlanVersion.steps
      .map(
        (step) =>
          `${step.ordre}. ${step.titre}${step.expectedSignals ? ' — ' + step.expectedSignals.slice(0, 180) : ''}`,
      )
      .join('\n');
  }

  private buildSnippet(transcriptText: string): string {
    const shortThreshold = 10_000;
    const windowChars = 700;
    if (transcriptText.length <= shortThreshold) {
      const head = transcriptText.slice(0, windowChars);
      const tail =
        transcriptText.length > windowChars * 2
          ? '\n[...]\n' + transcriptText.slice(-windowChars)
          : '';
      return head + tail;
    }

    const half = Math.floor(windowChars / 2);
    const labels = ['debut', 'quart', 'mi-parcours', 'trois-quart'];
    const starts = [
      0,
      Math.max(windowChars, Math.floor(transcriptText.length * 0.25) - half),
      Math.max(windowChars, Math.floor(transcriptText.length * 0.5) - half),
      Math.max(windowChars, Math.floor(transcriptText.length * 0.75) - half),
    ];
    const windows = starts.map((pos, index) => {
      const chunk = transcriptText.slice(pos, pos + windowChars);
      return `[fenêtre ${labels[index]}]\n${chunk}`;
    });
    return [...windows, `[fenêtre fin]\n${transcriptText.slice(-windowChars)}`].join(
      '\n[...]\n',
    );
  }
}
