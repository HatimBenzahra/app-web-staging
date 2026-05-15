export type RecordingExploitabilityStatus =
  | 'PRIORITY'
  | 'GOOD'
  | 'LOW_VALUE'
  | 'ALREADY_ANALYZED'
  | 'REVIEW';

export type RecordingExploitabilityInput = {
  item: {
    commercialId?: number;
    lastModified?: Date;
    size?: number;
  };
  speechScore?: {
    score?: number;
    totalDurationSec?: number;
    speechDurationSec?: number;
    status: string;
  };
  latestSessionStatus?: string | null;
};

export function scoreRecordingExploitability(input: RecordingExploitabilityInput): {
  score: number;
  status: RecordingExploitabilityStatus;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (input.latestSessionStatus === 'COMPLETED') {
    return {
      score: 35,
      status: 'ALREADY_ANALYZED',
      reasons: ['Analyse coaching déjà terminée'],
    };
  }

  const speech = input.speechScore;
  let speechScore = 0;
  let speechReady = false;

  if (speech?.status === 'ready' && typeof speech.score === 'number') {
    speechReady = true;
    speechScore = Math.max(0, Math.min(100, Math.round(speech.score)));
    reasons.push(`Parole détectée ${speechScore}%`);

    if (typeof speech.speechDurationSec === 'number') {
      reasons.push(`Durée de parole ${formatDurationReason(speech.speechDurationSec)}`);
    }
  } else if (speech?.status === 'analyzing') {
    return {
      score: 45,
      status: 'REVIEW',
      reasons: ['Score parole en cours'],
    };
  } else {
    return {
      score: 30,
      status: 'LOW_VALUE',
      reasons: ['Score parole absent'],
    };
  }

  const speechDuration = speech?.speechDurationSec ?? 0;
  const totalDuration = speech?.totalDurationSec ?? 0;
  const hasEnoughSpeechDuration = speechDuration >= 180;
  const hasUsableSpeechDuration = speechDuration >= 90;

  let score = Math.round(speechScore * 0.85);
  score += hasEnoughSpeechDuration ? 15 : hasUsableSpeechDuration ? 8 : 0;

  if (!hasUsableSpeechDuration) {
    reasons.push('Parole insuffisante pour une analyse fiable');
  }

  if (totalDuration > 0 && totalDuration < 60) {
    score = Math.min(score, 35);
    reasons.push('Audio trop court');
  }

  if (
    input.latestSessionStatus === 'FAILED' ||
    input.latestSessionStatus === 'NEEDS_REVIEW'
  ) {
    score = Math.max(score, 65);
    reasons.push('Analyse précédente à revoir');
  }

  if (
    input.latestSessionStatus === 'PENDING' ||
    input.latestSessionStatus === 'PROCESSING'
  ) {
    score = Math.max(score, 60);
    reasons.push('Analyse déjà en file ou en cours');
  }

  if (input.item.commercialId) {
    reasons.push('Commercial identifié');
  } else {
    reasons.push('Commercial non identifié');
  }

  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));

  if (
    input.latestSessionStatus === 'FAILED' ||
    input.latestSessionStatus === 'NEEDS_REVIEW' ||
    input.latestSessionStatus === 'PENDING' ||
    input.latestSessionStatus === 'PROCESSING'
  ) {
    return {
      score: normalizedScore,
      status: 'REVIEW',
      reasons,
    };
  }

  if (speechReady && speechScore >= 65 && hasEnoughSpeechDuration) {
    return { score: normalizedScore, status: 'PRIORITY', reasons };
  }
  if (speechReady && speechScore >= 45 && hasUsableSpeechDuration) {
    return { score: normalizedScore, status: 'GOOD', reasons };
  }
  return { score: normalizedScore, status: 'LOW_VALUE', reasons };
}

export function isAutoAnalysisEligible(status: RecordingExploitabilityStatus): boolean {
  return status === 'PRIORITY' || status === 'GOOD';
}

function formatDurationReason(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return 'n/a';
  }
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (minutes <= 0) {
    return `${rest}s`;
  }
  return `${minutes}m${String(rest).padStart(2, '0')}s`;
}
