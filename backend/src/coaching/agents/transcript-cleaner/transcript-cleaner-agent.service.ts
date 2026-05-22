import { Injectable } from '@nestjs/common';
import {
  normalizeNullableNumber,
  normalizeText,
  normalizeTextArray,
} from '../../utils/evaluation-normalizers.utils';
import type {
  ConversationKind,
  CorrectionLevel,
  DialogueNormalizationPayload,
  DialogueReconstructionPayload,
  DialogueSpeaker,
  DialogueTurnPayload,
} from '../../types/coaching-dialogue.types';
import { TranscriptCleanerValidator } from '../../validators/transcript-cleaner.validator';
import { finalizeTranscriptionForUser } from '../../utils/transcription-finalizer.utils';
import { isRecord } from '../shared/coaching-agent-json.utils';
import { CoachingAgentLogger } from '../shared/coaching-agent-logger.service';
import { CoachingAgentRunner } from '../shared/coaching-agent-runner.service';
import {
  buildTranscriptCleanerAgentUserPrompt,
  TRANSCRIPT_CLEANER_AGENT_PROMPT_VERSION,
  TRANSCRIPT_CLEANER_AGENT_SYSTEM_PROMPT,
} from './transcript-cleaner-agent.prompt';
import { TRANSCRIPT_CLEANER_AGENT_JSON_SCHEMA } from './transcript-cleaner-agent.schema';
import {
  TranscriptCleanerAgentInput,
  TranscriptCleanerAgentResult,
} from './transcript-cleaner-agent.types';
import {
  extractTranscriptForCleanerBlock,
  buildFallbackCleanerResult,
  mergeCleanerResults,
  renderCleanerDialogueTurns,
} from './transcript-cleaner-agent-output.utils';

@Injectable()
export class TranscriptCleanerAgentService {
  constructor(
    private readonly runner: CoachingAgentRunner,
    private readonly logger: CoachingAgentLogger,
    private readonly validator: TranscriptCleanerValidator,
  ) {}

  async run(
    input: TranscriptCleanerAgentInput,
  ): Promise<TranscriptCleanerAgentResult | null> {
    if (!input.transcriptText.trim()) {
      return null;
    }

    const context = {
      agent: 'transcript_cleaner' as const,
      jobId: input.jobId,
      candidateWindowOrder: input.candidateWindowOrder,
      stage: `clean_block_${input.block.id}`,
    };
    const userPrompt = buildTranscriptCleanerAgentUserPrompt({
      candidateWindowOrder: input.candidateWindowOrder,
      startTime: input.block.startTime,
      endTime: input.block.endTime,
      status: input.status,
      transcriptText: input.transcriptText,
      memory: input.memory,
    });

    this.logger.request({
      ...context,
      promptVersion: TRANSCRIPT_CLEANER_AGENT_PROMPT_VERSION,
      inputChars: input.transcriptText.length,
    });

    const result = await this.runner.runJson(context, {
      systemPrompt: TRANSCRIPT_CLEANER_AGENT_SYSTEM_PROMPT,
      userPrompt,
      jsonSchema: TRANSCRIPT_CLEANER_AGENT_JSON_SCHEMA,
      maxTokens: 4000,
      temperature: 0,
      promptVersion: TRANSCRIPT_CLEANER_AGENT_PROMPT_VERSION,
    });

    if (!result) {
      const fallback = buildFallbackCleanerResult(input);
      this.logger.response({
        ...context,
        rawResponseChars: 0,
        outputItems: fallback?.turns.length ?? 0,
      });
      this.logger.validator({
        ...context,
        valid: false,
        reasons: ['transcript_cleaner_fallback'],
      });
      return fallback;
    }

    const normalized = this.normalizeDialogueReconstruction(
      result.parsed,
      input.block.startTime,
      input.block.endTime,
    );
    normalized.rawResponse = result.rawResponse;
    const faithful = this.validator.validate(normalized);
    const reconstruction = faithful.reconstruction;
    const metrics = faithful.metrics;

    this.logger.response({
      ...context,
      rawResponseChars: result.rawResponse.length,
      outputItems: reconstruction.turns.length,
    });
    this.logger.validator({
      ...context,
      valid: reconstruction.usableForScoring,
      reasons: metrics.decisionReasons,
    });
    this.logger.persisted({
      ...context,
      valid: true,
      reasons: [
        `quality=${metrics.cleanTranscriptQuality}`,
        `displayableTurns=${metrics.displayableTurns}`,
        `scorableTurns=${metrics.scorableLaterTurns}`,
        `riskyCorrections=${metrics.riskyNormalizationCount}`,
      ],
    });

    return {
      ...reconstruction,
      qualityMetrics: metrics,
      sourceBlockId: input.block.id,
      sourceBlockType: input.block.type,
    };
  }

  extractTranscriptForBlock(
    transcriptText: string,
    bounds: { startTime: number; endTime: number },
  ): string {
    return extractTranscriptForCleanerBlock(transcriptText, bounds);
  }

  mergeResults(
    results: TranscriptCleanerAgentResult[],
  ): DialogueReconstructionPayload | null {
    const reconstruction = mergeCleanerResults(results);
    if (!reconstruction) return null;
    const faithful = this.validator.validate(reconstruction);
    const finalized = finalizeTranscriptionForUser(faithful.reconstruction);
    return {
      ...finalized,
      qualityMetrics: faithful.metrics,
    };
  }

  renderDialogueTurns(turns: DialogueTurnPayload[]): string {
    return renderCleanerDialogueTurns(turns);
  }

