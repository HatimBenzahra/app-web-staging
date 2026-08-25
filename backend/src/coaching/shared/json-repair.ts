import {
  CriterionStatus,
  LlmCoachingOutput,
  LlmConformityOutput,
  LlmCriterionResult,
  ProductViolation,
} from './coaching.types';
import { ViolationSeverity } from '../referentiels/product-sheet.types';
import { MappedProduct } from '../analyse-porte/etape-2-mapping/product-mapping-prompt';

/** Ramène la sortie du modèle à une structure stable : fences, alias, échelles. */

const STATUS_ALIASES: Record<string, CriterionStatus> = {
  atteint: 'atteint',
  passed: 'atteint',
  ok: 'atteint',
  present: 'atteint',
  yes: 'atteint',
  partiel: 'partiel',
  partial: 'partiel',
  partly: 'partiel',
  absent: 'absent',
  missing: 'absent',
  no: 'absent',
  failed: 'absent',
  non_applicable: 'non_applicable',
  not_applicable: 'non_applicable',
  na: 'non_applicable',
  'n/a': 'non_applicable',
};

const SEVERITY_ALIASES: Record<string, ViolationSeverity> = {
  grave: 'grave',
  severe: 'grave',
  critique: 'grave',
  critical: 'grave',
  high: 'grave',
  modere: 'modere',
  moderate: 'modere',
  moyen: 'modere',
  medium: 'modere',
  leger: 'modere',
  low: 'modere',
};

const CONFIDENCE_WORDS: Record<string, number> = {
  high: 90,
  medium: 55,
  moyenne: 55,
  moyen: 55,
  low: 25,
  faible: 25,
  low_confidence: 25,
  very_low: 10,
};

function stripFences(raw: string): string {
  let s = raw.trim();
  // enlève une éventuelle fence ```json ... ```
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return s.trim();
}

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

function toArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') return Object.values(value) as T[];
  if (value === undefined || value === null) return [];
  return [value as T];
}

function toStringArray(value: unknown): string[] {
  return toArray(value)
    .map((v) => (typeof v === 'string' ? v : v == null ? '' : String(v)))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function normalizeStatus(value: unknown): CriterionStatus {
  if (typeof value !== 'string') return 'absent';
  const key = value.trim().toLowerCase().replace(/\s+/g, '_');
  return STATUS_ALIASES[key] ?? 'absent';
}

function normalizeConfidence(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = value <= 1 ? value * 100 : value;
    return Math.max(0, Math.min(100, n));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase().replace(/\s+/g, '_');
    if (CONFIDENCE_WORDS[trimmed] != null) return CONFIDENCE_WORDS[trimmed];
    const parsed = parseFloat(trimmed.replace(',', '.'));
    if (Number.isFinite(parsed)) {
      const n = parsed <= 1 ? parsed * 100 : parsed;
      return Math.max(0, Math.min(100, n));
    }
  }
  return null;
}

function normalizeScore(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const n = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, n));
}

function normalizeCriterion(raw: any): LlmCriterionResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const stepKey = String(raw.stepKey ?? raw.step ?? raw.step_key ?? '').trim();
  const criterionKey = String(
    raw.criterionKey ?? raw.key ?? raw.criterion ?? raw.criterion_key ?? '',
  ).trim();
  if (!criterionKey) return null;
  return {
    stepKey,
    criterionKey,
    status: normalizeStatus(raw.status ?? raw.result ?? raw.state),
    evidence: toStringArray(raw.evidence ?? raw.preuve ?? raw.quotes),
    comment:
      typeof (raw.comment ?? raw.rationale ?? raw.commentaire) === 'string'
        ? String(raw.comment ?? raw.rationale ?? raw.commentaire).trim()
        : undefined,
  };
}

/** Ne décide plus de la détection : sert à rattraper le slug d'une violation. */
function normalizeProductSlug(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-]+/g, '_');
}

/** Une gravité inconnue retombe sur la plus faible, jamais l'inverse. */
function normalizeSeverity(value: unknown): ViolationSeverity {
  if (typeof value !== 'string') return 'modere';
  const key = value.trim().toLowerCase().replace(/\s+/g, '_');
  return SEVERITY_ALIASES[key] ?? 'modere';
}

/** Normalise la forme ; la règle des trois citations est appliquée par ScoringService. */
function normalizeViolation(raw: any): ProductViolation | null {
  if (!raw || typeof raw !== 'object') return null;
  const productSlug = normalizeProductSlug(
    raw.productSlug ?? raw.product ?? raw.produit ?? raw.slug,
  );
  if (!productSlug) return null;

  const asText = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : '';

  return {
    productSlug,
    severity: normalizeSeverity(raw.severity ?? raw.gravite ?? raw.gravity),
    quote: asText(raw.quote ?? raw.citation ?? raw.said ?? raw.evidence),
    sheetSays: asText(raw.sheetSays ?? raw.sheet ?? raw.ficheDit ?? raw.fiche),
    planSays: asText(raw.planSays ?? raw.plan ?? raw.planDit ?? raw.argumentaire),
    why: asText(raw.why ?? raw.raison ?? raw.comment) || undefined,
  };
}

