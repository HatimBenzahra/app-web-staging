import type {
  DialogueReconstructionPayload,
  DialogueTurnPayload,
  TranscriptionFinalizerStats,
} from '../types/coaching-dialogue.types';

const DUPLICATE_TURN_GAP_SEC = 6;
const HIDDEN_NON_CLIENT_MAX_SEC = 4;
const COMPACT_MARKER_TEXT = 'Passage hors échange client condensé.';

export function finalizeTranscriptionForUser(
  reconstruction: DialogueReconstructionPayload,
): DialogueReconstructionPayload {
  const repeatedText = compactRepeatedText(reconstruction.turns);
  const deduplicated = deduplicateTurns(repeatedText.turns);
  const compacted = compactNonClientTurns(deduplicated.turns);
  const turns = compacted.turns;
  const stats: TranscriptionFinalizerStats = {
    inputTurns: reconstruction.turns.length,
    outputTurns: turns.length,
    duplicatesRemoved: deduplicated.duplicatesRemoved,
    repeatedTextCompactions: repeatedText.compactions,
    nonClientCompacted: compacted.nonClientCompacted,
    hiddenTurns: compacted.hiddenTurns,
    compactMarkers: compacted.compactMarkers,
  };

  return {
    ...reconstruction,
    turns,
    prospectTurnCount: turns.filter((turn) => turn.speaker === 'PROSPECT').length,
    internalTurnCount: turns.filter((turn) => turn.speaker === 'INTERNAL').length,
    unknownTurnCount: turns.filter((turn) => turn.speaker === 'UNKNOWN').length,
    averageConfidence: computeAverageConfidence(turns),
    finalizerStats: stats,
  };
}

function compactRepeatedText(turns: DialogueTurnPayload[]): {
  turns: DialogueTurnPayload[];
  compactions: number;
} {
  let compactions = 0;
  const nextTurns = turns.map((turn) => {
    const compacted = removeAdjacentRepeatedSentences(turn.text);
    if (compacted === turn.text) return turn;
    compactions += 1;
    return {
      ...turn,
      text: compacted,
      normalizedText: compacted,
    };
  });
  return { turns: nextTurns, compactions };
}

function deduplicateTurns(turns: DialogueTurnPayload[]): {
  turns: DialogueTurnPayload[];
  duplicatesRemoved: number;
} {
  const output: DialogueTurnPayload[] = [];
  let duplicatesRemoved = 0;
  for (const turn of turns) {
    const previous = output[output.length - 1];
    if (previous && isDuplicateTurn(previous, turn)) {
      duplicatesRemoved += 1;
      output[output.length - 1] = keepBestDuplicate(previous, turn);
      continue;
    }
    output.push({ ...turn });
  }
  return { turns: output, duplicatesRemoved };
}

function compactNonClientTurns(turns: DialogueTurnPayload[]): {
  turns: DialogueTurnPayload[];
  nonClientCompacted: number;
  hiddenTurns: number;
  compactMarkers: number;
} {
  const output: DialogueTurnPayload[] = [];
  let buffer: DialogueTurnPayload[] = [];
  let nonClientCompacted = 0;
  let hiddenTurns = 0;
  let compactMarkers = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    const marker = buildCompactMarker(buffer);
    nonClientCompacted += buffer.length;
    hiddenTurns += buffer.length;
    if (marker) {
      output.push(marker);
      compactMarkers += 1;
    }
    buffer = [];
  };

  for (const turn of turns) {
    if (isUserConversationTurn(turn)) {
      flush();
      output.push(cleanUserVisibleTurn(turn));
      continue;
    }
    buffer.push(turn);
  }
  flush();
  return { turns: output, nonClientCompacted, hiddenTurns, compactMarkers };
}

function isUserConversationTurn(turn: DialogueTurnPayload): boolean {
  if (turn.displayable === false) return false;
  if (turn.blockType && turn.blockType !== 'PROSPECT_INTERACTION') return false;
  return turn.speaker === 'COMMERCIAL' || turn.speaker === 'PROSPECT';
}

function cleanUserVisibleTurn(turn: DialogueTurnPayload): DialogueTurnPayload {
  return {
    ...turn,
    exclusionReason: null,
  };
}

