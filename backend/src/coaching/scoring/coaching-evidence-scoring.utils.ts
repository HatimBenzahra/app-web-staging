import {
  CriterionEvidencePayload,
  DeterministicScoringResult,
  EvidenceExtractionPayload,
  SalesPlanCriterionDefinition,
  ScoredStepPayload,
} from './coaching-scoring.types';

export function calculateEvidenceScoring(input: {
  criteria: SalesPlanCriterionDefinition[];
  evidence: EvidenceExtractionPayload;
  qualityGateReviewReasons?: string[];
}): DeterministicScoringResult {
  const evidenceByKey = new Map<string, CriterionEvidencePayload>();
  for (const item of input.evidence.criteriaEvidence) {
    evidenceByKey.set(evidenceKey(item.stepOrder, item.criterionKey), item);
  }
  const criteriaByStep = new Map<number, SalesPlanCriterionDefinition[]>();
  for (const criterion of input.criteria) {
    const list = criteriaByStep.get(criterion.stepOrder) ?? [];
    list.push(criterion);
    criteriaByStep.set(criterion.stepOrder, list);
  }
  const stepEvaluations = Array.from(criteriaByStep.entries())
    .sort(([a], [b]) => a - b)
    .map(([stepOrder, criteria]) => scoreStep(stepOrder, criteria, evidenceByKey));
  const weightedOverall = weightedAverage(
    stepEvaluations,
    (step) => step.score ?? 0,
    (step) =>
      input.criteria
        .filter((criterion) => criterion.stepOrder === step.ordre)
        .reduce((sum, criterion) => sum + criterion.weight, 0) || 1,
  );
  const objectionScore = dimensionScore(stepEvaluations, /objection/i);
  const closingScore = dimensionScore(stepEvaluations, /closing|prochaine/i);
  const planCoverageScore = weightedAverage(
    stepEvaluations,
    (step) =>
      step.coverageStatus === 'COVERED'
        ? 100
        : step.coverageStatus === 'PARTIAL'
          ? 55
          : 0,
    () => 1,
  );
  const weakEvidenceCount = input.evidence.criteriaEvidence.filter(
    (item) => item.found && item.confidence < 0.6,
  ).length;
  const reviewReasons = [...(input.qualityGateReviewReasons ?? [])];
  if (weakEvidenceCount > 0) {
    reviewReasons.push(`${weakEvidenceCount} preuve(s) à faible confiance.`);
  }
  for (const uncertainty of input.evidence.uncertainties ?? []) {
    if (uncertainty) reviewReasons.push(uncertainty);
  }
  const improvements = stepEvaluations
    .filter((step) => step.coverageStatus !== 'COVERED')
    .map((step) => `${step.titre}: ${step.recommendation || 'renforcer cette étape.'}`)
    .slice(0, 6);
  const strengths = stepEvaluations
    .filter((step) => step.coverageStatus === 'COVERED')
    .map((step) => `${step.titre}: preuve observable.`)
    .slice(0, 4);
  return {
    overallScore: Math.round(weightedOverall),
    planCoverageScore: Math.round(planCoverageScore),
    executionQualityScore: Math.round(weightedOverall),
    objectionHandlingScore: objectionScore,
    listeningRatioScore: null,
    closingScore,
    stepEvaluations,
    strengths,
    improvements,
    recommendations: improvements.length
      ? improvements
      : ['Continuer à appliquer les étapes du plan avec des preuves verbales claires.'],
    reviewRequired: reviewReasons.length > 0,
    reviewReason: reviewReasons.length > 0 ? reviewReasons.join(' ') : null,
  };
}

export function normalizeEvidencePayload(
  rawEvidence: EvidenceExtractionPayload,
  criteria: SalesPlanCriterionDefinition[],
  blockStartTime = 0,
): EvidenceExtractionPayload {
  const criteriaByKey = new Map(
    criteria.map((criterion) => [
      evidenceKey(criterion.stepOrder, criterion.key),
      criterion,
    ]),
  );
  const normalized: CriterionEvidencePayload[] = [];
  for (const item of rawEvidence.criteriaEvidence ?? []) {
    const criterion = criteriaByKey.get(
      evidenceKey(Number(item.stepOrder), String(item.criterionKey)),
    );
    if (!criterion) continue;
    const found = Boolean(item.found);
    const verbatim = cleanText(item.verbatim);
    const quality = normalizeQuality(item.quality, found, verbatim);
    normalized.push({
      salesPlanStepId: criterion.salesPlanStepId ?? null,
      salesPlanCriterionId: criterion.id ?? null,
      stepOrder: criterion.stepOrder,
      criterionKey: criterion.key,
      criterionLabel: criterion.label,
      found: found && Boolean(verbatim),
      quality,
      confidence: clamp(item.confidence),
      verbatim: found ? verbatim : null,
      startTime: normalizeAbsoluteTime(item.startTime, blockStartTime),
      endTime: normalizeAbsoluteTime(item.endTime, blockStartTime),
      reason: cleanText(item.reason),
      evidenceCompleteness: item.evidenceCompleteness ?? 'NONE',
      missingBecause: item.missingBecause ?? null,
      scoreable: item.scoreable ?? true,
      sourceTurnIds: item.sourceTurnIds ?? [],
      reviewStatus:
        (found && (!verbatim || clamp(item.confidence) < 0.6)) ||
        item.scoreable === false
          ? 'PENDING'
          : 'NOT_REQUIRED',
    });
  }
  for (const criterion of criteria) {
    const key = evidenceKey(criterion.stepOrder, criterion.key);
    if (normalized.some((item) => evidenceKey(item.stepOrder, item.criterionKey) === key)) {
      continue;
    }
    normalized.push({
      salesPlanStepId: criterion.salesPlanStepId ?? null,
      salesPlanCriterionId: criterion.id ?? null,
      stepOrder: criterion.stepOrder,
      criterionKey: criterion.key,
      criterionLabel: criterion.label,
      found: false,
      quality: 'MISSING',
      confidence: 0.8,
      verbatim: null,
      startTime: null,
      endTime: null,
      reason: 'Aucune preuve observable fournie par l’extraction.',
      evidenceCompleteness: 'NONE',
      missingBecause: 'NOT_OBSERVED',
      scoreable: true,
      sourceTurnIds: [],
      reviewStatus: 'NOT_REQUIRED',
    });
  }
  return {
    segmentQuality: rawEvidence.segmentQuality,
    criteriaEvidence: normalized.sort(
      (a, b) =>
        a.stepOrder - b.stepOrder ||
        a.criterionKey.localeCompare(b.criterionKey),
    ),
    keyEvents: (rawEvidence.keyEvents ?? []).map((event) => ({
      ...event,
      title: cleanText(event.title),
      summary: cleanText(event.summary),
      verbatim: cleanText(event.verbatim),
      startTime: normalizeAbsoluteTime(event.startTime, blockStartTime),
      endTime: normalizeAbsoluteTime(event.endTime, blockStartTime),
    })),
    uncertainties: (rawEvidence.uncertainties ?? [])
      .map((item) => cleanText(item))
      .filter((item): item is string => Boolean(item)),
    rawResponse: rawEvidence.rawResponse ?? null,
  };
}

