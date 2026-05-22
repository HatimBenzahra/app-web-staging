import type { QualityGateResult } from '../../scoring/coaching-scoring.types';
import type { CandidateWindowBlock } from '../../pipeline/coaching-pipeline.types';

export type SalesPlanAgentInput = {
  jobId?: number | null;
  candidateWindowOrder: number;
  block: CandidateWindowBlock;
  status?: string | null;
  qualityGate: QualityGateResult;
  maxTranscriptPromptChars: number;
  salesPlanVersion: {
    label: string | null;
    promptInstructions: string | null;
    steps: Array<{
      ordre: number;
      titre: string;
      description: string | null;
      expectedSignals: string | null;
      poids: number;
    }>;
  };
  rawTranscriptText?: string | null;
};

export type SalesPlanAgentRawResult = {
  parsed: Record<string, unknown>;
  rawResponse: string;
};
