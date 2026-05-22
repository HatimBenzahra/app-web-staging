import type { SegmentationBlock } from '../agents/segmentation/segmentation-agent.types';
import type { DialogueReconstructionPayload } from '../types/coaching-dialogue.types';

export function shouldRunTranscriptCleaner(block: SegmentationBlock): boolean {
  return (
    block.shouldClean &&
    block.type !== 'NOISE' &&
    block.type !== 'INAUDIBLE' &&
    block.confidence >= 0.15
  );
}

export function shouldRunSalesPlan(
  dialogue: DialogueReconstructionPayload | null,
): boolean {
  if (!dialogue || !dialogue.usableForScoring) {
    return false;
  }
  return dialogue.turns.some(
    (turn) =>
      turn.scorable !== false &&
      turn.blockType === 'PROSPECT_INTERACTION' &&
      (turn.speaker === 'COMMERCIAL' || turn.speaker === 'PROSPECT'),
  );
}
