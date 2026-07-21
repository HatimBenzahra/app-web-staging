import {
  CriterionStatus,
  LlmCoachingOutput,
  LlmCriterionResult,
} from './coaching.types';

/**
 * Réparation/normalisation de la sortie LLM.
 * Les tests de juin ont montré que le modèle (gemma) renvoie parfois :
 *  - du JSON entouré d'une fence markdown ```json
 *  - des tableaux sous forme d'objet indexé
 *  - une "confidence" tantôt 0-1, tantôt 0-100, tantôt une string ("HIGH")
 *  - des clés alias (key/criterionKey, label/title, status en anglais)
 * On tolère tout ça et on ramène à une structure stable.
 */

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

export class LlmOutputParseError extends Error {}

export function repairLlmOutput(raw: string): LlmCoachingOutput {
  let jsonStr = stripFences(raw);
  let obj: any;
  try {
    obj = JSON.parse(jsonStr);
  } catch {
    const extracted = extractJsonObject(jsonStr);
    if (!extracted) {
      throw new LlmOutputParseError('Réponse LLM sans objet JSON exploitable');
    }
    try {
      obj = JSON.parse(extracted);
    } catch (e) {
      throw new LlmOutputParseError(
        `JSON LLM irréparable: ${(e as Error).message}`,
      );
    }
  }

  if (!obj || typeof obj !== 'object') {
    throw new LlmOutputParseError('Réponse LLM non structurée');
  }

  const criteria = toArray(obj.criteria ?? obj.criteriaResults ?? obj.criteres)
    .map(normalizeCriterion)
    .filter((c): c is LlmCriterionResult => c !== null);

  const detectedProducts = toStringArray(
    obj.detectedProducts ?? obj.products ?? obj.produits,
  ).map((p) =>
    p
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // enlève les accents (Plénitude → plenitude)
      .replace(/\s+/g, '_'),
  );

  return {
    detectedProducts,
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
