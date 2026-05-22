import { Injectable, Logger } from '@nestjs/common';
import { CoachingVllmClient } from '../infrastructure/coaching-vllm-client.service';
import { CoachingAnalysisPipelineService } from '../pipeline/coaching-analysis-pipeline.service';
import { TRANSCRIPT_CLEANER_AGENT_PROMPT_VERSION } from '../agents/transcript-cleaner/transcript-cleaner-agent.prompt';
import {
  buildRewriteUserPrompt,
  REWRITE_SYSTEM_PROMPT,
} from '../utils/coaching-llm-prompts.constants';
import {
  estimatePromptCharsApprox,
  resolveRewriteMaxTokens,
  truncateTranscriptForPrompt,
} from '../utils/coaching-llm-helpers.utils';
import {
  resolveEvaluationBatchSize,
  resolveMaxTranscriptPromptChars,
} from '../utils/coaching-env-resolvers.utils';
import { prepareTranscriptForReadabilityPrompt } from '../utils/coaching-transcript-readability.utils';
import type { DialogueFaithfulnessMetrics } from '../utils/dialogue-faithfulness.utils';
import { CoachingAnalysisJobService } from './coaching-analysis-job.service';
import type { CoachingConversationBlock } from './coaching-engine.types';

@Injectable()
export class CoachingReadableTranscriptService {
  private readonly logger = new Logger(CoachingReadableTranscriptService.name);
  private readonly maxTranscriptPromptChars = resolveMaxTranscriptPromptChars();
  private readonly contextWindowTokens = (() => {
    const raw = Number(process.env.VLLM_CONTEXT_WINDOW_TOKENS);
    return !Number.isFinite(raw) || raw < 2048 ? 24576 : Math.floor(raw);
  })();
  private readonly tokensPerCharEstimate = 1 / 3.5;
  private readonly safetyMarginTokens = 500;

  constructor(
    private readonly vllmClient: CoachingVllmClient,
    private readonly analysisPipeline: CoachingAnalysisPipelineService,
    private readonly jobs: CoachingAnalysisJobService,
  ) {}

  async ensureReadableConversations(
    blocks: CoachingConversationBlock[],
    jobId?: number,
  ): Promise<CoachingConversationBlock[]> {
    if (blocks.length === 0) {
      return [];
    }

    const results: CoachingConversationBlock[] = new Array(blocks.length);
    const batchSize = resolveEvaluationBatchSize();

    for (let start = 0; start < blocks.length; start += batchSize) {
      const end = Math.min(start + batchSize, blocks.length);
      await this.jobs.updateAnalysisJobStep(
        jobId,
        blocks.length === 1
          ? 'Stage 3 — Transcription finale fenêtre 1/1'
          : `Stage 3 — Transcription finale fenêtres ${start + 1}-${end}/${blocks.length}`,
      );
      await this.processBatch(blocks, start, end, results, jobId);
    }

    this.logger.log(
      `Stage 3 terminé: ${blocks.length} conversation(s) réécrite(s)`,
    );
    return results;
  }

  private async processBatch(
    blocks: CoachingConversationBlock[],
    start: number,
    end: number,
    results: CoachingConversationBlock[],
    jobId?: number,
  ): Promise<void> {
    const batchEntries = blocks
      .slice(start, end)
      .map((block, offset) => ({ block, idx: start + offset }));
    const settled = await Promise.allSettled(
      batchEntries.map(({ block }) => this.processBlock(block, jobId)),
    );

    for (let i = 0; i < settled.length; i += 1) {
      const entry = batchEntries[i];
      const outcome = settled[i];
      if (outcome.status === 'fulfilled') {
        results[entry.idx] = outcome.value;
      } else {
        this.logger.warn(
          `Stage 3: réécriture conv ${entry.block.ordre} échouée — garde transcript brut`,
        );
        results[entry.idx] = {
          ...entry.block,
          readableTranscriptText: entry.block.transcriptText,
        };
      }
    }
  }

