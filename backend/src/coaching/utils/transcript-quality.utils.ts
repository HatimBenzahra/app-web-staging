export type TranscriptQualityState = 'USABLE' | 'REVIEW' | 'NON_EVALUABLE';

export type TranscriptQualityMetrics = {
  state: TranscriptQualityState;
  reasons: string[];
  cleanedText: string;
  textLength: number;
  charsPerMin: number;
  duplicateRatio: number;
  suspiciousPhraseCount: number;
  avgSegmentChars: number | null;
};

const SUSPICIOUS_SHORT_PHRASES = [
  /^j['’]\s*ai\s+eclate[.!?]*$/i,
  /^j['’]\s*ai\s+éclaté[.!?]*$/i,
];

function normalizeForComparison(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function splitSentences(value: string): string[] {
  return value
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function cleanTranscriptForQuality(transcriptText: string): {
  cleanedText: string;
  duplicateRatio: number;
  suspiciousPhraseCount: number;
} {
  const sentences = splitSentences(transcriptText);
  if (sentences.length === 0) {
    return {
      cleanedText: '',
      duplicateRatio: 0,
      suspiciousPhraseCount: 0,
    };
  }

  const seen = new Set<string>();
  const kept: string[] = [];
  let duplicates = 0;
  let suspiciousPhraseCount = 0;

  for (const sentence of sentences) {
    const comparisonKey = normalizeForComparison(sentence);
    if (!comparisonKey) continue;

    const isSuspiciousShortPhrase =
      sentence.length <= 45 &&
      SUSPICIOUS_SHORT_PHRASES.some((pattern) => pattern.test(sentence));
    if (isSuspiciousShortPhrase) {
      suspiciousPhraseCount += 1;
      continue;
    }

    if (seen.has(comparisonKey)) {
      duplicates += 1;
      continue;
    }

    seen.add(comparisonKey);
    kept.push(sentence);
  }

  return {
    cleanedText: kept.join(' ').trim(),
    duplicateRatio: duplicates / Math.max(sentences.length, 1),
    suspiciousPhraseCount,
  };
}

export function computeTranscriptQuality(input: {
  transcriptText: string;
  durationSec: number;
  speechScore?: number | null;
  whisperSegmentCount?: number | null;
}): TranscriptQualityMetrics {
  const durationSec = Math.max(0.001, input.durationSec);
  const cleaned = cleanTranscriptForQuality(input.transcriptText);
  const textLength = cleaned.cleanedText.length;
  const charsPerMin = (textLength / durationSec) * 60;
  const avgSegmentChars =
    input.whisperSegmentCount && input.whisperSegmentCount > 0
      ? textLength / input.whisperSegmentCount
      : null;
  const reasons: string[] = [];

  if (textLength === 0) {
    reasons.push('Transcript vide ou nettoyé intégralement.');
  }
  if (input.speechScore != null && input.speechScore < 30) {
    reasons.push('Score de parole très faible (< 30%).');
  } else if (input.speechScore != null && input.speechScore < 35) {
    reasons.push('Score de parole faible (< 35%).');
  }
  if (durationSec >= 60 && charsPerMin < 60) {
    reasons.push('Densité de transcription trop faible (< 60 caractères/min).');
  } else if (durationSec >= 30 && charsPerMin < 90) {
    reasons.push('Densité de transcription faible.');
  }
  if (textLength < 80) {
    reasons.push('Transcript trop court pour une évaluation complète.');
  }
  if (cleaned.duplicateRatio >= 0.35) {
    reasons.push('Transcript trop répétitif.');
  } else if (cleaned.duplicateRatio >= 0.2) {
    reasons.push('Répétitions détectées dans le transcript.');
  }
  if (cleaned.suspiciousPhraseCount > 0) {
    reasons.push('Hallucination courte isolée supprimée.');
  }

  const nonEvaluable =
    textLength === 0 ||
    (durationSec >= 60 && charsPerMin < 60) ||
    (input.speechScore != null && input.speechScore < 30 && charsPerMin < 90) ||
    cleaned.duplicateRatio >= 0.35;

  return {
    state: nonEvaluable ? 'NON_EVALUABLE' : reasons.length > 0 ? 'REVIEW' : 'USABLE',
    reasons,
    cleanedText: cleaned.cleanedText,
    textLength,
    charsPerMin,
    duplicateRatio: cleaned.duplicateRatio,
    suspiciousPhraseCount: cleaned.suspiciousPhraseCount,
    avgSegmentChars,
  };
}
