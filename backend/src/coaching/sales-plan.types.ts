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
  /**
   * true → critère jugé en passe 2 (conformité produit), pas en passe 1.
   * La passe 2 dispose de la fiche produit ; la passe 1 ne l'a pas.
   */
  requiresProductSheet?: boolean;
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

/**
 * Barème du malus de conformité produit, retiré du score après son calcul.
 * Les étapes gardent leur barème intact : le malus s'applique au score global.
 */
export interface PlanMalus {
  /** Affirmation juridiquement fausse ou engagement impossible. */
  grave: number;
  /** Chiffre ou périmètre inventé, au-delà des deux référentiels. */
  modere: number;
  /** Plafond du malus cumulé sur une analyse. */
  maxTotal: number;
}

/** Plan de vente parsé (contenu du frontmatter). */
export interface ParsedSalesPlan {
  slug: string;
  title: string;
  scoringScale: number;
  language?: string;
  context?: string;
  quality: PlanQuality;
  malus: PlanMalus;
  steps: StepDef[];
}

/** Payload stocké dans SalesPlanVersion.criteria (JSON). */
export interface SalesPlanCriteriaPayload {
  scoringScale: number;
  quality: PlanQuality;
  malus: PlanMalus;
  steps: StepDef[];
  context?: string;
  language?: string;
}
