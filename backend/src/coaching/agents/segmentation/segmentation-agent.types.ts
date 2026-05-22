import type { RawTranscriptPreflightMetrics } from '../../utils/dialogue-faithfulness.utils';

export type SegmentationBlockType =
  | 'PROSPECT_INTERACTION'
  | 'INTERNAL_DISCUSSION'
  | 'NOISE'
  | 'INAUDIBLE'
  | 'UNCERTAIN';

export type SegmentationAgentInput = {
  jobId?: number | null;
  candidateWindowOrder: number;
  startTime: number;
  endTime: number;
  status?: string | null;
  transcriptText: string;
  preflight?: RawTranscriptPreflightMetrics | null;
};

export type SegmentationBlock = {
  id: string;
  startTime: number;
  endTime: number;
  type: SegmentationBlockType;
  confidence: number;
  shouldClean: boolean;
  reason?: string | null;
};

export type SegmentationAgentResult = {
  blocks: SegmentationBlock[];
  uncertainties: string[];
  rawResponse?: string | null;
};
