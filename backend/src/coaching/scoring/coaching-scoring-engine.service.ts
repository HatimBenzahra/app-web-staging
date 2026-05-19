import { Injectable } from '@nestjs/common';
import {
  CriterionEvidencePayload,
  DeterministicScoringResult,
  EvidenceExtractionPayload,
  SalesPlanApplicationPayload,
  SalesPlanCriterionDefinition,
  ScoredStepPayload,
} from './coaching-scoring.types';

@Injectable()
export class CoachingScoringEngineService {
  calculateFromStepApplication(input: {
    salesPlanSteps: Array<{
      ordre: number;
      titre: string;
      poids: number;
    }>;
    application: SalesPlanApplicationPayload;
    qualityGateReviewReasons?: string[];
  }): DeterministicScoringResult {
    const applicationByStep = new Map(
      input.application.steps.map((step) => [Number(step.stepOrder), step]),
    );
    const stepEvaluations = input.salesPlanSteps
      .slice()
      .sort((a, b) => a.ordre - b.ordre)
      .map<ScoredStepPayload>((planStep) => {
        const applied = applicationByStep.get(planStep.ordre);
        const quality = this.normalizeStepQuality(applied?.quality, applied?.observed);
        const score = this.stepQualityScore(quality);
        const evidence = applied?.evidence.find((item) => this.cleanText(item.verbatim));
        const wentWell = (applied?.whatWentWell ?? []).filter(Boolean);
        const missing = (applied?.whatIsMissing ?? []).filter(Boolean);
        const advice = (applied?.coachingAdvice ?? []).filter(Boolean);
        return {
          ordre: planStep.ordre,
          titre: planStep.titre,
          coverageStatus: this.stepQualityCoverageStatus(quality),
          score,
          startTime: this.normalizeAbsoluteTime(evidence?.startTime, 0),
          endTime: this.normalizeAbsoluteTime(evidence?.endTime, 0),
          verbatim: this.cleanText(evidence?.verbatim),
          feedback:
            wentWell.length > 0
              ? wentWell.slice(0, 2).join(' ')
              : missing.length > 0
                ? missing.slice(0, 2).join(' ')
                : applied?.reasoning || 'Étape non observée dans le transcript.',
          recommendation:
            advice.length > 0
              ? advice.slice(0, 2).join(' ')
              : missing.length > 0
                ? `À renforcer: ${missing.slice(0, 2).join(', ')}.`
                : score >= 80
                  ? 'Conserver cette étape.'
                  : 'Clarifier cette étape dans la prochaine conversation.',
        };
      });

    const weightedOverall = this.weightedAverage(
      stepEvaluations,
      (step) => step.score ?? 0,
      (step) =>
        input.salesPlanSteps.find((candidate) => candidate.ordre === step.ordre)
          ?.poids ?? 1,
    );
    const objectionScore = this.dimensionScore(stepEvaluations, /objection/i);
    const closingScore = this.dimensionScore(stepEvaluations, /closing|prochaine/i);
    const planCoverageScore = this.weightedAverage(
      stepEvaluations,
      (step) =>
        step.coverageStatus === 'COVERED'
          ? 100
          : step.coverageStatus === 'PARTIAL'
            ? 55
            : 0,
      () => 1,
    );
    const lowConfidenceCount = input.application.steps.filter(
      (step) => step.observed && this.clamp(step.confidence) < 0.55,
    ).length;
    const reviewReasons = [...(input.qualityGateReviewReasons ?? [])];
    if (lowConfidenceCount > 0) {
      reviewReasons.push(`${lowConfidenceCount} étape(s) à faible confiance.`);
    }
    for (const uncertainty of input.application.uncertainties ?? []) {
      const cleaned = this.cleanText(uncertainty);
      if (cleaned) reviewReasons.push(cleaned);
    }

    return {
      overallScore: Math.round(weightedOverall),
      planCoverageScore: Math.round(planCoverageScore),
      executionQualityScore: Math.round(weightedOverall),
      objectionHandlingScore: objectionScore,
      listeningRatioScore: null,
      closingScore,
      stepEvaluations,
      strengths: this.dedupeStrings([
        ...input.application.strengths,
        ...input.application.steps.flatMap((step) => step.whatWentWell),
      ]).slice(0, 6),
      improvements: this.dedupeStrings([
        ...input.application.improvements,
        ...input.application.steps.flatMap((step) => step.whatIsMissing),
      ]).slice(0, 6),
      recommendations: this.dedupeStrings([
        ...input.application.recommendations,
        ...input.application.steps.flatMap((step) => step.coachingAdvice),
      ]).slice(0, 6),
      reviewRequired: reviewReasons.length > 0,
      reviewReason: reviewReasons.length > 0 ? reviewReasons.join(' ') : null,
    };
  }

