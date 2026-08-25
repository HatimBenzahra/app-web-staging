import { ParsedSalesPlan } from '../../referentiels/sales-plan.types';

/** Le nom et les termes d'une fiche, jamais son contenu jugeable. */
type SheetVocabularySource = Pick<
  import('../../referentiels/product-sheet.service').ProductSheetDescriptor,
  'label' | 'sttTerms'
>;

/**
 * Vocabulaire soufflé à Whisper (`initial_prompt`), construit depuis le plan et
 * les fiches : il biaise l'orthographe des noms propres, sans rien interpréter.
 */

/** Au-delà, ce n'est plus un nom propre mais une phrase, qui fait halluciner Whisper. */
const MAX_TERM_LENGTH = 40;

/** Plafond : le prompt part en query string, et un prompt long fait halluciner. */
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
 * `sttTerms` des fiches, puis du plan, puis les libellés en repli ; jamais les
 * `expectedSignals`, du français courant qui saturait le plafond.
 */
export function buildSttVocabulary(
  plan: ParsedSalesPlan,
  sheets: SheetVocabularySource[],
): string {
  const terms: string[] = [];

  for (const sheet of sheets) terms.push(...sheet.sttTerms);
  terms.push(...(plan.sttTerms ?? []));

  // Repli : sans `sttTerms`, le libellé reste utilisable.
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

    // On s'arrête net : tronquer un terme apprendrait une orthographe fausse.
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
