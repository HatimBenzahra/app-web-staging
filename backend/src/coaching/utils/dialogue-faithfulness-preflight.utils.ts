import type { CleanTranscriptQuality } from '../types/coaching-dialogue.types';
import {
  normalizeSearchText,
  parseTimestampedTranscript,
} from './transcript-parsing.utils';

export type RawTranscriptPreflightMetrics = {
  rawChars: number;
  rawSegmentsCount: number;
  durationSec: number;
  charsPerMin: number;
  duplicateLineCount: number;
  timestampCoverage: number;
  qualityHint: CleanTranscriptQuality;
  reasons: string[];
};
export function analyzeRawTranscriptForCleaning(
  transcriptText: string,
  durationSec: number,
): RawTranscriptPreflightMetrics {
  const rawChars = transcriptText.length;
  const segments = parseTimestampedTranscript(transcriptText);
  const rawSegmentsCount = segments.length;
  const effectiveDuration = Math.max(1, durationSec);
  const charsPerMin = (rawChars / effectiveDuration) * 60;
  const duplicateLineCount = countDuplicateLines(
    segments.length > 0 ? segments.map((segment) => segment.text) : transcriptText.split('\n'),
  );
  const coveredDuration = segments.reduce(
    (sum, segment) => sum + Math.max(0, segment.end - segment.start),
    0,
  );
  const timestampCoverage = Math.max(
    0,
    Math.min(1, coveredDuration / effectiveDuration),
  );
  const reasons: string[] = [];
  if (charsPerMin < 45) reasons.push('low_text_density');
  if (duplicateLineCount > 0) reasons.push('duplicate_lines');
  if (timestampCoverage < 0.15) reasons.push('low_timestamp_coverage');
  const qualityHint: CleanTranscriptQuality =
    charsPerMin < 25
      ? 'BAD'
      : reasons.length > 0
        ? 'PARTIAL'
        : 'GOOD';

  return {
    rawChars,
    rawSegmentsCount,
    durationSec: Number(effectiveDuration.toFixed(2)),
    charsPerMin: Number(charsPerMin.toFixed(2)),
    duplicateLineCount,
    timestampCoverage: roundConfidence(timestampCoverage),
    qualityHint,
    reasons,
  };
}
function countDuplicateLines(lines: string[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const line of lines) {
    const key = normalizeSearchText(line);
    if (!key) continue;
    if (seen.has(key)) {
      duplicates += 1;
    }
    seen.add(key);
  }
  return duplicates;
}
function roundConfidence(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}
