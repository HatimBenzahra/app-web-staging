/**
 * Aggregation of per-conversation evaluations into a session-level evaluation.
 * Pure functions, no DI.
 */

import type {
  CoachingConversationBlock,
  KeyMomentPayload,
  SessionEvaluationPayload,
  StepEvaluationPayload,
} from '../types/coaching-pipeline.types';

type ConversationResult = {
  block: CoachingConversationBlock;
  evaluation: SessionEvaluationPayload | null;
};

type SalesPlanLike = {
  steps: Array<{
    ordre: number;
    titre: string;
    description: string | null;
    expectedSignals: string | null;
    poids: number;
  }>;
};

/** Format seconds as MM:SS (zero-padded). */
export function formatTimestamp(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
}

/**
 * Build a unified readable transcript by concatenating per-conversation
 * readable transcripts with timestamp headers.
 */
export function buildReadableTranscriptFromConversations(
  conversationResults: ConversationResult[],
  fallbackTranscript: string,
): string {
  const sorted = [...conversationResults].sort(
    (a, b) => a.block.ordre - b.block.ordre,
  );

  const sections: string[] = [];
  for (const r of sorted) {
    const text = (
      r.block.readableTranscriptText ??
      r.block.transcriptText ??
      ''
    ).trim();
    if (!text) continue;
    const start =
      typeof r.block.startTime === 'number'
        ? formatTimestamp(r.block.startTime)
        : null;
    const end =
      typeof r.block.endTime === 'number'
        ? formatTimestamp(r.block.endTime)
        : null;
    const header =
      start && end
        ? `--- Conversation ${r.block.ordre} [${start}-${end}] ---`
        : `--- Conversation ${r.block.ordre} ---`;
    sections.push(`${header}\n${text}`);
  }

  if (sections.length === 0) {
    return fallbackTranscript;
  }
  return sections.join('\n\n');
}

/**
 * Aggregate per-conversation evaluations into one session-level evaluation.
 * Uses weighted averages (by conversation duration) for averageable scores
 * and max() for scores that are "best demonstration" (objection handling, closing).
 * Returns null if no conversation has been evaluated.
 */
export function aggregateConversationEvaluations(
  salesPlanVersion: SalesPlanLike,
  conversationResults: ConversationResult[],
): SessionEvaluationPayload | null {
  const valid = conversationResults.filter(
    (
      r,
    ): r is {
      block: CoachingConversationBlock;
      evaluation: SessionEvaluationPayload;
    } => r.evaluation !== null,
  );
  if (valid.length === 0) {
    return null;
  }

  const weights = valid.map((r) => {
    const start = r.block.startTime ?? 0;
    const end = r.block.endTime ?? start + 1;
    return Math.max(1, end - start);
  });

  const weightedAverage = (
    getter: (e: SessionEvaluationPayload) => number | null | undefined,
  ): number | null => {
    let sum = 0;
    let totalWeight = 0;
    valid.forEach((r, idx) => {
      const value = getter(r.evaluation);
      if (typeof value !== 'number' || !Number.isFinite(value)) return;
      sum += value * weights[idx];
      totalWeight += weights[idx];
    });
    return totalWeight > 0 ? Math.round(sum / totalWeight) : null;
  };

  const maxOf = (
    getter: (e: SessionEvaluationPayload) => number | null | undefined,
  ): number | null => {
    let best = -1;
    for (const r of valid) {
      const value = getter(r.evaluation);
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      if (value > best) best = value;
    }
    return best >= 0 ? best : null;
  };

  const coverageRank: Record<string, number> = {
    COVERED: 3,
    PARTIAL: 2,
    MISSING: 1,
  };

  const stepsByOrder = new Map<number, StepEvaluationPayload>();
  for (const r of valid) {
    for (const step of r.evaluation.stepEvaluations || []) {
      const existing = stepsByOrder.get(step.ordre);
      const newRank = coverageRank[step.coverageStatus ?? ''] ?? 0;
      const oldRank = existing
        ? coverageRank[existing.coverageStatus ?? ''] ?? 0
        : -1;
      if (
        !existing ||
        newRank > oldRank ||
        (newRank === oldRank && (step.score ?? 0) > (existing.score ?? 0))
      ) {
        stepsByOrder.set(step.ordre, step);
      }
    }
  }

  const dedupeStrings = (lists: string[][]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const list of lists) {
      for (const raw of list) {
        const value = (raw ?? '').trim();
        if (!value) continue;
        const key = value.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(value);
      }
    }
    return out;
  };

  const keyMomentSeen = new Set<string>();
  const aggregatedKeyMoments: KeyMomentPayload[] = [];
  for (const r of valid) {
    for (const moment of r.evaluation.keyMoments || []) {
      const bucketStart =
        typeof moment.startTime === 'number'
          ? Math.round(moment.startTime / 10) * 10
          : 'na';
      const key = `${moment.type}|${bucketStart}`;
      if (keyMomentSeen.has(key)) continue;
      keyMomentSeen.add(key);
      aggregatedKeyMoments.push(moment);
    }
  }
  aggregatedKeyMoments.sort(
    (a, b) => (a.startTime ?? 0) - (b.startTime ?? 0),
  );

  const summary = valid
    .map((r) => {
      const text = (r.evaluation.summary ?? '').trim();
      return text ? `Conversation ${r.block.ordre}: ${text}` : null;
    })
    .filter((line): line is string => Boolean(line))
    .join('\n\n');

  return {
    overallScore: weightedAverage((e) => e.overallScore),
    planCoverageScore: maxOf((e) => e.planCoverageScore),
    executionQualityScore: weightedAverage((e) => e.executionQualityScore),
    objectionHandlingScore: maxOf((e) => e.objectionHandlingScore),
    listeningRatioScore: weightedAverage((e) => e.listeningRatioScore),
    closingScore: maxOf((e) => e.closingScore),
    summary: summary || null,
    strengths: dedupeStrings(valid.map((r) => r.evaluation.strengths)).slice(
      0,
      6,
    ),
    improvements: dedupeStrings(valid.map((r) => r.evaluation.improvements)).slice(
      0,
      6,
    ),
    recommendations: dedupeStrings(
      valid.map((r) => r.evaluation.recommendations),
    ).slice(0, 6),
    keyMoments: aggregatedKeyMoments.slice(0, 8),
    stepEvaluations: salesPlanVersion.steps.map<StepEvaluationPayload>(
      (planStep) => {
        const evaluated = stepsByOrder.get(planStep.ordre);
        if (evaluated) {
          return evaluated;
        }
        return {
          ordre: planStep.ordre,
          titre: planStep.titre,
          coverageStatus: 'MISSING',
          score: 0,
          startTime: null,
          endTime: null,
          verbatim: '',
          feedback:
            'Étape non observée dans les conversations évaluées de cette session.',
          recommendation:
            "Vérifier si cette phase aurait pu être couverte; sinon, l'inclure dans la prochaine prospection.",
        };
      },
    ),
    rawResponse: `Agrégation de ${valid.length} conversation(s)`,
    usedFallback: false,
  };
}
