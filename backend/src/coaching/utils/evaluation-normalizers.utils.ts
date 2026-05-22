/**
 * Normalizers for LLM evaluation output.
 * Pure functions, no DI, no side effects.
 */

import type { KeyMomentPayload } from '../types/coaching-pipeline.types';
import { resolveExcerptTimeRange } from './transcript-parsing.utils';

export function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)
    .slice(0, 6);
}

export function normalizeScore(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(num)));
}

export function normalizeNullableScore(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return normalizeScore(value);
}

export function normalizeNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  return Math.round(num * 10) / 10;
}

export function normalizeCoverageStatus(
  value: unknown,
): 'COVERED' | 'PARTIAL' | 'MISSING' {
  if (value === 'COVERED' || value === 'PARTIAL' || value === 'MISSING') {
    return value;
  }
  return 'MISSING';
}

export function normalizeKeyMoment(value: unknown): KeyMomentPayload | null {
  const record =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const title = normalizeText(record.title);
  if (!title) {
    return null;
  }
  return {
    type:
      normalizeText(record.type)
        ?.toUpperCase()
        .replace(/[^A-Z0-9_]/g, '_')
        .slice(0, 40) || 'A_REVOIR',
    title,
    summary: normalizeText(record.summary),
    startTime: normalizeNullableNumber(record.startTime),
    endTime: normalizeNullableNumber(record.endTime),
    verbatim: normalizeText(record.verbatim),
    importance: normalizeNullableScore(record.importance),
  };
}

export function completeKeyMomentTiming(
  transcriptText: string,
  moment: KeyMomentPayload,
): KeyMomentPayload {
  if (moment.startTime !== null && moment.startTime !== undefined) {
    return moment;
  }
  const range = resolveExcerptTimeRange(
    transcriptText,
    moment.verbatim || moment.summary || moment.title,
  );
  return {
    ...moment,
    startTime: range?.start ?? null,
    endTime: range?.end ?? null,
  };
}

export function buildFallbackKeyMoments(
  _transcriptText: string,
): KeyMomentPayload[] {
  return [];
}