  calculate(input: {
    criteria: SalesPlanCriterionDefinition[];
    evidence: EvidenceExtractionPayload;
    qualityGateReviewReasons?: string[];
  }): DeterministicScoringResult {
    const evidenceByKey = new Map<string, CriterionEvidencePayload>();
    for (const item of input.evidence.criteriaEvidence) {
      evidenceByKey.set(this.evidenceKey(item.stepOrder, item.criterionKey), item);
    }

    const criteriaByStep = new Map<number, SalesPlanCriterionDefinition[]>();
    for (const criterion of input.criteria) {
      const list = criteriaByStep.get(criterion.stepOrder) ?? [];
      list.push(criterion);
      criteriaByStep.set(criterion.stepOrder, list);
    }

    const stepEvaluations: ScoredStepPayload[] = Array.from(criteriaByStep.entries())
      .sort(([a], [b]) => a - b)
      .map(([stepOrder, criteria]) => this.scoreStep(stepOrder, criteria, evidenceByKey));

    const weightedOverall = this.weightedAverage(
      stepEvaluations,
      (step) => step.score ?? 0,
      (step) =>
        input.criteria
          .filter((criterion) => criterion.stepOrder === step.ordre)
          .reduce((sum, criterion) => sum + criterion.weight, 0) || 1,
    );

    const objectionScore = this.dimensionScore(stepEvaluations, /objection/i);
    const closingScore = this.dimensionScore(stepEvaluations, /closing|prochaine/i);
    const planCoverageScore = this.weightedAverage(
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

  normalizeEvidence(
    rawEvidence: EvidenceExtractionPayload,
    criteria: SalesPlanCriterionDefinition[],
    blockStartTime = 0,
  ): EvidenceExtractionPayload {
    const criteriaByKey = new Map(
      criteria.map((criterion) => [
        this.evidenceKey(criterion.stepOrder, criterion.key),
        criterion,
      ]),
    );

    const normalized: CriterionEvidencePayload[] = [];
    for (const item of rawEvidence.criteriaEvidence ?? []) {
        const criterion = criteriaByKey.get(
          this.evidenceKey(Number(item.stepOrder), String(item.criterionKey)),
        );
        if (!criterion) continue;
        const found = Boolean(item.found);
        const verbatim = this.cleanText(item.verbatim);
        const quality = this.normalizeQuality(item.quality, found, verbatim);
        normalized.push({
          salesPlanStepId: criterion.salesPlanStepId ?? null,
          salesPlanCriterionId: criterion.id ?? null,
          stepOrder: criterion.stepOrder,
          criterionKey: criterion.key,
          criterionLabel: criterion.label,
          found: found && Boolean(verbatim),
          quality,
          confidence: this.clamp(item.confidence),
          verbatim: found ? verbatim : null,
          startTime: this.normalizeAbsoluteTime(item.startTime, blockStartTime),
          endTime: this.normalizeAbsoluteTime(item.endTime, blockStartTime),
          reason: this.cleanText(item.reason),
          reviewStatus:
            found && (!verbatim || this.clamp(item.confidence) < 0.6)
              ? 'PENDING'
              : 'NOT_REQUIRED',
        });
    }

    for (const criterion of criteria) {
      const key = this.evidenceKey(criterion.stepOrder, criterion.key);
      if (normalized.some((item) => this.evidenceKey(item.stepOrder, item.criterionKey) === key)) {
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
        title: this.cleanText(event.title),
        summary: this.cleanText(event.summary),
        verbatim: this.cleanText(event.verbatim),
        startTime: this.normalizeAbsoluteTime(event.startTime, blockStartTime),
        endTime: this.normalizeAbsoluteTime(event.endTime, blockStartTime),
      })),
      uncertainties: (rawEvidence.uncertainties ?? [])
        .map((item) => this.cleanText(item))
        .filter((item): item is string => Boolean(item)),
      rawResponse: rawEvidence.rawResponse ?? null,
    };
  }

