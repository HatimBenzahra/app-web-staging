import { Injectable, Logger } from '@nestjs/common';
import { CoachingVllmClient } from '../../infrastructure/coaching-vllm-client.service';
import { parseAgentJson } from './coaching-agent-json.utils';
import {
  CoachingAgentChatInput,
  CoachingAgentRunContext,
} from './coaching-agent.types';

@Injectable()
export class CoachingAgentRunner {
  private readonly logger = new Logger(CoachingAgentRunner.name);

  constructor(private readonly vllmClient: CoachingVllmClient) {}

  isConfigured(): boolean {
    return this.vllmClient.isConfigured();
  }

  async runJson(
    context: CoachingAgentRunContext,
    input: CoachingAgentChatInput,
  ): Promise<{ parsed: Record<string, unknown>; rawResponse: string } | null> {
    if (!this.vllmClient.isConfigured()) {
      return null;
    }

    const result = await this.vllmClient.chat(
      {
        model: this.vllmClient.model,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: input.jsonSchema,
        },
      },
      {
        step: `agent.${context.agent}.${context.stage}`,
        sessionId: context.jobId ?? null,
      },
    );

    if (!result) {
      return null;
    }

    const parsed = parseAgentJson(result.content);
    if (!parsed) {
      this.logger.warn(
        `agent.${context.agent}.${context.stage}: JSON invalide raw="${result.content.slice(0, 1200)}"`,
      );
      return null;
    }

    return { parsed, rawResponse: result.content };
  }
}
