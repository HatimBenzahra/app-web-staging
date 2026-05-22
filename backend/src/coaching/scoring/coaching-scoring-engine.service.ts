import { Injectable } from '@nestjs/common';
import {
  DeterministicScoringResult,
  EvidenceExtractionPayload,
  SalesPlanApplicationPayload,
  SalesPlanCriterionDefinition,
  ScoredStepPayload,
} from './coaching-scoring.types';
import {
  calculateEvidenceScoring,
  normalizeEvidencePayload,
} from './coaching-evidence-scoring.utils';
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
        const scoreable = applied?.scoreable !== false;
        const quality = scoreable
          ? this.normalizeStepQuality(applied?.quality, applied?.observed)
          : 'MISSING';
        const score = this.stepQualityScore(quality);
        const evidence = applied?.evidence.find((item) => this.cleanText(item.verbatim));
        const wentWell = (applied?.whatWentWell ?? []).filter(Boolean);
        const missing = (applied?.whatIsMissing ?? []).filter(Boolean);
        const advice = (applied?.coachingAdvice ?? []).filter(Boolean);
        const notVerifiable =
          applied?.missingBecause === 'TRANSCRIPT_UNCLEAR' || !scoreable;
        return {
          ordre: planStep.ordre,
          titre: planStep.titre,
          coverageStatus: this.stepQualityCoverageStatus(quality),
          score,
          startTime: this.normalizeAbsoluteTime(evidence?.startTime, 0),
          endTime: this.normalizeAbsoluteTime(evidence?.endTime, 0),
          verbatim: this.cleanText(evidence?.verbatim),
          feedback:
            notVerifiable
              ? 'Étape non vérifiable à cause de la qualité du transcript.'
              :
            wentWell.length > 0
              ? wentWell.slice(0, 2).join(' ')
              : missing.length > 0
                ? missing.slice(0, 2).join(' ')
                : applied?.reasoning || 'Étape non observée dans le transcript.',
          recommendation:
            notVerifiable
              ? 'Faire une revue humaine ou améliorer la qualité audio avant scoring.'
              :
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
    const nonScoreableCount = input.application.steps.filter(
      (step) => step.scoreable === false,
    ).length;
    const reviewReasons = [...(input.qualityGateReviewReasons ?? [])];
    if (lowConfidenceCount > 0) {
      reviewReasons.push(`${lowConfidenceCount} étape(s) à faible confiance.`);
    }
    if (nonScoreableCount > 0) {
      reviewReasons.push(
        `${nonScoreableCount} étape(s) non vérifiable(s) automatiquement.`,
      );
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
    return calculateEvidenceScoring(input);
  }
  normalizeEvidence(
    rawEvidence: EvidenceExtractionPayload,
    criteria: SalesPlanCriterionDefinition[],
    blockStartTime = 0,
  ): EvidenceExtractionPayload {
    return normalizeEvidencePayload(rawEvidence, criteria, blockStartTime);
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
}
