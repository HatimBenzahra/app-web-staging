import { formatTimestamp } from '../../utils/coaching-aggregation.utils';
import { buildTranscriptText } from '../../utils/conversation-blocks.utils';
import { normalizeText } from '../../utils/evaluation-normalizers.utils';
import { parseTimestampedTranscript } from '../../utils/transcript-parsing.utils';
import type {
  ConversationKind,
  DialogueReconstructionPayload,
  DialogueTurnPayload,
} from '../../types/coaching-dialogue.types';
import type {
  TranscriptCleanerAgentInput,
  TranscriptCleanerAgentResult,
} from './transcript-cleaner-agent.types';

export function extractTranscriptForCleanerBlock(
  transcriptText: string,
  bounds: { startTime: number; endTime: number },
): string {
  const segments = parseTimestampedTranscript(transcriptText);
  if (segments.length === 0) {
    return transcriptText;
  }
  const matching = segments.filter(
    (segment) =>
      segment.end >= bounds.startTime && segment.start <= bounds.endTime,
  );
  return matching.length > 0 ? buildTranscriptText(matching) : '';
}

export function mergeCleanerResults(
  results: TranscriptCleanerAgentResult[],
): DialogueReconstructionPayload | null {
  if (results.length === 0) {
    return null;
  }
  const turns = mergeAdjacentDialogueTurns(
    results
      .flatMap((result) => result.turns)
      .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0)),
  );
  if (turns.length === 0) {
    return null;
  }
  const usableForScoring = results.some((result) => result.usableForScoring);
  return {
    conversationKind: resolveCombinedConversationKind(
      results.map((result) => result.conversationKind),
    ),
    usableForScoring,
    scoreabilityReason:
      results
        .map((result) => result.scoreabilityReason)
        .filter((reason): reason is string => Boolean(reason))
        .join(' ') || null,
    prospectTurnCount: turns.filter((turn) => turn.speaker === 'PROSPECT').length,
    internalTurnCount: turns.filter((turn) => turn.speaker === 'INTERNAL').length,
    unknownTurnCount: turns.filter((turn) => turn.speaker === 'UNKNOWN').length,
    averageConfidence:
      turns.length === 0
        ? 0
        : normalizeConfidence(
            turns.reduce((sum, turn) => sum + turn.confidence, 0) / turns.length,
          ),
    turns,
    uncertainties: dedupeTextArray(
      results.flatMap((result) => result.uncertainties),
    ),
    rawResponse: results
      .map((result) => result.rawResponse)
      .filter((raw): raw is string => Boolean(raw))
      .join('\n---\n'),
  };
}

export function renderCleanerDialogueTurns(
  turns: DialogueTurnPayload[],
): string {
  return turns
    .filter((turn) => turn.displayable !== false)
    .map((turn) => {
      const start = turn.startTime === null ? '??:??' : formatTimestamp(turn.startTime);
      const end = turn.endTime === null ? '??:??' : formatTimestamp(turn.endTime);
      const speaker =
        turn.speaker === 'COMMERCIAL'
          ? 'Commercial'
          : turn.speaker === 'PROSPECT'
            ? 'Client'
            : 'Contexte';
      return `[${start}-${end}] ${speaker}: ${turn.text}`;
    })
    .join('\n');
}