export class LlmOutputParseError extends Error {}

/** Objet JSON de la réponse LLM, fences et bavardage retirés. */
function parseJsonLoose(raw: string): any {
  const jsonStr = stripFences(raw);
  try {
    return JSON.parse(jsonStr);
  } catch {
    const extracted = extractJsonObject(jsonStr);
    if (!extracted) {
      throw new LlmOutputParseError('Réponse LLM sans objet JSON exploitable');
    }
    try {
      return JSON.parse(extracted);
    } catch (e) {
      throw new LlmOutputParseError(
        `JSON LLM irréparable: ${(e as Error).message}`,
      );
    }
  }
}

export function repairLlmOutput(raw: string): LlmCoachingOutput {
  const obj = parseJsonLoose(raw);

  if (!obj || typeof obj !== 'object') {
    throw new LlmOutputParseError('Réponse LLM non structurée');
  }

  const criteria = toArray(obj.criteria ?? obj.criteriaResults ?? obj.criteres)
    .map(normalizeCriterion)
    .filter((c): c is LlmCriterionResult => c !== null);

  return {
    criteria,
    summary: typeof obj.summary === 'string' ? obj.summary.trim() : '',
    strengths: toStringArray(obj.strengths ?? obj.forces),
    improvements: toStringArray(obj.improvements ?? obj.axes ?? obj.ameliorations),
    recommendations: toStringArray(
      obj.recommendations ?? obj.recommandations ?? obj.actions,
    ),
    confidence: normalizeConfidence(obj.confidence ?? obj.confiance),
    diagnosticScore: normalizeScore(
      obj.diagnosticScore ?? obj.score ?? obj.globalScore,
    ),
  };
}

/** Normalise la sortie de la passe 2 (conformité produit). */
export function repairConformityOutput(raw: string): LlmConformityOutput {
  const obj = parseJsonLoose(raw);

  if (!obj || typeof obj !== 'object') {
    throw new LlmOutputParseError('Réponse LLM non structurée');
  }

  return {
    criteria: toArray(obj.criteria ?? obj.criteres)
      .map(normalizeCriterion)
      .filter((c): c is LlmCriterionResult => c !== null),
    violations: toArray(obj.violations ?? obj.infractions ?? obj.ecarts)
      .map(normalizeViolation)
      .filter((v): v is ProductViolation => v !== null),
  };
}

/**
 * Toute clé hors de `knownKeys` est rejetée, jamais approximée, et renvoyée à part
 * pour être tracée — un rejet silencieux ramènerait l'analyse qui « rate » sans rien dire.
 */
export function repairMappingOutput(
  raw: string,
  knownKeys: Iterable<string>,
): { products: MappedProduct[]; rejected: string[] } {
  const obj = parseJsonLoose(raw);

  if (!obj || typeof obj !== 'object') {
    throw new LlmOutputParseError('Réponse LLM non structurée');
  }

  const known = new Map<string, string>();
  for (const key of knownKeys) known.set(normalizeProductSlug(key), key);

  const products: MappedProduct[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();

  for (const entry of toArray<any>(
    obj.products ?? obj.produits ?? obj.offers ?? obj.offres,
  )) {
    if (!entry || typeof entry !== 'object') continue;

    const rawKey = String(
      entry.key ?? entry.productKey ?? entry.slug ?? entry.produit ?? '',
    ).trim();
    if (!rawKey) continue;

    const resolved = known.get(normalizeProductSlug(rawKey));
    if (!resolved) {
      rejected.push(rawKey);
      continue;
    }
    if (seen.has(resolved)) continue;
    seen.add(resolved);

    const evidence =
      typeof (entry.evidence ?? entry.quote ?? entry.citation) === 'string'
        ? String(entry.evidence ?? entry.quote ?? entry.citation).trim()
        : '';

    products.push({
      key: resolved,
      presentedByCommercial: toBoolean(
        entry.presentedByCommercial ??
          entry.presented ??
          entry.parLeCommercial ??
          entry.presenteParLeCommercial,
      ),
      evidence,
    });
  }

  return { products, rejected };
}

/** Tolérant en entrée, false par défaut : un doute ne doit pas rendre une étape applicable. */
function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value !== 'string') return false;
  const v = value.trim().toLowerCase();
  return v === 'true' || v === 'oui' || v === 'yes' || v === '1';
}
