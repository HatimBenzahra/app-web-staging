import { parseTimestampedTranscript } from '../utils/transcript-parsing.utils';
import type { SegmentationBlock } from '../agents/segmentation/segmentation-agent.types';

export function hasCleanableProspectCandidate(blocks: SegmentationBlock[]): boolean {
  return blocks.some(
    (block) =>
      block.shouldClean &&
      (block.type === 'PROSPECT_INTERACTION' || block.type === 'UNCERTAIN'),
  );
}

export function hasCleanableTranscriptCandidate(blocks: SegmentationBlock[]): boolean {
  return blocks.some(
    (block) =>
      block.shouldClean &&
      block.type !== 'NOISE' &&
      block.type !== 'INAUDIBLE',
  );
}

export function countTimestampedSegmentsInBounds(
  transcriptText: string,
  bounds: { startTime: number; endTime: number },
): number {
  return parseTimestampedTranscript(transcriptText).filter(
    (segment) =>
      segment.end >= bounds.startTime && segment.start <= bounds.endTime,
  ).length;
}
