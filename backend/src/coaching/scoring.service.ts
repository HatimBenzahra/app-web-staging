import { Injectable } from '@nestjs/common';
import {
  CriterionScore,
  LlmCoachingOutput,
  LlmCriterionResult,
  ScoringResult,
  StepScore,
} from './coaching.types';
import { ParsedSalesPlan, StepApplicability } from './sales-plan.types';

export interface ScoringContext {
  contractSigned: boolean;
  detectedProducts: string[];
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

    const score =
      globalWeight > 0
        ? Math.round((globalObtained / globalWeight) * 1000) / 10
        : 0;

    return { score, subScores, criterionResults };
  }
}
