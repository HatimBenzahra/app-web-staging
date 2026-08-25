import { ParsedSalesPlan } from './sales-plan.types';

/**
 * Ce dont le vocabulaire a besoin d'une fiche : son nom et ses termes. Rien de
 * son contenu — construire un vocabulaire ne donne pas le droit de lire ce que
 * la fiche autorise à affirmer.
 */
type SheetVocabularySource = Pick<
  import('./product-sheet.service').ProductSheetDescriptor,
  'label' | 'sttTerms'
>;

/**
 * Vocabulaire soufflé à Whisper, construit depuis les référentiels du module.
 *
 * Ce n'est pas de la logique métier envoyée au STT : `initial_prompt` est un
 * paramètre de décodage, il biaise l'ORTHOGRAPHE des mots ambigus sans rien
 * interpréter. Sans lui, « Depanssur » ressort en « des pannes sûres » et le
 * mapping des offres travaille sur un transcript qui a perdu les noms propres.
 *
 * Il vit ici, et non dans `api_stt.py`, parce que le coaching est un connecteur :
 * il prend un plan de vente et des fiches produit, et pilote toute la chaîne en
 * aval, transcription comprise. Le service Whisper reste générique et ne connaît
 * aucune marque. Ajouter une fiche suffit à ce que le nom soit reconnu.
 */

/**
 * Au-delà de cette longueur, une entrée n'est plus un nom propre mais une phrase.
 * On les écarte : un `initial_prompt` bavard fait halluciner Whisper sur les
 * silences — il « entend » les mots du prompt là où il n'y a rien.
 */
const MAX_TERM_LENGTH = 40;

/**
 * Plafond du vocabulaire. Deux raisons : le prompt part en query string (limite
 * de ligne de requête côté uvicorn), et plus il est long, plus le risque
 * d'hallucination monte. Les noms de produits passent en premier.
 */
const MAX_VOCABULARY_CHARS = 900;

/** Retire le préfixe éditorial des étapes produit ("Produit : Mondial TV"). */
function cleanStepLabel(label: string): string {
  return label.replace(/^produits?\s*:\s*/i, '').trim();
}

/** Clé de déduplication : casse et accents ignorés. */
function dedupeKey(term: string): string {
  return term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Construit le vocabulaire à partir du plan actif et des fiches actives.
 *
 * Trois sources, dans cet ordre de priorité :
 *  1. `sttTerms` des fiches — les noms de marque et sigles du produit ;
 *  2. `sttTerms` du plan — ce qui n'appartient à aucun produit (marque ombrelle,
 *     offres sans fiche, termes administratifs) ;
 *  3. les libellés des fiches et des étapes produit, en repli automatique — pour
 *     qu'une offre reste couverte même si personne n'a rempli `sttTerms`.
 *
 * Ce qu'on N'utilise PAS : les `expectedSignals` du plan. Ils sont écrits pour le
 * LLM juge (« questions ouvertes », « laisse parler ») ; ce sont des tournures de
 * français courant que Whisper transcrit déjà très bien, et les injecter saturait
 * le plafond en évinçant les vrais noms de marque.
 *
 * Renvoie une chaîne vide si les référentiels ne donnent rien : l'appelant laisse
 * alors Whisper décoder sans biais plutôt que d'envoyer un prompt vide.
 */
export function buildSttVocabulary(
  plan: ParsedSalesPlan,
  sheets: SheetVocabularySource[],
): string {
  const terms: string[] = [];

  for (const sheet of sheets) terms.push(...sheet.sttTerms);
  terms.push(...(plan.sttTerms ?? []));

  // Repli : sans `sttTerms`, le libellé reste une approximation utilisable.
  for (const sheet of sheets) terms.push(sheet.label);
  for (const step of plan.steps) {
    if (/^productDetected:/.test(step.appliesWhen)) {
      terms.push(cleanStepLabel(step.label));
    }
  }

  const seen = new Set<string>();
  const kept: string[] = [];
  let length = 0;

  for (const raw of terms) {
    const term = raw.trim();
    if (!term || term.length > MAX_TERM_LENGTH) continue;

    const key = dedupeKey(term);
    if (!key || seen.has(key)) continue;

    // +2 pour le séparateur ", ". On s'arrête net : tronquer un terme
    // apprendrait une orthographe fausse au décodeur.
    if (length + term.length + 2 > MAX_VOCABULARY_CHARS) break;

    seen.add(key);
    kept.push(term);
    length += term.length + 2;
  }

  if (kept.length === 0) return '';

  return (
    "Prospection commerciale en porte-à-porte, en français. " +
    `Noms de marques, produits et termes attendus : ${kept.join(', ')}.`
  );
}
