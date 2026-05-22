import { Injectable } from '@nestjs/common';
import {
  normalizeAgentConfidence,
  normalizeAgentNumber,
  normalizeAgentText,
  normalizeAgentTextArray,
} from '../shared/coaching-agent-json.utils';
import { CoachingAgentLogger } from '../shared/coaching-agent-logger.service';
import { CoachingAgentRunner } from '../shared/coaching-agent-runner.service';
import { SegmentationValidator } from '../../validators/segmentation.validator';
import { buildFallbackSegmentationBlocks } from '../../utils/transcription-chunking.utils';
import {
  buildSegmentationAgentUserPrompt,
  SEGMENTATION_AGENT_PROMPT_VERSION,
  SEGMENTATION_AGENT_SYSTEM_PROMPT,
} from './segmentation-agent.prompt';
import { SEGMENTATION_AGENT_JSON_SCHEMA } from './segmentation-agent.schema';
import {
  SegmentationAgentInput,
  SegmentationAgentResult,
  SegmentationBlock,
  SegmentationBlockType,
} from './segmentation-agent.types';

@Injectable()
export class SegmentationAgentService {
  constructor(
    private readonly runner: CoachingAgentRunner,
    private readonly logger: CoachingAgentLogger,
    private readonly validator: SegmentationValidator,
  ) {}

  async run(input: SegmentationAgentInput): Promise<SegmentationAgentResult> {
    const context = {
      agent: 'segmentation' as const,
      jobId: input.jobId,
      candidateWindowOrder: input.candidateWindowOrder,
      stage: 'segment_candidate_window',
    };
    const userPrompt = buildSegmentationAgentUserPrompt(input);
    this.logger.request({
      ...context,
      promptVersion: SEGMENTATION_AGENT_PROMPT_VERSION,
      inputChars: input.transcriptText.length,
    });

    const result = await this.runner.runJson(context, {
      systemPrompt: SEGMENTATION_AGENT_SYSTEM_PROMPT,
      userPrompt,
      jsonSchema: SEGMENTATION_AGENT_JSON_SCHEMA,
      maxTokens: 1600,
      temperature: 0,
      promptVersion: SEGMENTATION_AGENT_PROMPT_VERSION,
    });

    const raw = result
      ? this.normalizeResult(result.parsed, result.rawResponse)
      : this.buildFallbackResult(input);
    const validated = this.validator.validate(raw, {
      startTime: input.startTime,
      endTime: input.endTime,
    });
    const finalResult = {
      ...raw,
      blocks: validated.blocks.length > 0
        ? validated.blocks
        : this.buildFallbackResult(input).blocks,
      uncertainties: [...raw.uncertainties, ...validated.reasons],
    };

    this.logger.response({
      ...context,
      rawResponseChars: finalResult.rawResponse?.length ?? 0,
      outputItems: finalResult.blocks.length,
    });
    this.logger.validator({
      ...context,
      valid: validated.reasons.length === 0,
      reasons: validated.reasons,
    });
    this.logger.persisted({
      ...context,
      valid: true,
      reasons: [
        `blocks=${finalResult.blocks.length}`,
        `prospect=${finalResult.blocks.filter((block) => block.type === 'PROSPECT_INTERACTION').length}`,
        `internal=${finalResult.blocks.filter((block) => block.type === 'INTERNAL_DISCUSSION').length}`,
        `noise=${finalResult.blocks.filter((block) => block.type === 'NOISE').length}`,
        `cleanable=${finalResult.blocks.filter((block) => block.shouldClean).length}`,
      ],
    });

    return finalResult;
  }

  private normalizeResult(
    raw: Record<string, unknown>,
    rawResponse: string,
  ): SegmentationAgentResult {
    const blocks = Array.isArray(raw.blocks)
      ? raw.blocks.map((item, index) => this.normalizeBlock(item, index))
          .filter((block): block is SegmentationBlock => Boolean(block))
      : [];
    return {
      blocks,
      uncertainties: normalizeAgentTextArray(raw.uncertainties),
      rawResponse,
    };
  }

  private normalizeBlock(value: unknown, index: number): SegmentationBlock | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const item = value as Record<string, unknown>;
    const startTime = normalizeAgentNumber(item.startTime);
    const endTime = normalizeAgentNumber(item.endTime);
    if (startTime === null || endTime === null) {
      return null;
    }
    const type = normalizeBlockType(item.type);
    return {
      id: normalizeAgentText(item.id) ?? `block-${index + 1}`,
      startTime,
      endTime,
      type,
      confidence: normalizeAgentConfidence(item.confidence),
      shouldClean:
        typeof item.shouldClean === 'boolean'
          ? item.shouldClean
          : type === 'PROSPECT_INTERACTION' ||
            type === 'INTERNAL_DISCUSSION' ||
            type === 'UNCERTAIN',
      reason: normalizeAgentText(item.reason),
    };
  }

  private buildFallbackResult(
    input: SegmentationAgentInput,
  ): SegmentationAgentResult {
    return {
      blocks: buildFallbackSegmentationBlocks(input),
      uncertainties: ['segmentation_fallback_chunked'],
      rawResponse: null,
    };
  }
}

function normalizeBlockType(value: unknown): SegmentationBlockType {
  return value === 'PROSPECT_INTERACTION' ||
    value === 'INTERNAL_DISCUSSION' ||
    value === 'NOISE' ||
    value === 'INAUDIBLE' ||
    value === 'UNCERTAIN'
    ? value
    : 'UNCERTAIN';
}
