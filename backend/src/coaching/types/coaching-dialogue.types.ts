export type ConversationKind =
  | 'PROSPECT'
  | 'INTERNAL'
  | 'MIXED'
  | 'NOISE'
  | 'UNKNOWN';

export type DialogueSpeaker =
  | 'COMMERCIAL'
  | 'PROSPECT'
  | 'INTERNAL'
  | 'UNKNOWN';

export type CleanTranscriptQuality = 'GOOD' | 'PARTIAL' | 'BAD';

export type NormalizationType =
  | 'DOMAIN_VOCABULARY'
  | 'PHONETIC_CONTEXTUAL'
  | 'PUNCTUATION'
  | 'SEGMENTATION'
  | 'NONE';

export type CorrectionLevel = 'NONE' | 'LIGHT' | 'MEDIUM' | 'RISKY';

export type DialogueNormalizationPayload = {
  raw: string;
  normalized: string;
  type: NormalizationType;
  confidence: number;
  meaningChanged: boolean;
  reason?: string | null;
};

export type DialogueTurnPayload = {
  speaker: DialogueSpeaker;
  startTime: number | null;
  endTime: number | null;
  text: string;
  rawText?: string | null;
  normalizedText?: string | null;
  sourceQuote?: string | null;
  confidence: number;
  speakerConfidence?: number | null;
  textConfidence?: number | null;
  correctionLevel?: CorrectionLevel;
  normalizations?: DialogueNormalizationPayload[];
  scorable?: boolean;
  displayable?: boolean;
  blockType?:
    | 'PROSPECT_INTERACTION'
    | 'INTERNAL_DISCUSSION'
    | 'NOISE'
    | 'INAUDIBLE'
    | 'UNCERTAIN';
  exclusionReason?: string | null;
  reason?: string | null;
};

export type TranscriptionFinalizerStats = {
  inputTurns: number;
  outputTurns: number;
  duplicatesRemoved: number;
  repeatedTextCompactions: number;
  nonClientCompacted: number;
  hiddenTurns: number;
  compactMarkers: number;
};

export type DialogueReconstructionPayload = {
  conversationKind: ConversationKind;
  usableForScoring: boolean;
  scoreabilityReason?: string | null;
  prospectTurnCount: number;
  internalTurnCount: number;
  unknownTurnCount: number;
  averageConfidence: number;
  qualityMetrics?: Record<string, unknown> | null;
  turns: DialogueTurnPayload[];
  uncertainties: string[];
  rawResponse?: string | null;
  finalizerStats?: TranscriptionFinalizerStats | null;
};

export type SourceTranscriptSegmentPayload = {
  start: number;
  end: number;
  text: string;
};
