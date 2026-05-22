import type { DialogueFaithfulnessMetrics } from '../utils/dialogue-faithfulness.utils';
import type { DialogueReconstructionPayload } from '../types/coaching-dialogue.types';

export function dialogueQualityOrNull(
  dialogue: DialogueReconstructionPayload | null,
): DialogueFaithfulnessMetrics | null {
  return (dialogue?.qualityMetrics as DialogueFaithfulnessMetrics | null) ?? null;
}
