import type { SegmentationBlock } from '../agents/segmentation/segmentation-agent.types';
import { parseTimestampedTranscript, TranscriptSegment } from './transcript-parsing.utils';

export const TRANSCRIPT_CLEANER_TARGET_CHUNK_SEC = 55;
export const TRANSCRIPT_CLEANER_MAX_CHUNK_SEC = 90;

export type TranscriptChunk = {
  id: string;
  startTime: number;
  endTime: number;
  segments: TranscriptSegment[];
};

export function buildTranscriptChunks(input: {
  transcriptText: string;
  startTime: number;
  endTime: number;
  idPrefix?: string;
  targetSec?: number;
  maxSec?: number;
}): TranscriptChunk[] {
  const targetSec = input.targetSec ?? TRANSCRIPT_CLEANER_TARGET_CHUNK_SEC;
  const maxSec = input.maxSec ?? TRANSCRIPT_CLEANER_MAX_CHUNK_SEC;
  const segments = parseTimestampedTranscript(input.transcriptText).filter(
    (segment) =>
      segment.end >= input.startTime && segment.start <= input.endTime,
  );
  if (segments.length === 0) {
    return [{
      id: `${input.idPrefix ?? 'chunk'}-1`,
      startTime: input.startTime,
      endTime: Math.min(input.endTime, input.startTime + maxSec),
      segments: [],
    }];
  }

  const chunks: TranscriptChunk[] = [];
  let current: TranscriptSegment[] = [];
  for (const segment of segments) {
    const candidate = [...current, segment];
    const candidateStart = candidate[0]?.start ?? segment.start;
    const candidateEnd = candidate[candidate.length - 1]?.end ?? segment.end;
    const candidateDuration = candidateEnd - candidateStart;
    if (
      current.length > 0 &&
      (candidateDuration > maxSec ||
        (candidateDuration > targetSec && segment.text.length > 0))
    ) {
      chunks.push(toChunk(current, chunks.length, input.idPrefix));
      current = [segment];
      continue;
    }
    current = candidate;
  }
  if (current.length > 0) {
    chunks.push(toChunk(current, chunks.length, input.idPrefix));
  }
  return chunks;
}

export function splitSegmentationBlockForCleaning(input: {
  block: SegmentationBlock;
  transcriptText: string;
}): SegmentationBlock[] {
  const duration = input.block.endTime - input.block.startTime;
  if (duration <= TRANSCRIPT_CLEANER_MAX_CHUNK_SEC) {
    return [input.block];
  }
  return buildTranscriptChunks({
    transcriptText: input.transcriptText,
    startTime: input.block.startTime,
    endTime: input.block.endTime,
    idPrefix: input.block.id,
  }).map((chunk, index) => ({
    ...input.block,
    id: `${input.block.id}-part-${index + 1}`,
    startTime: chunk.startTime,
    endTime: chunk.endTime,
    reason: `${input.block.reason ?? 'Bloc long'} Découpé pour nettoyage transcription.`,
  }));
}

export function buildFallbackSegmentationBlocks(input: {
  transcriptText: string;
  startTime: number;
  endTime: number;
}): SegmentationBlock[] {
  return buildTranscriptChunks({
    transcriptText: input.transcriptText,
    startTime: input.startTime,
    endTime: input.endTime,
    idPrefix: 'fallback-chunk',
  }).map((chunk) => ({
    id: chunk.id,
    startTime: chunk.startTime,
    endTime: chunk.endTime,
    type: 'UNCERTAIN',
    confidence: 0.35,
    shouldClean: true,
    reason:
      'Segmentation LLM indisponible ou invalide: chunk temporel prudent pour transcription affichable.',
  }));
}

function toChunk(
  segments: TranscriptSegment[],
  index: number,
  idPrefix = 'chunk',
): TranscriptChunk {
  return {
    id: `${idPrefix}-${index + 1}`,
    startTime: segments[0]?.start ?? 0,
    endTime: segments[segments.length - 1]?.end ?? segments[0]?.end ?? 0,
    segments,
  };
}
