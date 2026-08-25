import { Injectable } from '@nestjs/common';
import {
  CriterionScore,
  LlmCoachingOutput,
  LlmCriterionResult,
  ProductViolation,
  ScoringResult,
  StepScore,
} from './coaching.types';
import { ParsedSalesPlan, StepApplicability } from './sales-plan.types';

export interface ScoringContext {
  contractSigned: boolean;
  detectedProducts: string[];
  /** Violations remontées par la passe 2. Absentes si aucun produit détecté. */
  violations?: ProductViolation[];
}

const STATUS_FRACTION: Record<string, number> = {
  atteint: 1,
  partiel: 0.5,
  absent: 0,
  non_applicable: 0, // exclu du dénominateur, valeur ignorée
};

@Injectable()
export class ScoringService {
  /**
   * Calcule le score coaching à partir du plan et du jugement du LLM.
   * score = Σ(stepRaw × poids) / Σ(poids des étapes applicables) × 100.
   * Seules les étapes/critères applicables entrent au dénominateur.
   */
  computeScore(
    plan: ParsedSalesPlan,
    llm: LlmCoachingOutput,
    ctx: ScoringContext,
  ): ScoringResult {
    const byPair = new Map<string, LlmCriterionResult>();
    const byKey = new Map<string, LlmCriterionResult>();
    for (const r of llm.criteria) {
      byPair.set(`${r.stepKey}::${r.criterionKey}`, r);
      if (!byKey.has(r.criterionKey)) byKey.set(r.criterionKey, r);
    }

    const applies = (rule: StepApplicability): boolean => {
      if (rule === 'always') return true;
      if (rule === 'contractSigned') return ctx.contractSigned;
      const m = /^productDetected:(.+)$/.exec(rule);
      if (m) return ctx.detectedProducts.includes(m[1]);
      return true;
    };

    const subScores: StepScore[] = [];
    const criterionResults: CriterionScore[] = [];
    let globalObtained = 0;
    let globalWeight = 0;

    for (const step of plan.steps) {
      const stepApplicable = applies(step.appliesWhen);

      let obtained = 0;
      let possible = 0;

      // On émet TOUS les critères du plan (checklist complète) ; les critères
      // non applicables sont marqués non_applicable et n'entrent pas dans le score.
      for (const crit of step.criteria) {
        const critApplicable =
          stepApplicable && applies(crit.appliesWhen ?? step.appliesWhen);
        const res =
          byPair.get(`${step.key}::${crit.key}`) ?? byKey.get(crit.key);
        const rawStatus = res?.status ?? 'absent';

        if (!critApplicable || rawStatus === 'non_applicable') {
          criterionResults.push({
            stepKey: step.key,
            criterionKey: crit.key,
            title: crit.label,
            status: 'non_applicable',
            maxPoints: crit.points,
            score: 0,
            weightStep: step.weight,
            evidence: [],
            comment: res?.comment,
          });
          continue;
        }

        const evidence = res?.evidence ?? [];
        let fraction = STATUS_FRACTION[rawStatus] ?? 0;
        // preuve obligatoire non fournie → aucun crédit
        if (crit.evidenceRequired && rawStatus === 'atteint' && evidence.length === 0) {
          fraction = 0;
        }
        const score = Math.round(fraction * crit.points * 100) / 100;

        obtained += score;
        possible += crit.points;

        criterionResults.push({
          stepKey: step.key,
          criterionKey: crit.key,
          title: crit.label,
          status: rawStatus,
          maxPoints: crit.points,
          score,
          weightStep: step.weight,
          evidence,
          comment: res?.comment,
        });
      }

      const stepRaw = possible > 0 ? obtained / possible : null;
      const contributes = stepApplicable && stepRaw !== null && step.weight > 0;
      subScores.push({
        key: step.key,
        label: step.label,
        weight: step.weight,
        applicable: contributes,
        score: stepRaw !== null ? Math.round(stepRaw * 1000) / 10 : null,
      });

      if (contributes) {
        globalObtained += (stepRaw as number) * step.weight;
        globalWeight += step.weight;
      }
    }

    const scoreBeforeMalus =
      globalWeight > 0
        ? Math.round((globalObtained / globalWeight) * 1000) / 10
        : 0;

    const { malus, violations } = this.computeMalus(plan, ctx.violations ?? []);
    const score = Math.max(0, Math.round((scoreBeforeMalus - malus) * 10) / 10);

    return {
      score,
      scoreBeforeMalus,
      malus,
      violations,
      subScores,
      criterionResults,
    };
  }

  /**
   * Malus de conformité produit, retiré du score global après son calcul.
   *
   * Un écart n'est retenu que s'il porte ses DEUX citations : ce que le commercial
   * a dit, et la ligne de la fiche que ça contredit. Même logique
   * qu'`evidenceRequired` : pas de preuve, pas de sanction.
   */
  private computeMalus(
    plan: ParsedSalesPlan,
    raw: ProductViolation[],
  ): { malus: number; violations: ProductViolation[] } {
    const violations = raw.filter(
      (v) => isCitation(v.quote) && isCitation(v.sheetSays),
    );

    const total = violations.reduce(
      (sum, v) =>
        sum + (v.severity === 'grave' ? plan.malus.grave : plan.malus.modere),
      0,
    );

    return {
      malus: Math.min(total, plan.malus.maxTotal),
      violations,
    };
  }
}

/**
 * Marqueurs d'absence que le LLM met quand il n'a rien à citer. Ils doivent être
 * traités comme une citation MANQUANTE, pas comme une citation.
 *
 * Vu en production : le plan de vente ne fixe aucun tarif mobile (il écrit
 * « XXXX €/mois »), le modèle ne peut donc pas citer le plan — et remplit
 * `planSays: "n/a"` au lieu de ne pas émettre la violation. Sans ce filtre, un
 * tarif annoncé était sanctionné alors que le plan ne le contredisait pas.
 */
const NON_CITATIONS = new Set([
  'n/a',
  'na',
  'nc',
  'none',
  'null',
  'undefined',
  'aucun',
  'aucune',
  'neant',
  'rien',
  'vide',
  'inconnu',
  'absent',
  'non applicable',
  'non precise',
  'non specifie',
  'non renseigne',
  'non mentionne',
  'pas mentionne',
  'pas de mention',
  'non trouve',
  'silence',
]);

/** Normalise pour comparer : minuscules, sans accents, sans ponctuation de bord. */
function normalizeCitation(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^[\s"«»'`.\-–—:;]+|[\s"«»'`.\-–—:;]+$/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Une citation réelle, pas un marqueur d'absence. Trois lettres minimum : un
 * référentiel cité fait toujours plusieurs mots, jamais « - » ni « ? ».
 */
export function isCitation(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = normalizeCitation(value);
  if (normalized.length < 3) return false;
  return !NON_CITATIONS.has(normalized);
}