function buildCompactMarker(turns: DialogueTurnPayload[]): DialogueTurnPayload | null {
  const duration = computeDuration(turns);
  if (turns.length === 1 && duration !== null && duration <= HIDDEN_NON_CLIENT_MAX_SEC) {
    return null;
  }
  const startTime = firstKnownTime(turns, 'startTime');
  const endTime = lastKnownTime(turns, 'endTime');
  const confidence = computeAverageConfidence(turns);
  return {
    speaker: 'UNKNOWN',
    startTime,
    endTime,
    text: COMPACT_MARKER_TEXT,
    rawText: joinSourceText(turns),
    normalizedText: COMPACT_MARKER_TEXT,
    sourceQuote: joinSourceText(turns),
    confidence,
    speakerConfidence: confidence,
    textConfidence: confidence,
    correctionLevel: 'NONE',
    normalizations: [],
    scorable: false,
    displayable: true,
    blockType: undefined,
    exclusionReason: null,
    reason: 'finalizer_compacted_non_client',
  };
}

function isDuplicateTurn(a: DialogueTurnPayload, b: DialogueTurnPayload): boolean {
  if (!areSpeakersCompatibleForDedup(a, b)) return false;
  if (!areTimesClose(a, b)) return false;
  const aKey = normalizeForDedup(a.text);
  const bKey = normalizeForDedup(b.text);
  if (!aKey || !bKey) return false;
  if (aKey === bKey) return true;
  const shorter = aKey.length <= bKey.length ? aKey : bKey;
  const longer = aKey.length > bKey.length ? aKey : bKey;
  return shorter.length >= 18 && longer.includes(shorter);
}

function keepBestDuplicate(
  previous: DialogueTurnPayload,
  current: DialogueTurnPayload,
): DialogueTurnPayload {
  const preferred =
    current.confidence > previous.confidence ||
    (current.confidence === previous.confidence && current.text.length > previous.text.length)
      ? current
      : previous;
  return {
    ...preferred,
    startTime: earliestTime(previous.startTime, current.startTime),
    endTime: latestTime(previous.endTime, current.endTime),
    sourceQuote: joinSourceText([previous, current]),
  };
}

function areSpeakersCompatibleForDedup(
  a: DialogueTurnPayload,
  b: DialogueTurnPayload,
): boolean {
  if (a.speaker === b.speaker) return true;
  return !isUserConversationTurn(a) && !isUserConversationTurn(b);
}

function areTimesClose(a: DialogueTurnPayload, b: DialogueTurnPayload): boolean {
  if (a.endTime === null || a.endTime === undefined) return true;
  if (b.startTime === null || b.startTime === undefined) return true;
  return b.startTime - a.endTime <= DUPLICATE_TURN_GAP_SEC;
}

function removeAdjacentRepeatedSentences(text: string): string {
  const sentences = text.match(/[^.!?…]+[.!?…]*/g) ?? [text];
  const output: string[] = [];
  for (const sentence of sentences) {
    const cleaned = sentence.trim();
    if (!cleaned) continue;
    const previous = output[output.length - 1];
    if (previous && normalizeForDedup(previous) === normalizeForDedup(cleaned)) {
      continue;
    }
    output.push(cleaned);
  }
  return output.join(' ').replace(/\s+/g, ' ').trim();
}

function normalizeForDedup(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function computeAverageConfidence(turns: DialogueTurnPayload[]): number {
  if (turns.length === 0) return 0;
  const sum = turns.reduce((total, turn) => total + turn.confidence, 0);
  return Number((sum / turns.length).toFixed(3));
}

function computeDuration(turns: DialogueTurnPayload[]): number | null {
  const start = firstKnownTime(turns, 'startTime');
  const end = lastKnownTime(turns, 'endTime');
  if (start === null || end === null) return null;
  return Math.max(0, end - start);
}

function firstKnownTime(
  turns: DialogueTurnPayload[],
  key: 'startTime' | 'endTime',
): number | null {
  for (const turn of turns) {
    const value = turn[key];
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

function lastKnownTime(
  turns: DialogueTurnPayload[],
  key: 'startTime' | 'endTime',
): number | null {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (!turn) continue;
    const value = turn[key];
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

function earliestTime(a?: number | null, b?: number | null): number | null {
  if (a === null || a === undefined) return b ?? null;
  if (b === null || b === undefined) return a;
  return Math.min(a, b);
}

function latestTime(a?: number | null, b?: number | null): number | null {
  if (a === null || a === undefined) return b ?? null;
  if (b === null || b === undefined) return a;
  return Math.max(a, b);
}

function joinSourceText(turns: DialogueTurnPayload[]): string {
  return turns
    .map((turn) => turn.sourceQuote || turn.rawText || turn.text)
    .filter((text): text is string => Boolean(text?.trim()))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
}
