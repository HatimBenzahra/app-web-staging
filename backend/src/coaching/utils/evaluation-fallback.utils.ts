/**
 * Conservative fallback evaluation + completion of partial LLM evaluations.
 * Pure functions, no DI.
 */

import type {
  SessionEvaluationPayload,
} from '../types/coaching-pipeline.types';
import { resolveExcerptTimeRange } from './transcript-parsing.utils';
import { completeKeyMomentTiming } from './evaluation-normalizers.utils';

type SalesPlanForEval = {
  steps: Array<{
    ordre: number;
    titre: string;
    description: string | null;
    expectedSignals: string | null;
    poids: number;
  }>;
};

/**
 * Build a conservative placeholder when the LLM is unavailable.
 * It intentionally does not infer coverage, scores, key moments or dimensions
 * from transcript terms. Natural-language understanding belongs to the LLM
 * and to explicit human review.
 */
export function evaluateWithFallback(
  salesPlanVersion: SalesPlanForEval,
  _transcriptText: string,
): SessionEvaluationPayload {
  const stepEvaluations = salesPlanVersion.steps.map((step) => {
    return {
      ordre: step.ordre,
      titre: step.titre,
      coverageStatus: 'MISSING' as const,
      score: 0,
      startTime: null,
      endTime: null,
      verbatim: null,
      feedback:
        'Évaluation non calculée: le LLM d’analyse est indisponible ou incomplet.',
      recommendation:
        'Relancer l’analyse ou effectuer une revue humaine; aucun score automatique par mots-clés.',
    };
  });

  return {
    overallScore: 0,
    planCoverageScore: 0,
    executionQualityScore: 0,
    objectionHandlingScore: 0,
    listeningRatioScore: null,
    closingScore: 0,
    summary:
      'Évaluation non calculée automatiquement: le LLM principal n’a pas fourni d’analyse exploitable.',
    strengths: [],
    improvements: [
      'Revue humaine requise: aucun scoring par mots-clés n’est autorisé.',
    ],
    recommendations: [
      'Relancer l’analyse lorsque le service LLM est disponible.',
      'Valider manuellement la transcription finale avant toute conclusion commerciale.',
    ],
    keyMoments: [],
    stepEvaluations,
    rawResponse: null,
    usedFallback: true,
  };
}

/**
 * Merge a partial LLM evaluation with the heuristic fallback to fill gaps.
 */
export function completeEvaluationPayload(
  salesPlanVersion: SalesPlanForEval,
  evaluation: SessionEvaluationPayload,
  transcriptText: string,
): SessionEvaluationPayload {
  const fallback = evaluateWithFallback(salesPlanVersion, transcriptText);
  const byOrder = new Map(
    evaluation.stepEvaluations.map((step) => [step.ordre, step]),
  );

  const stepEvaluations = salesPlanVersion.steps.map((planStep) => {
    const existing = byOrder.get(planStep.ordre);
    const fallbackStep = fallback.stepEvaluations.find(
      (step) => step.ordre === planStep.ordre,
    );

    return {
      ordre: planStep.ordre,
      titre: existing?.titre || planStep.titre,
      coverageStatus:
        existing?.coverageStatus ?? fallbackStep?.coverageStatus ?? 'MISSING',
      score: existing?.score ?? fallbackStep?.score ?? 0,
      startTime:
        existing?.startTime ??
        fallbackStep?.startTime ??
        resolveExcerptTimeRange(transcriptText, existing?.verbatim)?.start ??
        null,
      endTime:
        existing?.endTime ??
        fallbackStep?.endTime ??
        resolveExcerptTimeRange(transcriptText, existing?.verbatim)?.end ??
        null,
      verbatim: existing?.verbatim ?? null,
      feedback: existing?.feedback ?? fallbackStep?.feedback ?? null,
      recommendation:
        existing?.recommendation ?? fallbackStep?.recommendation ?? null,
    };
  });

  return {
    ...evaluation,
    overallScore: evaluation.overallScore ?? fallback.overallScore,
    planCoverageScore:
      evaluation.planCoverageScore ?? fallback.planCoverageScore,
    executionQualityScore:
      evaluation.executionQualityScore ?? fallback.executionQualityScore,
    objectionHandlingScore:
      evaluation.objectionHandlingScore ?? fallback.objectionHandlingScore,
    listeningRatioScore:
      evaluation.listeningRatioScore ?? fallback.listeningRatioScore,
    closingScore: evaluation.closingScore ?? fallback.closingScore,
    summary: evaluation.summary ?? fallback.summary,
    strengths:
      evaluation.strengths.length > 0
        ? evaluation.strengths
        : fallback.strengths,
    improvements:
      evaluation.improvements.length > 0
        ? evaluation.improvements
        : fallback.improvements,
    recommendations:
      evaluation.recommendations.length > 0
        ? evaluation.recommendations
        : fallback.recommendations,
    keyMoments:
      evaluation.keyMoments.length > 0
        ? evaluation.keyMoments.map((moment) =>
            completeKeyMomentTiming(transcriptText, moment),
          )
        : fallback.keyMoments,
    stepEvaluations,
  };
}
