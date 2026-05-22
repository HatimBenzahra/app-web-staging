import type {
  ConversationKind,
  DialogueReconstructionPayload,
} from '../../types/coaching-dialogue.types';
import type { TranscriptionMemory } from '../../types/transcription-memory.types';
import type { SegmentationBlock } from '../segmentation/segmentation-agent.types';

export type TranscriptCleanerAgentInput = {
  jobId?: number | null;
  candidateWindowOrder: number;
  windowStartTime: number;
  windowEndTime: number;
  block: SegmentationBlock;
  transcriptText: string;
  status?: string | null;
  memory?: TranscriptionMemory | null;
};

export type TranscriptCleanerAgentResult = DialogueReconstructionPayload & {
  sourceBlockId: string;
  sourceBlockType: SegmentationBlock['type'];
};

export type TranscriptCleanerCombinedResult = {
  conversationKind: ConversationKind;
  reconstruction: DialogueReconstructionPayload;
};