function scoreStep(
  stepOrder: number,
  criteria: SalesPlanCriterionDefinition[],
  evidenceByKey: Map<string, CriterionEvidencePayload>,
): ScoredStepPayload {
  const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0) || 1;
  let earned = 0;
  const foundEvidence: CriterionEvidencePayload[] = [];
  const missingLabels: string[] = [];
  for (const criterion of criteria) {
    const evidence = evidenceByKey.get(evidenceKey(stepOrder, criterion.key));
    earned += criterion.weight * qualityMultiplier(evidence?.quality ?? 'MISSING');
    if (evidence?.found && evidence.verbatim) {
      foundEvidence.push(evidence);
    } else if (criterion.required) {
      missingLabels.push(criterion.label);
    }
  }
  const score = Math.round((earned / totalWeight) * 100);
  const firstEvidence = foundEvidence[0];
  const coverageStatus = score >= 80 ? 'COVERED' : score >= 35 ? 'PARTIAL' : 'MISSING';
  return {
    ordre: stepOrder,
    titre: criteria[0]?.stepTitle ?? `Étape ${stepOrder}`,
    coverageStatus,
    score,
    startTime: firstEvidence?.startTime ?? null,
    endTime: firstEvidence?.endTime ?? null,
    verbatim: firstEvidence?.verbatim ?? null,
    feedback:
      foundEvidence.length > 0
        ? `${foundEvidence.length}/${criteria.length} critère(s) avec preuve observable.`
        : 'Aucune preuve observable pour cette étape.',
    recommendation:
      missingLabels.length > 0
        ? `Travailler: ${missingLabels.slice(0, 3).join(', ')}.`
        : coverageStatus === 'COVERED'
          ? 'Conserver cette étape.'
          : 'Renforcer la qualité des preuves sur cette étape.',
  };
}

function dimensionScore(steps: ScoredStepPayload[], pattern: RegExp): number {
  const matched = steps.filter((step) => pattern.test(step.titre));
  if (matched.length === 0) return 0;
  return Math.round(
    matched.reduce((sum, step) => sum + (step.score ?? 0), 0) / matched.length,
  );
}

function weightedAverage<T>(
  items: T[],
  value: (item: T) => number,
  weight: (item: T) => number,
): number {
  if (items.length === 0) return 0;
  const totals = items.reduce(
    (acc, item) => {
      const w = Math.max(0, weight(item));
      acc.weight += w;
      acc.value += value(item) * w;
      return acc;
    },
    { value: 0, weight: 0 },
  );
  return totals.weight > 0 ? totals.value / totals.weight : 0;
}

function qualityMultiplier(quality: string): number {
  if (quality === 'COMPLETE') return 1;
  if (quality === 'PARTIAL') return 0.7;
  if (quality === 'WEAK') return 0.4;
  return 0;
}

function normalizeQuality(
  quality: string | undefined,
  found: boolean,
  verbatim: string | null,
): 'MISSING' | 'WEAK' | 'PARTIAL' | 'COMPLETE' {
  if (!found || !verbatim) return 'MISSING';
  if (quality === 'COMPLETE' || quality === 'PARTIAL' || quality === 'WEAK') {
    return quality;
  }
  return 'PARTIAL';
}

function normalizeAbsoluteTime(
  value: number | null | undefined,
  blockStartTime: number,
): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric < blockStartTime && numeric < 600
    ? Number((numeric + blockStartTime).toFixed(2))
    : Number(numeric.toFixed(2));
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 1200) : null;
}

function clamp(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.5;
  return Math.max(0, Math.min(1, numeric));
}

function evidenceKey(stepOrder: number, criterionKey: string): string {
  return `${stepOrder}:${criterionKey}`;
}
