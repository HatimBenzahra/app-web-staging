/**
 * Types du plan de vente structuré (issu du frontmatter markdown).
 * Le frontmatter est la vérité machine : étapes + critères + poids + points.
 */

export type StepApplicability =
  | 'always'
  | 'contractSigned'
  | `productDetected:${string}`;

export interface CriterionDef {
  key: string;
  label: string;
  points: number; // barème max du critère (typiquement 100)
  evidenceRequired?: boolean;
  expectedSignals?: string[];
  negativeSignals?: string[];
  /** Optionnel : restreint l'applicabilité du critère (par défaut = celle de l'étape). */
  appliesWhen?: StepApplicability;
}

export interface StepDef {
  key: string;
  label: string;
  weight: number; // poids de l'étape dans le score global
  appliesWhen: StepApplicability;
  criteria: CriterionDef[];
}

export interface PlanQuality {
  minDurationSec?: number;
  minTranscriptChars?: number;
  lowConfidenceBelowSec?: number;
}

/** Plan de vente parsé (contenu du frontmatter). */
export interface ParsedSalesPlan {
  slug: string;
  title: string;
  scoringScale: number;
  language?: string;
  context?: string;
  quality: PlanQuality;
  steps: StepDef[];
}

/** Payload stocké dans SalesPlanVersion.criteria (JSON). */
export interface SalesPlanCriteriaPayload {
  scoringScale: number;
  quality: PlanQuality;
  steps: StepDef[];
  context?: string;
  language?: string;
}
