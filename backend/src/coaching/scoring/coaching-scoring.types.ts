export type EvidenceQuality = 'MISSING' | 'WEAK' | 'PARTIAL' | 'COMPLETE';
export type SalesPlanStepQuality = EvidenceQuality;

export type QualityGateDecision =
  | 'EVALUATE'
  | 'EVALUATE_WITH_REVIEW'
  | 'SKIP'
  | 'REVIEW_ONLY';

export type SalesPlanCriterionDefinition = {
  id?: number | null;
  salesPlanStepId?: number | null;
  stepOrder: number;
  stepTitle: string;
  key: string;
  label: string;
  description?: string | null;
  weight: number;
  required: boolean;
  applicableStatuses: string[];
  expectedEvidence?: string | null;
  negativeSignals?: string | null;
  order: number;
};

export type CriterionEvidencePayload = {
  salesPlanStepId?: number | null;
  salesPlanCriterionId?: number | null;
  stepOrder: number;
  criterionKey: string;
  criterionLabel: string;
  found: boolean;
  quality: EvidenceQuality;
  confidence: number;
  verbatim?: string | null;
  startTime?: number | null;
  endTime?: number | null;
  reason?: string | null;
  evidenceCompleteness?: 'FULL' | 'PARTIAL' | 'UNCERTAIN' | 'NONE';
  missingBecause?: 'NOT_OBSERVED' | 'TRANSCRIPT_UNCLEAR' | 'NOT_APPLICABLE' | null;
  scoreable?: boolean;
  sourceTurnIds?: string[];
  reviewStatus?: 'NOT_REQUIRED' | 'PENDING' | 'VALIDATED' | 'CORRECTED' | 'REJECTED';
};

export type EvidenceExtractionPayload = {
  segmentQuality?: {
    evaluable?: boolean;
    reason?: string | null;
    confidence?: number | null;
  };
  criteriaEvidence: CriterionEvidencePayload[];
  keyEvents: Array<{
    type: string;
    title?: string | null;
    summary?: string | null;
    verbatim?: string | null;
    startTime?: number | null;
    endTime?: number | null;
    importance?: number | null;
  }>;
  uncertainties: string[];
  rawResponse?: string | null;
};

export type SalesPlanStepApplicationPayload = {
  stepOrder: number;
  stepTitle?: string | null;
  observed: boolean;
  quality: SalesPlanStepQuality;
  confidence: number;
  evidence: Array<{
    verbatim: string;
    startTime?: number | null;
    endTime?: number | null;
    reason?: string | null;
    sourceTurnIds?: string[];
  }>;
  evidenceCompleteness?: 'FULL' | 'PARTIAL' | 'UNCERTAIN' | 'NONE';
  missingBecause?: 'NOT_OBSERVED' | 'TRANSCRIPT_UNCLEAR' | 'NOT_APPLICABLE' | null;
  scoreable?: boolean;
  whatWentWell: string[];
  whatIsMissing: string[];
  coachingAdvice: string[];
  reasoning?: string | null;
};

export type SalesPlanApplicationPayload = {
  conversationSummary?: string | null;
  steps: SalesPlanStepApplicationPayload[];
  keyMoments: Array<{
    type: string;
    title?: string | null;
    summary?: string | null;
    verbatim?: string | null;
    startTime?: number | null;
    endTime?: number | null;
    importance?: number | null;
  }>;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  uncertainties: string[];
  rawResponse?: string | null;
};

export type QualityGateResult = {
  decision: QualityGateDecision;
  reasons: string[];
  confidence: number;
  transcriptQuality?: {
    state: 'USABLE' | 'REVIEW' | 'NON_EVALUABLE';
    charsPerMin: number;
    duplicateRatio: number;
    textLength: number;
    suspiciousPhraseCount: number;
  };
};

export type ScoredStepPayload = {
  ordre: number;
  titre: string;
  coverageStatus: 'COVERED' | 'PARTIAL' | 'MISSING';
  score: number;
  startTime?: number | null;
  endTime?: number | null;
  verbatim?: string | null;
  feedback?: string | null;
  recommendation?: string | null;
};

export type DeterministicScoringResult = {
  overallScore: number;
  planCoverageScore: number;
  executionQualityScore: number;
  objectionHandlingScore: number;
  listeningRatioScore: number | null;
  closingScore: number;
  stepEvaluations: ScoredStepPayload[];
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  reviewRequired: boolean;
  reviewReason?: string | null;
};
