import type { DialogueNormalizationPayload } from '../types/coaching-dialogue.types';
import type { TranscriptionMemory } from '../types/transcription-memory.types';
import type { TranscriptCleanerAgentResult } from '../agents/transcript-cleaner/transcript-cleaner-agent.types';
import {
  COACHING_CANONICAL_TERMS,
  COACHING_COMMON_MISHEARINGS,
} from './coaching-domain-vocabulary.constants';
import { normalizeSearchText } from './transcript-parsing.utils';

const MAX_RUN_CORRECTIONS = 24;
const MAX_SPEAKER_HINTS = 12;

export function buildInitialTranscriptionMemory(): TranscriptionMemory {
  return {
    canonicalTerms: COACHING_CANONICAL_TERMS,
    corrections: COACHING_COMMON_MISHEARINGS.map((entry) => ({
      raw: entry.raw,
      normalized: entry.normalized,
      confidence: 0.86,
      source: 'DOMAIN',
      reason: entry.reason,
    })),
    speakerHints: [],
    uncertainties: [],
  };
}

export function updateTranscriptionMemory(
  memory: TranscriptionMemory,
  result: TranscriptCleanerAgentResult,
): TranscriptionMemory {
  const corrections = [...memory.corrections];
  for (const turn of result.turns) {
    for (const normalization of turn.normalizations ?? []) {
      if (!isReliableNormalization(normalization)) continue;
      upsertCorrection(corrections, {
        raw: normalization.raw,
        normalized: normalization.normalized,
        confidence: normalization.confidence,
        source: 'RUN',
        reason: normalization.reason,
      });
    }
  }

  const speakerHints = [...memory.speakerHints];
  for (const turn of result.turns) {
    if (turn.speaker === 'UNKNOWN' || turn.confidence < 0.65) continue;
    const phrase = (turn.normalizedText ?? turn.text).slice(0, 120);
    const key = normalizeSearchText(`${turn.speaker}:${phrase}`);
    if (!key || speakerHints.some((hint) => normalizeSearchText(`${hint.speaker}:${hint.phrase}`) === key)) {
      continue;
    }
    speakerHints.push({
      speaker: turn.speaker,
      phrase,
      confidence: turn.confidence,
    });
  }

  return {
    canonicalTerms: memory.canonicalTerms,
    corrections: corrections
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, MAX_RUN_CORRECTIONS),
    speakerHints: speakerHints
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, MAX_SPEAKER_HINTS),
    uncertainties: dedupeStrings([
      ...memory.uncertainties,
      ...result.uncertainties,
    ]).slice(0, 12),
  };
}

export function renderTranscriptionMemoryPrompt(
  memory: TranscriptionMemory,
): string {
  return [
    'MÉMOIRE DE TRANSCRIPTION DU RUN',
    'Utilise cette mémoire pour stabiliser les corrections probables, sans inventer.',
    '',
    'Termes canoniques:',
    memory.canonicalTerms.slice(0, 32).join(', '),
    '',
    'Corrections fiables connues:',
    ...memory.corrections.slice(0, 18).map(
      (item) =>
        `- "${item.raw}" -> "${item.normalized}" confidence=${item.confidence} source=${item.source}`,
    ),
    '',
    'Indices locuteurs déjà vus:',
    ...memory.speakerHints.slice(0, 8).map(
      (hint) =>
        `- ${hint.speaker}: "${hint.phrase}" confidence=${hint.confidence}`,
    ),
    '',
    'Incertitudes à ne pas forcer:',
    ...memory.uncertainties.slice(0, 8).map((item) => `- ${item}`),
  ].join('\n');
}

export function summarizeTranscriptionMemory(memory: TranscriptionMemory): string {
  const runCorrections = memory.corrections.filter(
    (item) => item.source === 'RUN',
  ).length;
  const domainCorrections = memory.corrections.filter(
    (item) => item.source === 'DOMAIN',
  ).length;
  return [
    `domainCorrections=${domainCorrections}`,
    `runCorrections=${runCorrections}`,
    `speakerHints=${memory.speakerHints.length}`,
    `uncertainties=${memory.uncertainties.length}`,
  ].join(' ');
}

function isReliableNormalization(
  normalization: DialogueNormalizationPayload,
): boolean {
  return (
    !normalization.meaningChanged &&
    normalization.confidence >= 0.72 &&
    (normalization.type === 'DOMAIN_VOCABULARY' ||
      normalization.type === 'PHONETIC_CONTEXTUAL')
  );
}

function upsertCorrection(
  corrections: TranscriptionMemory['corrections'],
  correction: TranscriptionMemory['corrections'][number],
): void {
  const key = normalizeSearchText(correction.raw);
  const existing = corrections.find(
    (item) => normalizeSearchText(item.raw) === key,
  );
  if (!existing) {
    corrections.push(correction);
    return;
  }
  if (correction.confidence > existing.confidence) {
    existing.normalized = correction.normalized;
    existing.confidence = correction.confidence;
    existing.source = correction.source;
    existing.reason = correction.reason;
  }
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const key = normalizeSearchText(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}
