/**
 * Parsing utilities for timestamp-formatted transcripts.
 * Pure functions, no DI.
 */

export type TranscriptSegment = { start: number; end: number; text: string };

/** Parse "[mm:ss-mm:ss] text" lines into segments with absolute time in seconds. */
export function parseTimestampedTranscript(
  transcriptText: string,
): TranscriptSegment[] {
  return transcriptText
    .split('\n')
    .map((line) => {
      const match = line.match(
        /^\[(\d{1,3}):(\d{2})-(\d{1,3}):(\d{2})\]\s*(.*)$/,
      );
      if (!match) {
        return null;
      }
      const start = Number(match[1]) * 60 + Number(match[2]);
      const end = Number(match[3]) * 60 + Number(match[4]);
      const text = match[5]?.trim() ?? '';
      if (!Number.isFinite(start) || !Number.isFinite(end) || !text) {
        return null;
      }
      return { start, end, text };
    })
    .filter((segment): segment is TranscriptSegment => Boolean(segment));
}

/** Normalize for fuzzy text matching: lowercase, remove diacritics, only [a-z0-9]+. */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Locate a verbatim excerpt in a timestamped transcript and return its time range.
 * Returns null if no match (exact or by strong-word voting).
 */
export function resolveExcerptTimeRange(
  transcriptText: string,
  excerpt?: string | null,
): { start: number; end: number } | null {
  if (!excerpt) {
    return null;
  }
  const normalizedExcerpt = normalizeSearchText(excerpt);
  if (!normalizedExcerpt) {
    return null;
  }
  const segments = parseTimestampedTranscript(transcriptText);
  for (const segment of segments) {
    const normalizedSegment = normalizeSearchText(segment.text);
    if (
      normalizedSegment.includes(normalizedExcerpt) ||
      normalizedExcerpt.includes(normalizedSegment)
    ) {
      return { start: segment.start, end: segment.end };
    }
  }
  const strongestWords = normalizedExcerpt
    .split(' ')
    .filter((word) => word.length >= 4)
    .slice(0, 8);
  if (strongestWords.length === 0) {
    return null;
  }
  let bestMatch: { start: number; end: number; hits: number } | null = null;
  for (const segment of segments) {
    const normalizedSegment = normalizeSearchText(segment.text);
    const hits = strongestWords.filter((word) =>
      normalizedSegment.includes(word),
    ).length;
    if (hits > (bestMatch?.hits ?? 0)) {
      bestMatch = { start: segment.start, end: segment.end, hits };
    }
  }
  if (!bestMatch || bestMatch.hits < Math.min(2, strongestWords.length)) {
    return null;
  }
  return { start: bestMatch.start, end: bestMatch.end };
}

/** Pick the first line containing a keyword, or the first line if no keyword. */
export function extractBestVerbatim(
  transcriptText: string,
  keyword?: string,
): string | null {
  const lines = transcriptText.split('\n').filter(Boolean);
  if (!keyword) {
    return lines[0] || null;
  }
  const match = lines.find((line) =>
    line.toLowerCase().includes(keyword.toLowerCase()),
  );
  return match || lines[0] || null;
}
