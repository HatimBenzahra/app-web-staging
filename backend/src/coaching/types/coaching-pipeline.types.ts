/**
 * Shared types for the coaching analysis pipeline.
 */

export type CurrentUser = {
  id: number;
  role: string;
};

export type StepEvaluationPayload = {
  ordre: number;
  titre: string;
  coverageStatus: 'COVERED' | 'PARTIAL' | 'MISSING';
  score?: number | null;
  startTime?: number | null;
  endTime?: number | null;
  verbatim?: string | null;
  feedback?: string | null;
  recommendation?: string | null;
};

export type KeyMomentPayload = {
  type: string;
  title: string;
  summary?: string | null;
  startTime?: number | null;
  endTime?: number | null;
  verbatim?: string | null;
  importance?: number | null;
};

export type SessionEvaluationPayload = {
  overallScore?: number | null;
  planCoverageScore?: number | null;
  executionQualityScore?: number | null;
  objectionHandlingScore?: number | null;
  listeningRatioScore?: number | null;
  closingScore?: number | null;
  summary?: string | null;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  keyMoments: KeyMomentPayload[];
  stepEvaluations: StepEvaluationPayload[];
  rawResponse?: string | null;
  usedFallback?: boolean;
};

export type CoachingTranscriptPayload = {
  segments: Array<{ start: number; end: number; text: string }>;
  duration: number;
  source: 'WHISPER_FULL_RECORDING' | 'RECORDING_SEGMENTS';
};

export type CoachingConversationBlock = {
  ordre: number;
  title: string;
  startTime: number;
  endTime: number;
  transcriptText: string;
  readableTranscriptText?: string | null;
  segmentsCount: number;
  status: 'COMPLETED' | 'NEEDS_REVIEW' | 'SKIPPED' | 'FAILED';
  reviewReason?: string | null;
};
