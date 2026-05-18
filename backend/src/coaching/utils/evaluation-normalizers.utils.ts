/**
 * Normalizers for LLM evaluation output.
 * Pure functions, no DI, no side effects.
 */

import type { KeyMomentPayload } from '../types/coaching-pipeline.types';
import {
  extractBestVerbatim,
  resolveExcerptTimeRange,
} from './transcript-parsing.utils';

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

export function normalizeKeyMoment(value: any): KeyMomentPayload | null {
  const title = normalizeText(value?.title);
  if (!title) {
    return null;
  }
  return {
    type:
      normalizeText(value?.type)
        ?.toUpperCase()
        .replace(/[^A-Z0-9_]/g, '_')
        .slice(0, 40) || 'A_REVOIR',
    title,
    summary: normalizeText(value?.summary),
    startTime: normalizeNullableNumber(value?.startTime),
    endTime: normalizeNullableNumber(value?.endTime),
    verbatim: normalizeText(value?.verbatim),
    importance: normalizeNullableScore(value?.importance),
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
  transcriptText: string,
): KeyMomentPayload[] {
  const moments: KeyMomentPayload[] = [];
  const patterns: Array<{ type: string; title: string; keywords: string[] }> = [
    {
      type: 'OBJECTION',
      title: 'Objection ou hesitation client',
      keywords: ['pas intéressé', 'pas interesse', 'trop cher', 'réfléchir', 'refus'],
    },
    {
      type: 'SIGNAL_ACHAT',
      title: 'Signal d interet',
      keywords: ['combien', 'rendez-vous', 'contrat', 'signature', 'installer'],
    },
    {
      type: 'PROMESSE',
      title: 'Promesse ou engagement',
      keywords: ['je vous rappelle', 'on repasse', 'je vous envoie', 'demain'],
    },
  ];

  const lowerTranscript = transcriptText.toLowerCase();
  for (const pattern of patterns) {
    const keyword = pattern.keywords.find((entry) =>
      lowerTranscript.includes(entry.toLowerCase()),
    );
    const match = keyword ? extractBestVerbatim(transcriptText, keyword) : null;
    if (!match) {
      continue;
    }
    const range = resolveExcerptTimeRange(transcriptText, match);
    moments.push({
      type: pattern.type,
      title: pattern.title,
      summary: 'Moment détecté automatiquement à partir du transcript.',
      startTime: range?.start ?? null,
      endTime: range?.end ?? null,
      verbatim: match,
      importance: 65,
    });
  }
  return moments.slice(0, 4);
}
