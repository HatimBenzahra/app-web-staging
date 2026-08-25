/**
 * Types des fiches produit (issus du frontmatter markdown de product-sheets/*.md).
 *
 * Une fiche porte UNIQUEMENT ce que la formation produit autorise à affirmer.
 * Ce que dit le plan de vente vient de `StepDef.pitchText` — les deux sources
 * restent indépendantes, ce qu'exige la règle de malus : une affirmation n'est
 * sanctionnée que si elle contredit la fiche ET le plan.
 */

import { StepApplicability } from './sales-plan.types';

/** Gravité d'une violation de conformité produit. */
export type ViolationSeverity = 'grave' | 'modere';

/**
 * Affirmation à surveiller. Ce n'est pas un déclencheur automatique : c'est une
 * aide au jugement, pour ne pas rater les cas juridiquement sensibles. Le LLM doit
 * toujours vérifier que le plan de vente ne couvre pas l'affirmation.
 */
export interface ForbiddenClaim {
  say: string;
  severity: ViolationSeverity;
}

/**
 * Comment retrouver l'offre WinLead+ correspondante. Une fiche ne contient JAMAIS
 * de prix en dur : il est résolu à l'exécution depuis la table `Offre`.
 */
export interface WinLeadPlusBinding {
  externalIds?: number[];
  match?: { fournisseur?: string };
}

export interface ParsedProductSheet {
  slug: string;
  label: string;
  /** Forme complète, ex. `productDetected:depanssur`. */
  appliesTo: StepApplicability;
  /** Le slug produit seul, ex. `depanssur` — la clé de jointure avec detectedProducts. */
  productKey: string;
  /** Ce que la formation autorise à affirmer. */
  facts: string[];
  /**
   * Ce qui permet de RECONNAÎTRE l'offre dans un transcript — pas ce qu'elle vaut.
   * Injecté dans la passe 0 (mapping) uniquement, pour distinguer cette offre des
   * autres. Doit rester robuste à Whisper, qui déforme les noms de marque : y mettre
   * des signaux propres à l'offre (« 3179 », « kit économie d'eau ») et pas seulement
   * son nom. Vide → repli sur les trois premiers `facts`.
   */
  identifiers: string[];
  /** Affirmations sensibles, avec leur gravité si elles ne sont pas couvertes par le plan. */
  forbidden: ForbiddenClaim[];
  winleadplus?: WinLeadPlusBinding;
}

export interface ParsedProductSheetFile {
  sheet: ParsedProductSheet;
  rawMarkdown: string;
  contentHash: string;
}
