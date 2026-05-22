/**
 * Conversation block construction from Whisper segments.
 * Technical gap + LLM-driven (boundaries) splitters.
 * Pure functions, no DI.
 */

import type { CoachingConversationBlock } from '../types/coaching-pipeline.types';
import { formatTimestamp } from './coaching-aggregation.utils';

type Segment = { start: number; end: number; text: string };

/** Render timestamped transcript as "[MM:SS-MM:SS] text" lines. */
export function buildTranscriptText(segments: Segment[]): string {
  return segments
    .map((segment) => {
      const start = formatTimestamp(segment.start);
      const end = formatTimestamp(segment.end);
      return `[${start}-${end}] ${segment.text.trim()}`;
    })
    .join('\n');
}

/** A block is usable for LLM eval when it's long enough or covers enough time. */
export function isConversationBlockUsable(
  transcriptText: string,
  block: Segment[],
): boolean {
  const duration =
    (block[block.length - 1]?.end ?? 0) - (block[0]?.start ?? 0);
  const words = transcriptText.split(/\s+/).filter(Boolean).length;
  return transcriptText.length >= 120 || words >= 25 || duration >= 20;
}

/** Merge short blocks into the previous one to avoid sub-30s mini-blocks. */
export function mergeTinyConversationBlocks(
  blocks: Segment[][],
  minTextLength: number,
): Segment[][] {
  return blocks.reduce<Segment[][]>((merged, block) => {
    const textLength = block.map((segment) => segment.text).join(' ').length;
    const previous = merged[merged.length - 1];
    if (textLength < minTextLength && previous) {
      previous.push(...block);
    } else {
      merged.push([...block]);
    }
    return merged;
  }, []);
}

/**
 * Greedily pack segments into char-bounded chunks (used for LLM detection input).
 * Each segment is counted as text.length + 24 chars to account for the
 * timestamp prefix that will be added later.
 */
export function splitSegmentsIntoChunks(
  segments: Segment[],
  maxCharsPerChunk: number,
): Segment[][] {
  if (segments.length === 0) return [];
  const chunks: Segment[][] = [];
  let current: Segment[] = [];
  let currentChars = 0;
  for (const segment of segments) {
    const segChars = segment.text.length + 24;
    if (currentChars + segChars > maxCharsPerChunk && current.length > 0) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(segment);
    currentChars += segChars;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

/**
 * Legacy conversation split (fallback when LLM detection/mobile doors are unavailable).
 * Splits only on long silences (>35s). It deliberately avoids greeting/closing
 * keyword markers because natural-language markers are too fragile for field audio.
 */
export function splitTranscriptIntoConversations(
  segments: Segment[],
  maxConversations: number,
): CoachingConversationBlock[] {
  const cleanSegments = segments
    .map((segment) => ({
      ...segment,
      text: segment.text.trim(),
    }))
    .filter((segment) => segment.text.length > 0)
    .sort((a, b) => a.start - b.start);

  if (cleanSegments.length === 0) {
    return [];
  }

  const blocks: Segment[][] = [];
  let current: Segment[] = [];
  const pauseThresholdSec = 35;
  const minBlockTextLength = 80;

  for (const segment of cleanSegments) {
    const previous = current[current.length - 1];
    const previousBlockText = current.map((item) => item.text).join(' ');
    const gap = previous ? segment.start - previous.end : 0;
    const shouldSplitOnPause = Boolean(
      previous &&
        gap >= pauseThresholdSec &&
        previousBlockText.length >= minBlockTextLength,
    );
    if (
      current.length > 0 &&
      shouldSplitOnPause
    ) {
      blocks.push(current);
      current = [];
    }
    current.push(segment);
  }

  if (current.length > 0) {
    blocks.push(current);
  }

  const mergedBlocks = mergeTinyConversationBlocks(
    blocks,
    minBlockTextLength,
  ).slice(0, maxConversations);

  return mergedBlocks.map((block, index) => {
    const transcriptText = buildTranscriptText(block);
    const startTime = block[0]?.start ?? 0;
    const endTime = block[block.length - 1]?.end ?? startTime;
    const usable = isConversationBlockUsable(transcriptText, block);

    return {
      ordre: index + 1,
      title: `Conversation ${index + 1} · ${formatTimestamp(startTime)}-${formatTimestamp(endTime)}`,
      startTime,
      endTime,
      transcriptText,
      segmentsCount: block.length,
      status: usable ? 'NEEDS_REVIEW' : 'SKIPPED',
      reviewReason: usable
        ? 'Segmentation legacy par pauses longues: revue requise avant scoring.'
        : 'Conversation trop courte ou trop pauvre pour une évaluation fiable.',
    };
  });
}

/**
 * Convert LLM-detected boundaries into conversation blocks by collecting the
 * segments that fall within each prospect boundary.
 */
export function buildBlocksFromBoundaries(
  boundaries: Array<{
    startTime: number;
    endTime: number;
    type: 'prospect' | 'internal' | 'noise';
    reason: string;
  }>,
  segments: Segment[],
  maxConversations: number,
): CoachingConversationBlock[] {
  const prospects = boundaries
    .filter((b) => b.type === 'prospect')
    .sort((a, b) => a.startTime - b.startTime);

  const limited = prospects.slice(0, maxConversations);

  return limited.map((boundary, index) => {
    const blockSegments = segments
      .filter(
        (s) => s.start < boundary.endTime && s.end > boundary.startTime,
      )
      .sort((a, b) => a.start - b.start);

    const transcriptText = buildTranscriptText(blockSegments);
    const start = blockSegments[0]?.start ?? boundary.startTime;
    const end =
      blockSegments[blockSegments.length - 1]?.end ?? boundary.endTime;
    const usable =
      blockSegments.length > 0 &&
      isConversationBlockUsable(transcriptText, blockSegments);

    return {
      ordre: index + 1,
      title: `Conversation ${index + 1} · ${formatTimestamp(start)}-${formatTimestamp(end)}`,
      startTime: start,
      endTime: end,
      transcriptText,
      segmentsCount: blockSegments.length,
      status: usable ? 'COMPLETED' : 'SKIPPED',
      reviewReason: usable
        ? boundary.reason || null
        : 'Conversation trop courte ou trop pauvre pour une évaluation fiable.',
    };
  });
}
