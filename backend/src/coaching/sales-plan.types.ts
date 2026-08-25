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
  /**
   * Exemples de formulations attendues — des ILLUSTRATIONS, pas une liste à
   * cocher. N'y mettre que ce qui se prononce vraiment : un comportement
   * (« écoute », « ne coupe pas la parole ») se juge et s'écrit dans `label`.
   */
  expectedSignals?: string[];
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
  /**
   * Titre de la section du CORPS markdown qui porte l'argumentaire de l'étape,
   * ex. "Phase 6 — Vente du mobile France Téléphone". Résolu au parsing en
   * `pitchText`.
   */
  pitchSection?: string;
  /**
   * L'argumentaire tel que le plan l'écrit. C'est le SECOND référentiel de la
   * conformité produit : un écart n'est retenu que s'il contredit la fiche **et**
   * cet argumentaire. Un commercial qui récite son plan n'est jamais sanctionné,
   * même si le plan s'écarte de la fiche — ce désaccord-là se règle entre
   * référentiels, pas sur le dos du commercial.
   */
  pitchText?: string;
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
  /**
   * Termes transverses que la transcription doit orthographier juste (marque
   * ombrelle, offres sans fiche). Le pendant des `sttTerms` d'une fiche, au
   * niveau du plan. Optionnel.
   */
  sttTerms?: string[];
}

/** Payload stocké dans SalesPlanVersion.criteria (JSON). */
export interface SalesPlanCriteriaPayload {
  scoringScale: number;
  quality: PlanQuality;
  malus: PlanMalus;
  steps: StepDef[];
  context?: string;
  language?: string;
  sttTerms?: string[];
}
