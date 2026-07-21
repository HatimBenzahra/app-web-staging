import * as crypto from 'crypto';
import matter from 'gray-matter';
import {
  CriterionDef,
  ParsedSalesPlan,
  StepApplicability,
  StepDef,
} from './sales-plan.types';

export interface ParsedSalesPlanFile {
  plan: ParsedSalesPlan;
  rawMarkdown: string;
  contentHash: string;
}

export class SalesPlanParseError extends Error {}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SalesPlanParseError(`Champ "${field}" manquant ou invalide`);
  }
  return value.trim();
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeApplies(value: unknown): StepApplicability {
  if (typeof value !== 'string' || value.trim().length === 0) return 'always';
  const v = value.trim();
  if (v === 'always' || v === 'contractSigned') return v;
  if (v.startsWith('productDetected:')) return v as StepApplicability;
  // valeur inconnue → on considère l'étape comme toujours applicable
  return 'always';
}

function parseCriterion(raw: any, stepKey: string): CriterionDef {
  const key = asString(raw?.key, `steps[${stepKey}].criteria[].key`);
  const label = asString(raw?.label, `critère ${stepKey}.${key}.label`);
  const points = asNumber(raw?.points, 100);
  if (points <= 0) {
    throw new SalesPlanParseError(
      `Critère ${stepKey}.${key} : points doit être > 0`,
    );
  }
  return {
    key,
    label,
    points,
    evidenceRequired: raw?.evidenceRequired === true,
    expectedSignals: Array.isArray(raw?.expectedSignals)
      ? raw.expectedSignals.map(String)
      : undefined,
    negativeSignals: Array.isArray(raw?.negativeSignals)
      ? raw.negativeSignals.map(String)
      : undefined,
    appliesWhen: raw?.appliesWhen
      ? normalizeApplies(raw.appliesWhen)
      : undefined,
  };
}

function parseStep(raw: any): StepDef {
  const key = asString(raw?.key, 'steps[].key');
  const label = asString(raw?.label, `étape ${key}.label`);
  const weight = asNumber(raw?.weight, 0);
  if (weight < 0) {
    throw new SalesPlanParseError(`Étape ${key} : weight ne peut pas être négatif`);
  }
  if (!Array.isArray(raw?.criteria) || raw.criteria.length === 0) {
    throw new SalesPlanParseError(`Étape ${key} : au moins un critère requis`);
  }
  const criteria = raw.criteria.map((c: any) => parseCriterion(c, key));
  const criterionKeys = new Set<string>();
  for (const c of criteria) {
    if (criterionKeys.has(c.key)) {
      throw new SalesPlanParseError(
        `Étape ${key} : clé de critère dupliquée "${c.key}"`,
      );
    }
    criterionKeys.add(c.key);
  }
  return {
    key,
    label,
    weight,
    appliesWhen: normalizeApplies(raw?.appliesWhen),
    criteria,
  };
}

/**
 * Parse un fichier markdown de plan de vente : frontmatter YAML (barème machine)
 * + corps (référentiel lisible pour le LLM). Valide la cohérence du barème.
 */
export function parseSalesPlanMarkdown(source: string): ParsedSalesPlanFile {
  const parsed = matter(source);
  const data = parsed.data ?? {};

  const slug = asString(data.slug, 'slug');
  const title = asString(data.title, 'title');

  if (!Array.isArray(data.steps) || data.steps.length === 0) {
    throw new SalesPlanParseError('Aucune étape (steps) définie dans le plan');
  }

  const steps = data.steps.map(parseStep);

  const stepKeys = new Set<string>();
  let totalWeight = 0;
  for (const s of steps) {
    if (stepKeys.has(s.key)) {
      throw new SalesPlanParseError(`Clé d'étape dupliquée "${s.key}"`);
    }
    stepKeys.add(s.key);
    totalWeight += s.weight;
  }
  if (totalWeight <= 0) {
    throw new SalesPlanParseError('La somme des poids des étapes doit être > 0');
  }

  const plan: ParsedSalesPlan = {
    slug,
    title,
    scoringScale: asNumber(data.scoringScale, 100),
    language: typeof data.language === 'string' ? data.language : 'fr',
    context: typeof data.context === 'string' ? data.context : undefined,
    quality: {
      minDurationSec: asNumber(data?.quality?.minDurationSec, 45),
      minTranscriptChars: asNumber(data?.quality?.minTranscriptChars, 400),
      lowConfidenceBelowSec: asNumber(data?.quality?.lowConfidenceBelowSec, 90),
    },
    steps,
  };

  const contentHash = crypto
    .createHash('sha256')
    .update(source, 'utf8')
    .digest('hex');

  return { plan, rawMarkdown: source, contentHash };
}