export function buildFallbackCleanerResult(
  input: TranscriptCleanerAgentInput,
): TranscriptCleanerAgentResult | null {
  const segments = parseTimestampedTranscript(input.transcriptText).filter(
    (segment) =>
      segment.end >= input.block.startTime &&
      segment.start <= input.block.endTime,
  );
  const sourceSegments =
    segments.length > 0
      ? segments
      : input.transcriptText.trim()
        ? [{
            start: input.block.startTime,
            end: input.block.endTime,
            text: input.transcriptText.trim(),
          }]
        : [];
  if (sourceSegments.length === 0) return null;
  const turns: DialogueTurnPayload[] = sourceSegments.map((segment) => {
    const speaker =
      input.block.type === 'INTERNAL_DISCUSSION' ? 'INTERNAL' : 'UNKNOWN';
    const text =
      input.block.type === 'INAUDIBLE'
        ? '[passage inaudible]'
        : segment.text.slice(0, 600);
    return {
      speaker,
      startTime: segment.start,
      endTime: segment.end,
      text,
      rawText: segment.text,
      normalizedText: text,
      sourceQuote: segment.text,
      confidence: 0.28,
      speakerConfidence: 0.25,
      textConfidence: 0.28,
      correctionLevel: 'NONE',
      normalizations: [],
      scorable: false,
      displayable: true,
      blockType: input.block.type,
      exclusionReason: 'fallback_transcription_only',
      reason:
        'Fallback transcription: LLM cleaner indisponible ou JSON invalide.',
    };
  });
  return {
    conversationKind:
      input.block.type === 'INTERNAL_DISCUSSION'
        ? 'INTERNAL'
        : input.block.type === 'NOISE'
          ? 'NOISE'
          : 'UNKNOWN',
    usableForScoring: false,
    scoreabilityReason: 'Fallback transcription uniquement, non exploitable.',
    prospectTurnCount: 0,
    internalTurnCount: turns.filter((turn) => turn.speaker === 'INTERNAL').length,
    unknownTurnCount: turns.filter((turn) => turn.speaker === 'UNKNOWN').length,
    averageConfidence: 0.28,
    turns,
    uncertainties: ['transcript_cleaner_fallback'],
    rawResponse: null,
    sourceBlockId: input.block.id,
    sourceBlockType: input.block.type,
  };
}

function resolveCombinedConversationKind(values: ConversationKind[]): ConversationKind {
  const kinds = new Set(values);
  if (kinds.size === 0) return 'UNKNOWN';
  if (kinds.size === 1) return values[0] ?? 'UNKNOWN';
  if (kinds.has('PROSPECT') && kinds.has('INTERNAL')) return 'MIXED';
  if (kinds.has('PROSPECT')) return 'MIXED';
  if (kinds.has('INTERNAL')) return 'INTERNAL';
  if (kinds.has('NOISE')) return 'NOISE';
  return 'UNKNOWN';
}

function mergeAdjacentDialogueTurns(turns: DialogueTurnPayload[]): DialogueTurnPayload[] {
  const output: DialogueTurnPayload[] = [];
  for (const turn of turns) {
    const previous = output[output.length - 1];
    const gap =
      previous?.endTime !== null &&
      previous?.endTime !== undefined &&
      turn.startTime !== null
        ? turn.startTime - previous.endTime
        : Number.POSITIVE_INFINITY;
    if (previous && previous.speaker === turn.speaker && previous.blockType === turn.blockType && gap >= 0 && gap <= 2.5) {
      previous.endTime = turn.endTime ?? previous.endTime;
      previous.text = `${previous.text} ${turn.text}`.replace(/\s+/g, ' ');
      previous.rawText = `${previous.rawText ?? previous.text} ${turn.rawText ?? turn.text}`.replace(/\s+/g, ' ');
      previous.normalizedText = previous.text;
      previous.sourceQuote = `${previous.sourceQuote ?? ''} ${turn.sourceQuote ?? turn.rawText ?? turn.text}`.trim().replace(/\s+/g, ' ');
      previous.confidence = Math.min(previous.confidence, turn.confidence);
      previous.speakerConfidence = Math.min(previous.speakerConfidence ?? previous.confidence, turn.speakerConfidence ?? turn.confidence);
      previous.textConfidence = Math.min(previous.textConfidence ?? previous.confidence, turn.textConfidence ?? turn.confidence);
      previous.normalizations = [...(previous.normalizations ?? []), ...(turn.normalizations ?? [])];
      previous.scorable = previous.scorable !== false && turn.scorable !== false;
      previous.exclusionReason = previous.exclusionReason ?? turn.exclusionReason ?? null;
      continue;
    }
    output.push({ ...turn });
  }
  return output;
}

function normalizeConfidence(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.5;
  return Number(Math.min(1, Math.max(0, numeric)).toFixed(3));
}

function dedupeTextArray(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const cleaned = normalizeText(value);
    if (!cleaned) return false;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