  private normalizeDialogueReconstruction(
    raw: Record<string, unknown>,
    blockStartTime: number,
    blockEndTime: number,
  ): DialogueReconstructionPayload {
    const turns = Array.isArray(raw.turns)
      ? raw.turns
          .map<DialogueTurnPayload | null>((item) => {
            if (!isRecord(item)) {
              return null;
            }
            const text = normalizeText(item.text);
            if (!text) {
              return null;
            }
            const startTime = this.normalizeDialogueTime(
              item.startTime,
              blockStartTime,
              blockEndTime,
            );
            const endTime = this.normalizeDialogueTime(
              item.endTime,
              blockStartTime,
              blockEndTime,
            );
            return {
              speaker: this.normalizeDialogueSpeaker(item.speaker),
              startTime,
              endTime:
                endTime !== null && startTime !== null && endTime < startTime
                  ? startTime
                  : endTime,
              text,
              rawText: normalizeText(item.rawText) ?? text,
              normalizedText: normalizeText(item.normalizedText) ?? text,
              sourceQuote:
                normalizeText(item.sourceQuote) ??
                normalizeText(item.rawText) ??
                text,
              confidence: this.normalizeConfidence(item.confidence),
              speakerConfidence:
                normalizeNullableNumber(item.speakerConfidence) ??
                this.normalizeConfidence(item.confidence),
              textConfidence:
                normalizeNullableNumber(item.textConfidence) ??
                this.normalizeConfidence(item.confidence),
              correctionLevel: this.normalizeCorrectionLevel(
                item.correctionLevel,
              ),
              normalizations: this.normalizeDialogueNormalizations(
                item.normalizations,
              ),
              scorable: Boolean(item.scorable),
              displayable: item.displayable !== false,
              blockType: this.normalizeDialogueBlockType(item.blockType),
              exclusionReason: normalizeText(item.exclusionReason),
              reason: normalizeText(item.reason),
            };
          })
          .filter((turn): turn is DialogueTurnPayload => Boolean(turn))
      : [];

    return {
      conversationKind: this.normalizeConversationKind(raw.conversationKind),
      usableForScoring: Boolean(raw.usableForScoring),
      scoreabilityReason: normalizeText(raw.scoreabilityReason),
      prospectTurnCount: turns.filter((turn) => turn.speaker === 'PROSPECT').length,
      internalTurnCount: turns.filter((turn) => turn.speaker === 'INTERNAL').length,
      unknownTurnCount: turns.filter((turn) => turn.speaker === 'UNKNOWN').length,
      averageConfidence:
        turns.length === 0
          ? 0
          : this.normalizeConfidence(
              turns.reduce((sum, turn) => sum + turn.confidence, 0) /
                turns.length,
            ),
      turns,
      uncertainties: normalizeTextArray(raw.uncertainties),
    };
  }

  private normalizeDialogueSpeaker(value: unknown): DialogueSpeaker {
    return value === 'COMMERCIAL' ||
      value === 'PROSPECT' ||
      value === 'INTERNAL' ||
      value === 'UNKNOWN'
      ? value
      : 'UNKNOWN';
  }

  private normalizeConversationKind(value: unknown): ConversationKind {
    return value === 'PROSPECT' ||
      value === 'INTERNAL' ||
      value === 'MIXED' ||
      value === 'NOISE' ||
      value === 'UNKNOWN'
      ? value
      : 'UNKNOWN';
  }

  private normalizeCorrectionLevel(value: unknown): CorrectionLevel {
    return value === 'NONE' ||
      value === 'LIGHT' ||
      value === 'MEDIUM' ||
      value === 'RISKY'
      ? value
      : 'NONE';
  }

  private normalizeDialogueBlockType(
    value: unknown,
  ): DialogueTurnPayload['blockType'] {
    return value === 'PROSPECT_INTERACTION' ||
      value === 'INTERNAL_DISCUSSION' ||
      value === 'NOISE' ||
      value === 'INAUDIBLE' ||
      value === 'UNCERTAIN'
      ? value
      : 'UNCERTAIN';
  }

  private normalizeDialogueNormalizations(
    value: unknown,
  ): DialogueNormalizationPayload[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item): DialogueNormalizationPayload | null => {
        if (!isRecord(item)) {
          return null;
        }
        const raw = normalizeText(item.raw);
        const normalized = normalizeText(item.normalized);
        if (!raw || !normalized) {
          return null;
        }
        const type =
          item.type === 'DOMAIN_VOCABULARY' ||
          item.type === 'PHONETIC_CONTEXTUAL' ||
          item.type === 'PUNCTUATION' ||
          item.type === 'SEGMENTATION' ||
          item.type === 'NONE'
            ? item.type
            : 'NONE';
        return {
          raw,
          normalized,
          type,
          confidence: this.normalizeConfidence(item.confidence),
          meaningChanged: Boolean(item.meaningChanged),
          reason: normalizeText(item.reason),
        };
      })
      .filter(
        (normalization): normalization is DialogueNormalizationPayload =>
          Boolean(normalization),
      );
  }

  private normalizeDialogueTime(
    value: unknown,
    blockStartTime: number,
    blockEndTime: number,
  ): number | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    const absolute =
      numeric < blockStartTime && numeric < Math.max(600, blockEndTime)
        ? numeric + blockStartTime
        : numeric;
    return Number(
      Math.min(blockEndTime, Math.max(blockStartTime, absolute)).toFixed(2),
    );
  }

  private normalizeConfidence(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0.5;
    return Number(Math.min(1, Math.max(0, numeric)).toFixed(3));
  }

  private dedupeTextArray(values: string[]): string[] {
    const seen = new Set<string>();
    const output: string[] = [];
    for (const value of values) {
      const cleaned = normalizeText(value);
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(cleaned);
    }
    return output;
  }
}
