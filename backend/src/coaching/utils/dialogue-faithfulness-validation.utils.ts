import type { CleanTranscriptQuality, DialogueReconstructionPayload, DialogueTurnPayload, NormalizationType } from '../types/coaching-dialogue.types';
import { normalizeSearchText } from './transcript-parsing.utils';
export type DialogueFaithfulnessMetrics = {
  cleanTranscriptQuality: CleanTranscriptQuality;
  averageTextConfidence: number;
  normalizationCount: number;
  riskyNormalizationCount: number;
  scorableProspectRatio: number;
  internalTurnCount: number;
  prospectTurnCount: number;
  unknownTurnCount: number;
  displayableTurns: number;
  scorableLaterTurns: number;
  metaNotesDetected: number;
  multiSpeakerTurnsDetected: number;
  inlineTimecodesDetected: number;
  decisionReasons: string[];
};
export type DialogueFaithfulnessResult = {
  reconstruction: DialogueReconstructionPayload;
  metrics: DialogueFaithfulnessMetrics;
};
const TRUSTED_NORMALIZATION_TYPES: NormalizationType[] = [
  'DOMAIN_VOCABULARY',
  'PHONETIC_CONTEXTUAL',
  'PUNCTUATION',
  'SEGMENTATION',
  'NONE',
];
const META_NOTE_REGEX = /(?:^|\s)\[?\s*note\s*:/i;
const SPEAKER_LABEL_REGEX =
  /(?:^|\s)(commercial|client|prospect|interlocuteur|interne|internal)\s*:/gi;
const INLINE_TIMECODE_REGEX =
  /\[\d{1,3}:\d{2}(?:\s*(?:→|-)\s*\d{1,3}:\d{2})?\]/;
export function validateDialogueFaithfulness(
  reconstruction: DialogueReconstructionPayload,
): DialogueFaithfulnessResult {
  const turns = reconstruction.turns.map(validateTurnFaithfulness);
  const prospectTurnCount = turns.filter((turn) => turn.speaker === 'PROSPECT').length;
  const internalTurnCount = turns.filter((turn) => turn.speaker === 'INTERNAL').length;
  const unknownTurnCount = turns.filter((turn) => turn.speaker === 'UNKNOWN').length;
  const scorableProspectCount = turns.filter(
    (turn) =>
      turn.scorable !== false &&
      (turn.speaker === 'COMMERCIAL' || turn.speaker === 'PROSPECT'),
  ).length;
  const conversationTurns = turns.filter(
    (turn) => turn.speaker === 'COMMERCIAL' || turn.speaker === 'PROSPECT',
  ).length;
  const textConfidenceSum = turns.reduce(
    (sum, turn) => sum + (turn.textConfidence ?? turn.confidence),
    0,
  );
  const normalizationCount = turns.reduce(
    (sum, turn) => sum + (turn.normalizations?.length ?? 0),
    0,
  );
  const riskyNormalizationCount = turns.reduce(
    (sum, turn) =>
      sum +
      (turn.normalizations?.filter(
        (normalization) =>
          normalization.meaningChanged ||
          normalization.confidence < 0.6 ||
          !TRUSTED_NORMALIZATION_TYPES.includes(normalization.type),
      ).length ?? 0),
    0,
  );
  const metaNotesDetected = turns.filter(hasMetaNote).length;
  const multiSpeakerTurnsDetected = turns.filter(hasInlineSpeakerLabel).length;
  const inlineTimecodesDetected = turns.filter(hasInlineTimecode).length;
  const displayableTurns = turns.filter((turn) => turn.displayable !== false).length;
  const scorableLaterTurns = turns.filter(
    (turn) =>
      turn.scorable !== false &&
      (turn.speaker === 'COMMERCIAL' || turn.speaker === 'PROSPECT'),
  ).length;
  const averageTextConfidence =
    turns.length === 0 ? 0 : textConfidenceSum / turns.length;
  const scorableProspectRatio =
    conversationTurns === 0 ? 0 : scorableProspectCount / conversationTurns;
  const cleanTranscriptQuality = resolveCleanTranscriptQuality({
    turnsCount: turns.length,
    averageTextConfidence,
    scorableProspectRatio,
    riskyNormalizationCount,
    metaNotesDetected,
    multiSpeakerTurnsDetected,
    inlineTimecodesDetected,
    internalTurnCount,
    unknownTurnCount,
    prospectTurnCount,
  });
  const decisionReasons = buildDecisionReasons({
    cleanTranscriptQuality,
    averageTextConfidence,
    scorableProspectRatio,
    scorableProspectCount,
    riskyNormalizationCount,
    metaNotesDetected,
    multiSpeakerTurnsDetected,
    inlineTimecodesDetected,
  });
  const usableForScoring =
    reconstruction.usableForScoring &&
    cleanTranscriptQuality !== 'BAD' &&
    scorableProspectRatio >= 0.45 &&
    averageTextConfidence >= 0.45 &&
    scorableProspectCount > 0;
  return {
    reconstruction: {
      ...reconstruction,
      turns,
      usableForScoring,
      scoreabilityReason: usableForScoring
        ? (reconstruction.scoreabilityReason ?? null)
        : buildScoreabilityReason(
            reconstruction.scoreabilityReason,
            averageTextConfidence,
            scorableProspectRatio,
            scorableProspectCount,
            cleanTranscriptQuality,
            decisionReasons,
          ),
      prospectTurnCount,
      internalTurnCount,
      unknownTurnCount,
      averageConfidence: roundConfidence(averageTextConfidence),
      uncertainties: [
        ...reconstruction.uncertainties,
        ...(riskyNormalizationCount > 0
          ? [`${riskyNormalizationCount} normalisation(s) à vérifier.`]
          : []),
        ...(cleanTranscriptQuality === 'BAD'
          ? ['Transcription finale non fiable pour scoring automatique.']
          : []),
      ],
    },
    metrics: {
      cleanTranscriptQuality,
      averageTextConfidence: roundConfidence(averageTextConfidence),
      normalizationCount,
      riskyNormalizationCount,
      scorableProspectRatio: roundConfidence(scorableProspectRatio),
      internalTurnCount,
      prospectTurnCount,
      unknownTurnCount,
      displayableTurns,
      scorableLaterTurns,
      metaNotesDetected,
      multiSpeakerTurnsDetected,
      inlineTimecodesDetected,
      decisionReasons,
    },
  };
}
function validateTurnFaithfulness(turn: DialogueTurnPayload): DialogueTurnPayload {
  const rawText = cleanText(turn.rawText) ?? cleanText(turn.sourceQuote) ?? turn.text;
  const normalizedText = cleanText(turn.normalizedText) ?? turn.text;
  const sourceQuote = cleanText(turn.sourceQuote) ?? rawText;
  const normalizations = turn.normalizations ?? [];
  const unsupportedExpansion = hasUnsupportedExpansion(
    rawText,
    normalizedText,
    normalizations,
  );
  const metaNote = hasMetaNote({
    ...turn,
    rawText,
    normalizedText,
    sourceQuote,
  });
  const inlineSpeakerLabel = hasInlineSpeakerLabel({
    ...turn,
    rawText,
    normalizedText,
    sourceQuote,
  });
  const inlineTimecode = hasInlineTimecode({
    ...turn,
    rawText,
    normalizedText,
    sourceQuote,
  });
  const riskyNormalization = normalizations.some(
    (normalization) =>
      normalization.meaningChanged ||
      normalization.confidence < 0.5 ||
      !TRUSTED_NORMALIZATION_TYPES.includes(normalization.type),
  );
  const shouldExclude =
    turn.speaker === 'INTERNAL' ||
    metaNote ||
    inlineSpeakerLabel ||
    inlineTimecode ||
    unsupportedExpansion ||
    riskyNormalization ||
    (turn.textConfidence ?? turn.confidence) < 0.35;
  return {
    ...turn,
    rawText,
    normalizedText,
    sourceQuote,
    text: normalizedText,
    normalizations,
    scorable: shouldExclude ? false : turn.scorable,
    displayable: metaNote ? false : (turn.displayable ?? true),
    exclusionReason: shouldExclude
      ? resolveExclusionReason({
          turn,
          metaNote,
          inlineSpeakerLabel,
          inlineTimecode,
          unsupportedExpansion,
          riskyNormalization,
        })
      : (turn.exclusionReason ?? null),
    correctionLevel:
      metaNote || inlineSpeakerLabel || inlineTimecode || unsupportedExpansion || riskyNormalization
        ? 'RISKY'
        : (turn.correctionLevel ?? 'NONE'),
  };
}
function hasUnsupportedExpansion(
  rawText: string,
  normalizedText: string,
  normalizations: NonNullable<DialogueTurnPayload['normalizations']>,
): boolean {
  const rawTokens = new Set(normalizeSearchText(rawText).split(' ').filter(Boolean));
  const normalizedTokens = normalizeSearchText(normalizedText)
    .split(' ')
    .filter((token) => token.length > 2);
  if (normalizedTokens.length <= 3) {
    return false;
  }
  const supportedTokens = new Set(
    normalizations.flatMap((normalization) =>
      normalizeSearchText(normalization.normalized)
        .split(' ')
        .filter(Boolean),
    ),
  );
  const added = normalizedTokens.filter(
    (token) => !rawTokens.has(token) && !supportedTokens.has(token),
  );
  return added.length / normalizedTokens.length > 0.35;
}
function resolveExclusionReason(input: {
  turn: DialogueTurnPayload;
  metaNote: boolean;
  inlineSpeakerLabel: boolean;
  inlineTimecode: boolean;
  unsupportedExpansion: boolean;
  riskyNormalization: boolean;
}): string {
  const {
    turn,
    metaNote,
    inlineSpeakerLabel,
    inlineTimecode,
    unsupportedExpansion,
    riskyNormalization,
  } = input;
  if (turn.speaker === 'INTERNAL') {
    return 'Échange interne entre commerciaux, exclu du scoring.';
  }
  if (metaNote) {
    return 'Note méta détectée dans la transcription finale.';
  }
  if (inlineSpeakerLabel) {
    return 'Plusieurs locuteurs détectés dans un même tour.';
  }
  if (inlineTimecode) {
    return 'Timecode inline détecté dans le texte du tour.';
  }
  if (unsupportedExpansion) {
    return 'Normalisation trop éloignée du transcript brut.';
  }
  if (riskyNormalization) {
    return 'Normalisation risquée ou trop incertaine.';
  }
  return 'Confiance transcript trop faible.';
}
function buildScoreabilityReason(
  existing: string | null | undefined,
  averageTextConfidence: number,
  scorableProspectRatio: number,
  scorableProspectCount: number,
  cleanTranscriptQuality: CleanTranscriptQuality,
  decisionReasons: string[],
): string {
  if (existing) {
    return existing;
  }
  if (cleanTranscriptQuality === 'BAD') {
    return `Transcription finale non fiable.${decisionReasons.length > 0 ? ` Raisons: ${decisionReasons.join(', ')}.` : ''}`;
  }
  if (scorableProspectCount === 0) {
    return 'Aucun tour prospect/commercial fiable à scorer.';
  }
  if (averageTextConfidence < 0.45) {
    return 'Confiance moyenne du dialogue trop faible.';
  }
  if (scorableProspectRatio < 0.45) {
    return 'Trop peu de tours prospect fiables par rapport au dialogue.';
  }
  return 'Dialogue non scorable automatiquement.';
}
function resolveCleanTranscriptQuality(input: {
  turnsCount: number;
  averageTextConfidence: number;
  scorableProspectRatio: number;
  riskyNormalizationCount: number;
  metaNotesDetected: number;
  multiSpeakerTurnsDetected: number;
  inlineTimecodesDetected: number;
  internalTurnCount: number;
  unknownTurnCount: number;
  prospectTurnCount: number;
}): CleanTranscriptQuality {
  if (input.turnsCount === 0) return 'BAD';
  const contaminated =
    input.metaNotesDetected +
    input.multiSpeakerTurnsDetected +
    input.inlineTimecodesDetected;
  const noisyTurns = input.internalTurnCount + input.unknownTurnCount;
  const noisyRatio = noisyTurns / input.turnsCount;
  if (
    contaminated > 0 ||
    input.averageTextConfidence < 0.35 ||
    input.scorableProspectRatio < 0.2
  ) {
    return 'BAD';
  }
  if (
    input.riskyNormalizationCount > 0 ||
    input.averageTextConfidence < 0.55 ||
    input.scorableProspectRatio < 0.55 ||
    noisyRatio > 0.45 ||
    input.prospectTurnCount === 0
  ) {
    return 'PARTIAL';
  }
  return 'GOOD';
}
function buildDecisionReasons(input: {
  cleanTranscriptQuality: CleanTranscriptQuality;
  averageTextConfidence: number;
  scorableProspectRatio: number;
  scorableProspectCount: number;
  riskyNormalizationCount: number;
  metaNotesDetected: number;
  multiSpeakerTurnsDetected: number;
  inlineTimecodesDetected: number;
}): string[] {
  const reasons: string[] = [];
  if (input.cleanTranscriptQuality === 'BAD') reasons.push('quality_bad');
  if (input.averageTextConfidence < 0.45) reasons.push('low_text_confidence');
  if (input.scorableProspectRatio < 0.45) reasons.push('low_scorable_ratio');
  if (input.scorableProspectCount === 0) reasons.push('no_scorable_turn');
  if (input.riskyNormalizationCount > 0) reasons.push('risky_corrections');
  if (input.metaNotesDetected > 0) reasons.push('meta_note_detected');
  if (input.multiSpeakerTurnsDetected > 0) reasons.push('multi_speaker_turn');
  if (input.inlineTimecodesDetected > 0) reasons.push('inline_timecode_detected');
  return reasons;
}
function hasMetaNote(turn: DialogueTurnPayload): boolean {
  return turnTextFields(turn).some((value) => META_NOTE_REGEX.test(value));
}
function hasInlineSpeakerLabel(turn: DialogueTurnPayload): boolean {
  return turnTextFields(turn).some((value) => {
    const matches = value.match(SPEAKER_LABEL_REGEX);
    return (matches?.length ?? 0) > 0;
  });
}
function hasInlineTimecode(turn: DialogueTurnPayload): boolean {
  return displayTextFields(turn).some((value) => INLINE_TIMECODE_REGEX.test(value));
}
function turnTextFields(turn: DialogueTurnPayload): string[] {
  return [turn.text, turn.rawText, turn.normalizedText, turn.sourceQuote].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
}
function displayTextFields(turn: DialogueTurnPayload): string[] {
  return [turn.text, turn.rawText, turn.normalizedText].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
}
function cleanText(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim()
    ? value.replace(/\s+/g, ' ').trim()
    : null;
}
function roundConfidence(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}
