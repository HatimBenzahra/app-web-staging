export const resolveMaxTranscriptPromptChars = (): number => {
  const raw = Number(process.env.COACHING_MAX_TRANSCRIPT_PROMPT_CHARS);
  if (!Number.isFinite(raw) || raw < 5_000) {
    return 60_000;
  }
  return raw;
};

export const resolveQueueConcurrency = (): number => {
  const raw = Number(process.env.COACHING_ANALYSIS_CONCURRENCY);
  if (!Number.isFinite(raw)) {
    return 1;
  }
  return Math.max(1, Math.min(5, Math.floor(raw)));
};

export const resolveQueuePollMs = (): number => {
  const raw = Number(process.env.COACHING_QUEUE_POLL_MS);
  if (!Number.isFinite(raw)) {
    return 5_000;
  }
  return Math.max(2_000, Math.min(60_000, Math.floor(raw)));
};

export const resolveAutoQueueSpeechRetryMs = (): number => {
  const raw = Number(process.env.COACHING_AUTO_SPEECH_RETRY_MS);
  if (!Number.isFinite(raw)) {
    return 60_000;
  }
  return Math.max(10_000, Math.min(10 * 60_000, Math.floor(raw)));
};

export const resolveAutoQueueSpeechMaxAttempts = (): number => {
  const raw = Number(process.env.COACHING_AUTO_SPEECH_MAX_ATTEMPTS);
  if (!Number.isFinite(raw)) {
    return 8;
  }
  return Math.max(1, Math.min(30, Math.floor(raw)));
};

export const isAutoCoachingEnabled = (): boolean => {
  const raw = process.env.COACHING_AUTO_ANALYZE_ENABLED;
  if (!raw) {
    return true;
  }
  return !['0', 'false', 'no', 'off'].includes(raw.toLowerCase());
};

export const resolveMaxConversations = (): number => {
  const raw = Number(process.env.COACHING_MAX_CONVERSATIONS);
  if (!Number.isFinite(raw) || raw < 1) {
    return 12;
  }
  return Math.min(Math.floor(raw), 30);
};

export const resolveDetectChunkChars = (): number => {
  const raw = Number(process.env.COACHING_DETECT_CHUNK_CHARS);
  if (!Number.isFinite(raw)) {
    return 8000;
  }
  return Math.max(3000, Math.min(20000, Math.floor(raw)));
};

export const resolveConvClassifyEnabled = (): boolean => {
  const raw = process.env.COACHING_CONV_CLASSIFY_ENABLED;
  if (!raw) {
    return true;
  }
  return !['0', 'false', 'no', 'off'].includes(raw.toLowerCase());
};

export const resolveConvClassifyMaxTokens = (): number => {
  const raw = Number(process.env.COACHING_CONV_CLASSIFY_MAX_TOKENS);
  if (!Number.isFinite(raw)) {
    return 300;
  }
  return Math.max(100, Math.min(800, Math.floor(raw)));
};

export const resolveEvaluationBatchSize = (): number => {
  const raw = Number(process.env.COACHING_EVAL_BATCH_SIZE);
  if (!Number.isFinite(raw)) {
    return 3;
  }
  return Math.max(1, Math.min(6, Math.floor(raw)));
};

export const resolveStuckJobThresholdMs = (): number => {
  const raw = Number(process.env.COACHING_STUCK_JOB_THRESHOLD_MS);
  if (!Number.isFinite(raw) || raw < 60_000) {
    return 15 * 60_000;
  }
  return Math.min(raw, 4 * 60 * 60_000);
};

