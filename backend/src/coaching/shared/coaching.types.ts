import { ViolationSeverity } from '../referentiels/product-sheet.types';

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

/** Sortie de la passe 1 ; la détection des offres appartient à la passe 0. */
export interface LlmCoachingOutput {
  criteria: LlmCriterionResult[];
  summary: string;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  confidence: number | null; // 0-100 (indicatif, non retenu pour le score)
  diagnosticScore: number | null; // 0-100 (score LLM, diagnostic uniquement)
}

/** Un écart de conformité : sans ses trois citations, il ne coûte rien. */
export interface ProductViolation {
  productSlug: string;
  /** Libellé lisible, résolu depuis la fiche (le LLM ne renvoie que le slug). */
  productLabel?: string | null;
  severity: ViolationSeverity;
  /** Citation verbatim de ce que le commercial a dit. */
  quote: string;
  /** La ligne de la fiche produit que ça contredit. */
  sheetSays: string;
  /** Sans elle, la violation est rejetée : réciter son plan n'est jamais une faute. */
  planSays: string;
  why?: string;
}

/** Sortie normalisée de la passe 2 (conformité produit), après json-repair. */
export interface LlmConformityOutput {
  criteria: LlmCriterionResult[];
  violations: ProductViolation[];
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
  score: number; // 0-100, score FINAL retenu (après malus), plancher à 0
  scoreBeforeMalus: number; // moyenne pondérée des étapes applicables, avant malus
  malus: number; // points retirés (valeur positive), 0 si aucune violation retenue
  violations: ProductViolation[]; // violations effectivement retenues
  subScores: StepScore[];
  criterionResults: CriterionScore[];
}
