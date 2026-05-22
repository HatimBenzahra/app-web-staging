import { Injectable } from '@nestjs/common';
import {
  DialogueFaithfulnessMetrics,
  validateDialogueFaithfulness,
} from '../utils/dialogue-faithfulness.utils';
import type { DialogueReconstructionPayload } from '../types/coaching-dialogue.types';

@Injectable()
export class TranscriptCleanerValidator {
  validate(reconstruction: DialogueReconstructionPayload): {
    reconstruction: DialogueReconstructionPayload;
    metrics: DialogueFaithfulnessMetrics;
  } {
    return validateDialogueFaithfulness(reconstruction);
  }
}
