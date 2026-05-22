import { normalizeSearchText } from './transcript-parsing.utils';

export type TranscriptWordTiming = {
  word: string;
  start: number;
  end: number;
  score?: number;
};

type WordToken = {
  token: string;
  wordIndex: number;
};

const DEFAULT_START_PADDING_SEC = 0.25;
const DEFAULT_END_PADDING_SEC = 0.35;

export function normalizeTranscriptWords(value: unknown): TranscriptWordTiming[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const word = typeof item.word === 'string' ? item.word.trim() : '';
      const start = Number(item.start);
      const end = Number(item.end);
      const score = Number(item.score);
      if (
        !word ||
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end <= start
      ) {
        return null;
      }
      return {
        word,
        start,
        end,
        ...(Number.isFinite(score) ? { score } : {}),
      };
    })
    .filter((word): word is TranscriptWordTiming => Boolean(word))
    .sort((a, b) => a.start - b.start);
}

export function resolveExcerptTimeRangeFromWords(
  words: TranscriptWordTiming[],
  excerpt?: string | null,
  options?: {
    startPaddingSec?: number;
    endPaddingSec?: number;
  },
): { start: number; end: number } | null {
  const excerptTokens = normalizeSearchText(excerpt ?? '')
    .split(' ')
    .filter(isMeaningfulToken);
  if (words.length === 0 || excerptTokens.length === 0) {
    return null;
  }

  const wordTokens = buildWordTokens(words);
  if (wordTokens.length === 0) {
    return null;
  }

  const exact = findExactTokenSequence(wordTokens, excerptTokens);
  if (exact) {
    return buildRange(words, exact.startWordIndex, exact.endWordIndex, options);
  }

  const fuzzy = findBestFuzzyWindow(wordTokens, excerptTokens);
  if (!fuzzy) {
    return null;
  }
  return buildRange(words, fuzzy.startWordIndex, fuzzy.endWordIndex, options);
}

function buildWordTokens(words: TranscriptWordTiming[]): WordToken[] {
  return words.flatMap((word, wordIndex) =>
    normalizeSearchText(word.word)
      .split(' ')
      .filter(isMeaningfulToken)
      .map((token) => ({ token, wordIndex })),
  );
}

function findExactTokenSequence(
  wordTokens: WordToken[],
  excerptTokens: string[],
): { startWordIndex: number; endWordIndex: number } | null {
  for (let start = 0; start <= wordTokens.length - excerptTokens.length; start++) {
    let matches = true;
    for (let offset = 0; offset < excerptTokens.length; offset++) {
      if (wordTokens[start + offset]?.token !== excerptTokens[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return {
        startWordIndex: wordTokens[start].wordIndex,
        endWordIndex: wordTokens[start + excerptTokens.length - 1].wordIndex,
      };
    }
  }
  return null;
}

function findBestFuzzyWindow(
  wordTokens: WordToken[],
  excerptTokens: string[],
): { startWordIndex: number; endWordIndex: number } | null {
  const targetLength = excerptTokens.length;
  const minWindow = Math.max(1, Math.floor(targetLength * 0.65));
  const maxWindow = Math.min(wordTokens.length, Math.ceil(targetLength * 1.45) + 2);
  let best: {
    startTokenIndex: number;
    endTokenIndex: number;
    orderedHits: number;
    uniqueHits: number;
  } | null = null;

  for (let start = 0; start < wordTokens.length; start++) {
    for (
      let length = minWindow;
      length <= maxWindow && start + length <= wordTokens.length;
      length++
    ) {
      const end = start + length - 1;
      const tokens = wordTokens.slice(start, end + 1).map((entry) => entry.token);
      const orderedHits = countOrderedHits(tokens, excerptTokens);
      const uniqueHits = countUniqueHits(tokens, excerptTokens);
      if (
        !best ||
        orderedHits > best.orderedHits ||
        (orderedHits === best.orderedHits && uniqueHits > best.uniqueHits)
      ) {
        best = {
          startTokenIndex: start,
          endTokenIndex: end,
          orderedHits,
          uniqueHits,
        };
      }
    }
  }

  if (!best) {
    return null;
  }

  const requiredHits =
    targetLength <= 2
      ? targetLength
      : Math.max(2, Math.ceil(targetLength * 0.58));
  if (best.orderedHits < requiredHits && best.uniqueHits < requiredHits) {
    return null;
  }

  return {
    startWordIndex: wordTokens[best.startTokenIndex].wordIndex,
    endWordIndex: wordTokens[best.endTokenIndex].wordIndex,
  };
}

function countOrderedHits(tokens: string[], excerptTokens: string[]): number {
  let hits = 0;
  let cursor = 0;
  for (const token of tokens) {
    if (token === excerptTokens[cursor]) {
      hits++;
      cursor++;
      if (cursor >= excerptTokens.length) {
        break;
      }
    }
  }
  return hits;
}

function countUniqueHits(tokens: string[], excerptTokens: string[]): number {
  const tokenSet = new Set(tokens);
  const excerptSet = new Set(excerptTokens);
  let hits = 0;
  for (const token of excerptSet) {
    if (tokenSet.has(token)) {
      hits++;
    }
  }
  return hits;
}

function buildRange(
  words: TranscriptWordTiming[],
  startWordIndex: number,
  endWordIndex: number,
  options?: {
    startPaddingSec?: number;
    endPaddingSec?: number;
  },
): { start: number; end: number } | null {
  const first = words[startWordIndex];
  const last = words[endWordIndex];
  if (!first || !last) {
    return null;
  }
  const startPadding = options?.startPaddingSec ?? DEFAULT_START_PADDING_SEC;
  const endPadding = options?.endPaddingSec ?? DEFAULT_END_PADDING_SEC;
  return {
    start: Number(Math.max(0, first.start - startPadding).toFixed(2)),
    end: Number(Math.max(first.start, last.end + endPadding).toFixed(2)),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMeaningfulToken(token: string): boolean {
  return token.length > 1;
}