  private scoreStep(
    stepOrder: number,
    criteria: SalesPlanCriterionDefinition[],
    evidenceByKey: Map<string, CriterionEvidencePayload>,
  ): ScoredStepPayload {
    const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0) || 1;
    let earned = 0;
    const foundEvidence: CriterionEvidencePayload[] = [];
    const missingLabels: string[] = [];

    for (const criterion of criteria) {
      const evidence = evidenceByKey.get(this.evidenceKey(stepOrder, criterion.key));
      const multiplier = this.qualityMultiplier(evidence?.quality ?? 'MISSING');
      earned += criterion.weight * multiplier;
      if (evidence?.found && evidence.verbatim) {
        foundEvidence.push(evidence);
      } else if (criterion.required) {
        missingLabels.push(criterion.label);
      }
    }

    const score = Math.round((earned / totalWeight) * 100);
    const firstEvidence = foundEvidence[0];
    const coverageStatus =
      score >= 80 ? 'COVERED' : score >= 35 ? 'PARTIAL' : 'MISSING';
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

  private dimensionScore(steps: ScoredStepPayload[], pattern: RegExp): number {
    const matched = steps.filter((step) => pattern.test(step.titre));
    if (matched.length === 0) return 0;
    return Math.round(
      matched.reduce((sum, step) => sum + (step.score ?? 0), 0) /
        matched.length,
    );
  }

  private weightedAverage<T>(
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

  private qualityMultiplier(quality: string): number {
    if (quality === 'COMPLETE') return 1;
    if (quality === 'PARTIAL') return 0.7;
    if (quality === 'WEAK') return 0.4;
    return 0;
  }

  private stepQualityScore(quality: string): number {
    if (quality === 'COMPLETE') return 100;
    if (quality === 'PARTIAL') return 65;
    if (quality === 'WEAK') return 35;
    return 0;
  }

  private stepQualityCoverageStatus(
    quality: string,
  ): 'COVERED' | 'PARTIAL' | 'MISSING' {
    if (quality === 'COMPLETE') return 'COVERED';
    if (quality === 'MISSING') return 'MISSING';
    return 'PARTIAL';
  }

  private normalizeStepQuality(
    quality: string | undefined,
    observed: boolean | undefined,
  ): 'MISSING' | 'WEAK' | 'PARTIAL' | 'COMPLETE' {
    if (!observed) return 'MISSING';
    if (
      quality === 'COMPLETE' ||
      quality === 'PARTIAL' ||
      quality === 'WEAK' ||
      quality === 'MISSING'
    ) {
      return quality;
    }
    return 'PARTIAL';
  }

  private dedupeStrings(values: string[]): string[] {
    const seen = new Set<string>();
    const output: string[] = [];
    for (const value of values) {
      const cleaned = this.cleanText(value);
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(cleaned);
    }
    return output;
  }

  private normalizeQuality(
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

  private normalizeAbsoluteTime(
    value: number | null | undefined,
    blockStartTime: number,
  ): number | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return numeric < blockStartTime && numeric < 600
      ? Number((numeric + blockStartTime).toFixed(2))
      : Number(numeric.toFixed(2));
  }

  private cleanText(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 1200) : null;
  }

  private clamp(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0.5;
    return Math.max(0, Math.min(1, numeric));
  }

  private evidenceKey(stepOrder: number, criterionKey: string): string {
    return `${stepOrder}:${criterionKey}`;
  }
}
