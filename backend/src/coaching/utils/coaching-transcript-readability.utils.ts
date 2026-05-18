import { formatTimestamp } from './coaching-aggregation.utils';
import { parseTimestampedTranscript } from './transcript-parsing.utils';

export const cleanTranscriptNoiseForPrompt = (value: string): string =>
  value
    .replace(/(?:\.{2,}|…)+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

export const prepareTranscriptForReadabilityPrompt = (
  transcriptText: string,
): string => {
  const segments = parseTimestampedTranscript(transcriptText);
  if (segments.length === 0) {
    return cleanTranscriptNoiseForPrompt(transcriptText);
  }

  const grouped: Array<{ start: number; end: number; text: string }> = [];

  for (const segment of segments) {
    const text = cleanTranscriptNoiseForPrompt(segment.text);
    if (!text) {
      continue;
    }

    const previous = grouped[grouped.length - 1];
    const gap = previous ? segment.start - previous.end : Number.POSITIVE_INFINITY;
    const previousLooksOpen = previous ? !/[.!?]$/.test(previous.text.trim()) : false;
    const currentLooksLikeContinuation =
      /^[,;:)]/.test(text) || /^[a-zàâäéèêëîïôöùûüç]/.test(text);

    if (
      previous &&
      gap <= 3.5 &&
      (previousLooksOpen || currentLooksLikeContinuation || previous.text.length < 500)
    ) {
      previous.end = segment.end;
      previous.text = `${previous.text} ${text}`.replace(/\s+/g, ' ').trim();
      continue;
    }

    grouped.push({
      start: segment.start,
      end: segment.end,
      text,
    });
  }

  return grouped
    .map((group) => `[${formatTimestamp(group.start)}-${formatTimestamp(group.end)}] ${group.text}`)
    .join('\n');
};

