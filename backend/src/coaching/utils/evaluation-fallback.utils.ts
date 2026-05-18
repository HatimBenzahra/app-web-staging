/**
 * Heuristic fallback evaluation + completion of partial LLM evaluations.
 * Pure functions, no DI.
 */

import type {
  SessionEvaluationPayload,
  StepEvaluationPayload,
} from '../types/coaching-pipeline.types';
import {
  extractBestVerbatim,
  resolveExcerptTimeRange,
} from './transcript-parsing.utils';
import {
  buildFallbackKeyMoments,
  completeKeyMomentTiming,
} from './evaluation-normalizers.utils';

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
 * Build a heuristic evaluation when the LLM is unavailable.
 * Uses keyword match against each step's signals/description.
 */
export function evaluateWithFallback(
  salesPlanVersion: SalesPlanForEval,
  transcriptText: string,
): SessionEvaluationPayload {
  const lowerTranscript = transcriptText.toLowerCase();
  const totalWeight = salesPlanVersion.steps.reduce(
    (sum, step) => sum + step.poids,
    0,
  );

  const stepEvaluations = salesPlanVersion.steps.map((step) => {
    const sourceText = [
      step.titre,
      step.description || '',
      step.expectedSignals || '',
    ]
      .join(' ')
      .toLowerCase();

    const keywords = Array.from(
      new Set(
        sourceText
          .split(/[^a-zA-ZÀ-ÿ0-9]+/)
          .map((token) => token.trim())
          .filter((token) => token.length >= 4),
      ),
    ).slice(0, 8);

    const hits = keywords.filter((keyword) =>
      lowerTranscript.includes(keyword),
    );
    const ratio = keywords.length === 0 ? 0 : hits.length / keywords.length;

    let coverageStatus: StepEvaluationPayload['coverageStatus'] = 'MISSING';
    let score = 35;

    if (ratio >= 0.45) {
      coverageStatus = 'COVERED';
      score = 85;
    } else if (ratio >= 0.15) {
      coverageStatus = 'PARTIAL';
      score = 60;
    }

    const excerpt = extractBestVerbatim(transcriptText, hits[0]);
    const excerptRange = excerpt
      ? resolveExcerptTimeRange(transcriptText, excerpt)
      : null;

    return {
      ordre: step.ordre,
      titre: step.titre,
      coverageStatus,
      score,
      startTime: excerptRange?.start ?? null,
      endTime: excerptRange?.end ?? null,
      verbatim: excerpt,
      feedback:
        coverageStatus === 'COVERED'
          ? 'La transcription contient des signaux compatibles avec cette étape.'
          : coverageStatus === 'PARTIAL'
            ? 'L’étape apparaît partiellement dans la transcription et mérite une vérification humaine.'
            : 'Aucun signal clair de cette étape n’a été détecté automatiquement.',
      recommendation:
        coverageStatus === 'MISSING'
          ? `Renforcer explicitement l’étape "${step.titre}" pendant la trame commerciale.`
          : `Consolider la formulation de l’étape "${step.titre}" pour la rendre plus nette.`,
    };
  });

  const weightedScore = Math.round(
    stepEvaluations.reduce((sum, step) => {
      const sourceStep = salesPlanVersion.steps.find(
        (candidate) => candidate.ordre === step.ordre,
      );
      return sum + (step.score || 0) * (sourceStep?.poids || 0);
    }, 0) / Math.max(totalWeight, 1),
  );

  const weightedCoverageScore = Math.round(
    stepEvaluations.reduce((sum, step) => {
      const sourceStep = salesPlanVersion.steps.find(
        (candidate) => candidate.ordre === step.ordre,
      );
      const coverageValue =
        step.coverageStatus === 'COVERED'
          ? 100
          : step.coverageStatus === 'PARTIAL'
            ? 55
            : 0;
      return sum + coverageValue * (sourceStep?.poids || 0);
    }, 0) / Math.max(totalWeight, 1),
  );

  return {
    overallScore: weightedScore,
    planCoverageScore: weightedCoverageScore,
    executionQualityScore: weightedScore,
    objectionHandlingScore: lowerTranscript.includes('objection')
      ? 65
      : Math.max(45, weightedScore - 10),
    listeningRatioScore: null,
    closingScore:
      lowerTranscript.includes('rendez-vous') ||
      lowerTranscript.includes('contrat') ||
      lowerTranscript.includes('signature')
        ? 72
        : 48,
    summary:
      'Évaluation de secours calculée sans le LLM principal. Utiliser ce rapport pour tester le flow puis valider manuellement.',
    strengths: stepEvaluations
      .filter((step) => step.coverageStatus === 'COVERED')
      .slice(0, 3)
      .map((step) => `Étape bien visible: ${step.titre}`),
    improvements: stepEvaluations
      .filter((step) => step.coverageStatus !== 'COVERED')
      .slice(0, 3)
      .map((step) => `Travailler l’étape: ${step.titre}`),
    recommendations: [
      'Faire relire le rapport si le scoring paraît trop mécanique.',
      'Comparer le transcript avec la trame commerciale réelle avant validation finale.',
    ],
    keyMoments: buildFallbackKeyMoments(transcriptText),
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
        existing?.coverageStatus || fallbackStep?.coverageStatus || 'MISSING',
      score: existing?.score ?? fallbackStep?.score ?? null,
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
      verbatim: existing?.verbatim ?? fallbackStep?.verbatim ?? null,
      feedback: existing?.feedback ?? fallbackStep?.feedback ?? null,
      recommendation:
        existing?.recommendation ?? fallbackStep?.recommendation ?? null,
    };
  });

  const totalWeight = salesPlanVersion.steps.reduce(
    (sum, step) => sum + step.poids,
    0,
  );
  const weightedScore = Math.round(
    stepEvaluations.reduce((sum, step) => {
      const sourceStep = salesPlanVersion.steps.find(
        (candidate) => candidate.ordre === step.ordre,
      );
      return sum + (step.score || 0) * (sourceStep?.poids || 0);
    }, 0) / Math.max(totalWeight, 1),
  );

  return {
    ...evaluation,
    overallScore: evaluation.overallScore ?? weightedScore,
    planCoverageScore:
      evaluation.planCoverageScore ?? fallback.planCoverageScore,
    executionQualityScore: evaluation.executionQualityScore ?? weightedScore,
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
