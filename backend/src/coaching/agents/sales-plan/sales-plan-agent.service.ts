import { Injectable } from '@nestjs/common';
import { buildTranscriptText } from '../../utils/conversation-blocks.utils';
import { truncateTranscriptForPrompt } from '../../utils/coaching-llm-helpers.utils';
import { CoachingAgentLogger } from '../shared/coaching-agent-logger.service';
import { CoachingAgentRunner } from '../shared/coaching-agent-runner.service';
import {
  buildSalesPlanAgentUserPrompt,
  SALES_PLAN_AGENT_PROMPT_VERSION,
  SALES_PLAN_AGENT_SYSTEM_PROMPT,
} from './sales-plan-agent.prompt';
import { SALES_PLAN_AGENT_JSON_SCHEMA } from './sales-plan-agent.schema';
import {
  SalesPlanAgentInput,
  SalesPlanAgentRawResult,
} from './sales-plan-agent.types';

@Injectable()
export class SalesPlanAgentService {
  constructor(
    private readonly runner: CoachingAgentRunner,
    private readonly logger: CoachingAgentLogger,
  ) {}

  async run(input: SalesPlanAgentInput): Promise<SalesPlanAgentRawResult | null> {
    const context = {
      agent: 'sales_plan' as const,
      jobId: input.jobId,
      candidateWindowOrder: input.candidateWindowOrder,
      stage: 'apply_sales_plan',
    };
    const dialogueText = truncateTranscriptForPrompt(
      input.block.transcriptText,
      input.maxTranscriptPromptChars,
    );
    const rawTranscriptText = truncateTranscriptForPrompt(
      input.rawTranscriptText ?? this.buildRawTranscriptForBlock(input.block),
      input.maxTranscriptPromptChars,
    );
    const userPrompt = buildSalesPlanAgentUserPrompt({
      dialogueText,
      rawTranscriptText,
      status: input.status,
      segmentMetadata: {
        startTime: input.block.startTime,
        endTime: input.block.endTime,
        durationSec: input.block.endTime - input.block.startTime,
        source: input.block.segmentSource,
        type: input.block.segmentType,
        confidence: input.block.segmentConfidence,
        speechScore: input.block.speechScore,
        qualityGate: input.qualityGate,
      },
      salesPlan: {
        label: input.salesPlanVersion.label,
        promptInstructions: input.salesPlanVersion.promptInstructions,
        steps: input.salesPlanVersion.steps,
      },
    });

    this.logger.request({
      ...context,
      promptVersion: SALES_PLAN_AGENT_PROMPT_VERSION,
      inputChars: userPrompt.length,
      inputBlocks: input.salesPlanVersion.steps.length,
    });

    const result = await this.runner.runJson(context, {
      systemPrompt: SALES_PLAN_AGENT_SYSTEM_PROMPT,
      userPrompt,
      jsonSchema: SALES_PLAN_AGENT_JSON_SCHEMA,
      maxTokens: 2400,
      temperature: 0.2,
      promptVersion: SALES_PLAN_AGENT_PROMPT_VERSION,
    });

    if (!result) {
      return null;
    }

    this.logger.response({
      ...context,
      rawResponseChars: result.rawResponse.length,
      outputItems: Array.isArray(result.parsed.steps)
        ? result.parsed.steps.length
        : 0,
    });

    return result;
  }

  logValidation(input: {
    jobId?: number | null;
    candidateWindowOrder: number;
    valid: boolean;
    reasons: string[];
    stepsCount: number;
    evidenceCount: number;
  }): void {
    const context = {
      agent: 'sales_plan' as const,
      jobId: input.jobId,
      candidateWindowOrder: input.candidateWindowOrder,
      stage: 'apply_sales_plan',
    };
    this.logger.validator({
      ...context,
      valid: input.valid,
      reasons: [
        ...input.reasons,
        `steps=${input.stepsCount}`,
        `evidence=${input.evidenceCount}`,
      ],
    });
    this.logger.persisted({
      ...context,
      valid: input.valid,
      reasons: [
        `steps=${input.stepsCount}`,
        `evidence=${input.evidenceCount}`,
      ],
    });
  }

  private buildRawTranscriptForBlock(input: {
    sourceTranscriptSegments?: Array<{ start: number; end: number; text: string }>;
    transcriptText: string;
  }): string {
    if (input.sourceTranscriptSegments && input.sourceTranscriptSegments.length > 0) {
      return buildTranscriptText(input.sourceTranscriptSegments);
    }
    return input.transcriptText;
  }
}
