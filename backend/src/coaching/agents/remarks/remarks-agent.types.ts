import type {
  DeterministicScoringResult,
  EvidenceExtractionPayload,
} from '../../scoring/coaching-scoring.types';

export type RemarksAgentInput = {
  jobId?: number | null;
  candidateWindowOrder?: number | null;
  status?: string | null;
  scoring: DeterministicScoringResult;
  evidence: EvidenceExtractionPayload;
};

export type RemarksAgentResult = {
  summary?: string | null;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
};