  private async processBlock(
    block: CoachingConversationBlock,
    jobId?: number,
  ): Promise<CoachingConversationBlock> {
    const pipelineResult =
      await this.analysisPipeline.processCandidateWindow(block, jobId);
    const dialogue = pipelineResult.dialogue;
    const rewritten =
      pipelineResult.readableTranscriptText ||
      (await this.rewriteTranscriptForReadability(block.transcriptText));
    const shouldReviewDialogue =
      dialogue !== null && dialogue.usableForScoring === false;
    const qualityMetrics = dialogue
      ? ((dialogue.qualityMetrics as DialogueFaithfulnessMetrics | null) ?? null)
      : null;

    this.logger.log(
      `clean_transcript.persisted jobId=${jobId ?? 'null'} candidateWindowOrder=${block.ordre} readableTranscriptChars=${(rewritten || block.transcriptText).length} dialogueTurnsCount=${dialogue?.turns.length ?? 0} usableForScoring=${dialogue?.usableForScoring ?? null} quality=${qualityMetrics?.cleanTranscriptQuality ?? 'UNKNOWN'} scoreabilityReason="${dialogue?.scoreabilityReason ?? ''}"`,
    );

    return {
      ...block,
      readableTranscriptText: rewritten || block.transcriptText,
      dialogueTurns: dialogue?.turns,
      dialoguePromptVersion: dialogue
        ? TRANSCRIPT_CLEANER_AGENT_PROMPT_VERSION
        : null,
      dialogueRawResponse: dialogue?.rawResponse ?? null,
      conversationKind: dialogue?.conversationKind ?? null,
      usableForScoring: dialogue?.usableForScoring ?? null,
      scoreabilityReason: dialogue?.scoreabilityReason ?? null,
      dialogueQualityJson: qualityMetrics,
      status: shouldReviewDialogue ? 'NEEDS_REVIEW' : block.status,
      reviewReason: shouldReviewDialogue
        ? (dialogue.scoreabilityReason ??
          'Dialogue reconstruit non scorable automatiquement.')
        : block.reviewReason,
    };
  }

  private async rewriteTranscriptForReadability(
    transcriptText: string,
  ): Promise<string> {
    if (!transcriptText.trim()) {
      return transcriptText;
    }
    const rewritten = await this.rewriteTranscriptWithLlm(transcriptText);
    return rewritten || transcriptText;
  }

  private async rewriteTranscriptWithLlm(
    transcriptText: string,
  ): Promise<string | null> {
    if (!this.vllmClient.isConfigured()) {
      return null;
    }

    const messages = [
      { role: 'system', content: REWRITE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildRewriteUserPrompt(
          truncateTranscriptForPrompt(
            prepareTranscriptForReadabilityPrompt(transcriptText),
            this.maxTranscriptPromptChars,
          ),
        ),
      },
    ];
    const promptCharsApprox = estimatePromptCharsApprox(messages);
    const maxTokens = resolveRewriteMaxTokens(promptCharsApprox, {
      contextWindowTokens: this.contextWindowTokens,
      tokensPerCharEstimate: this.tokensPerCharEstimate,
      safetyMarginTokens: this.safetyMarginTokens,
    });
    if (maxTokens < 800) {
      this.logger.warn(
        `rewrite_transcript: prompt trop long (${promptCharsApprox} chars ≈ ${Math.ceil(promptCharsApprox * this.tokensPerCharEstimate)} tokens) pour ${this.contextWindowTokens} tokens de contexte. Skip rewrite.`,
      );
      return null;
    }

    const result = await this.vllmClient.chat(
      {
        model: this.vllmClient.model,
        temperature: 0,
        max_tokens: maxTokens,
        messages,
      },
      { step: 'rewrite_transcript' },
    );
    return result ? this.normalizeReadableTranscript(result.content) : null;
  }

  private normalizeReadableTranscript(value: string): string | null {
    const cleaned = value
      .replace(/^```(?:text|markdown)?/i, '')
      .replace(/```$/i, '')
      .trim();
    return cleaned.length < 20 ? null : cleaned;
  }
}
