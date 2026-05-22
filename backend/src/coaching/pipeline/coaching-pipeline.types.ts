import type { DialogueFaithfulnessMetrics } from '../utils/dialogue-faithfulness.utils';
import type {
  ConversationKind,
  DialogueReconstructionPayload,
  DialogueTurnPayload,
  SourceTranscriptSegmentPayload,
} from '../types/coaching-dialogue.types';
import type { TranscriptWordTiming } from '../utils/transcript-word-timing.utils';

export type CandidateWindowBlock = {
  ordre: number;
  title: string;
  startTime: number;
  endTime: number;
  transcriptText: string;
  readableTranscriptText?: string | null;
  sourceTranscriptSegments?: SourceTranscriptSegmentPayload[];
  words?: TranscriptWordTiming[];
  dialogueTurns?: DialogueTurnPayload[];
  dialoguePromptVersion?: string | null;
  dialogueRawResponse?: string | null;
  conversationKind?: ConversationKind | null;
  usableForScoring?: boolean | null;
  scoreabilityReason?: string | null;
  dialogueQualityJson?: DialogueFaithfulnessMetrics | null;
  segmentsCount: number;
  status: 'COMPLETED' | 'NEEDS_REVIEW' | 'SKIPPED' | 'FAILED';
  reviewReason?: string | null;
  segmentType?: 'PROSPECT' | 'INTERNAL' | 'NOISE' | 'UNKNOWN';
  segmentSource?: string | null;
  segmentConfidence?: number | null;
  segmentStatut?: string | null;
  speechScore?: number | null;
};

export type CandidateWindowPipelineResult = {
  dialogue: DialogueReconstructionPayload | null;
  readableTranscriptText?: string | null;
};
