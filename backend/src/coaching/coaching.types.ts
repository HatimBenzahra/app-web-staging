/** Statut d'un critère, jugé par le LLM. */
export type CriterionStatus =
  | 'atteint'
  | 'partiel'
  | 'absent'
  | 'non_applicable';

/** Résultat brut (normalisé) renvoyé par le LLM pour un critère. */
export interface LlmCriterionResult {
  stepKey: string;
  criterionKey: string;
  status: CriterionStatus;
  evidence: string[];
  comment?: string;
}

/** Sortie normalisée du LLM (après json-repair). */
export interface LlmCoachingOutput {
  detectedProducts: string[];
  criteria: LlmCriterionResult[];
  summary: string;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  confidence: number | null; // 0-100 (indicatif, non retenu pour le score)
  diagnosticScore: number | null; // 0-100 (score LLM, diagnostic uniquement)
}

/** Score calculé par le backend pour un critère (source de vérité). */
export interface CriterionScore {
  stepKey: string;
  criterionKey: string;
  title: string;
  status: CriterionStatus;
  maxPoints: number;
  score: number; // 0..maxPoints
  weightStep: number;
  evidence: string[];
  comment?: string;
}

/** Score par étape. */
export interface StepScore {
  key: string;
  label: string;
  weight: number;
  applicable: boolean;
  score: number | null; // 0-100, null si non applicable
}

/** Résultat complet du scoring backend. */
export interface ScoringResult {
  score: number; // 0-100, moyenne pondérée des étapes applicables
  subScores: StepScore[];
  criterionResults: CriterionScore[];
}
