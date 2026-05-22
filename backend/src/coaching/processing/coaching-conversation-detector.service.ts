import { Injectable, Logger } from '@nestjs/common';
import { CoachingVllmClient } from '../infrastructure/coaching-vllm-client.service';
import {
  buildBlocksFromBoundaries,
  buildTranscriptText,
  splitSegmentsIntoChunks,
  splitTranscriptIntoConversations,
} from '../utils/conversation-blocks.utils';
import {
  estimatePromptCharsApprox,
  parseLlmJson,
} from '../utils/coaching-llm-helpers.utils';
import {
  DETECT_CHUNK_JSON_SCHEMA,
  DETECT_CHUNK_SYSTEM_PROMPT,
  buildDetectChunkUserPrompt,
} from '../utils/coaching-llm-prompts.constants';
import {
  resolveDetectChunkChars,
  resolveMaxConversations,
} from '../utils/coaching-env-resolvers.utils';
import { CoachingAnalysisJobService } from './coaching-analysis-job.service';
import type {
  CoachingConversationBlock,
  CoachingTranscriptPayload,
  ConversationDetectionSummary,
} from './coaching-engine.types';
import { isRecord } from './coaching-engine.types';

type ConversationBoundary = {
  startTime: number;
  endTime: number;
  type: 'prospect' | 'internal' | 'noise';
  reason: string;
};

type StreamState = {
  conversation_open: boolean;
  current_start_time: number | null;
  current_summary: string;
};

@Injectable()
export class CoachingConversationDetectorService {
  private readonly logger = new Logger(CoachingConversationDetectorService.name);
  private readonly contextWindowTokens = (() => {
    const raw = Number(process.env.VLLM_CONTEXT_WINDOW_TOKENS);
    return !Number.isFinite(raw) || raw < 2048 ? 24576 : Math.floor(raw);
  })();
  private readonly tokensPerCharEstimate = 1 / 3.5;
  private readonly contextSafetyMarginTokens = 500;

  constructor(
    private readonly vllmClient: CoachingVllmClient,
    private readonly jobs: CoachingAnalysisJobService,
  ) {}

  async ensureConversations(
    sessionId: number,
    transcript: CoachingTranscriptPayload,
    jobId?: number,
  ): Promise<ConversationDetectionSummary> {
    await this.jobs.updateAnalysisJobStep(
      jobId,
      'Stage 2 — Découpage en conversations',
    );

    if (transcript.source === 'RECORDING_CONVERSATION_SEGMENTS') {
      const canonical = this.buildCanonicalBlocks(transcript);
      if (canonical.length > 0) {
        return this.buildCanonicalSummary(sessionId, transcript, canonical);
      }
    }

    const boundaries = await this.detectWithLlm(transcript, jobId);
    const prospectBoundaries = boundaries.filter((b) => b.type === 'prospect');
    const detectedInternal = boundaries.filter((b) => b.type === 'internal').length;
    const detectedNoise = boundaries.filter((b) => b.type === 'noise').length;

    if (boundaries.length === 0) {
      const blocks = splitTranscriptIntoConversations(
        transcript.segments,
        resolveMaxConversations(),
      );
      this.logger.warn(
        `Session ${sessionId} — Stage 2: LLM détection indisponible, fallback heuristique`,
      );
      this.logger.log(
        `Session ${sessionId} — Stage 2: ${blocks.length} conversation(s) construite(s) (fallback heuristique)`,
      );
      return {
        blocks,
        semanticDetectionUsed: false,
        detectedTotal: 0,
        detectedProspect: 0,
        detectedInternal,
        detectedNoise,
      };
    }

    const blocks = buildBlocksFromBoundaries(
      prospectBoundaries,
      transcript.segments,
      resolveMaxConversations(),
    );
    this.logger.log(
      `Session ${sessionId} — Stage 2: ${boundaries.length} bloc(s) détecté(s) (${prospectBoundaries.length} prospect, ${detectedInternal} internal, ${detectedNoise} noise) → ${blocks.length} conversation(s) à évaluer`,
    );
    return {
      blocks,
      semanticDetectionUsed: true,
      detectedTotal: boundaries.length,
      detectedProspect: prospectBoundaries.length,
      detectedInternal,
      detectedNoise,
    };
  }

  private buildCanonicalBlocks(
    transcript: CoachingTranscriptPayload,
  ): CoachingConversationBlock[] {
    return transcript.segments
      .filter((segment) => {
        const text = segment.text.trim();
        return text.length > 0 && segment.type !== 'INTERNAL' && segment.type !== 'NOISE';
      })
      .slice(0, resolveMaxConversations())
      .map((segment, index) => ({
        ordre: index + 1,
        title: `Conversation ${index + 1}`,
        startTime: segment.start,
        endTime: segment.end,
        transcriptText: this.resolveCanonicalTranscriptText(segment),
        sourceTranscriptSegments: segment.sourceTranscriptSegments ?? [
          { start: segment.start, end: segment.end, text: segment.text.trim() },
        ],
        words: segment.words ?? [],
        segmentsCount: segment.sourceTranscriptSegments?.length ?? 1,
        status:
          segment.type === 'UNKNOWN' || (segment.confidence ?? 1) < 0.7
            ? 'NEEDS_REVIEW'
            : 'COMPLETED',
        reviewReason: this.resolveCanonicalReviewReason(
          segment.type,
          segment.confidence,
        ),
        segmentType: segment.type,
        segmentSource: segment.source ?? null,
        segmentConfidence: segment.confidence ?? null,
        segmentStatut: segment.statut ?? null,
        speechScore: segment.speechScore ?? null,
      }));
  }

  private resolveCanonicalTranscriptText(
    segment: CoachingTranscriptPayload['segments'][number],
  ): string {
    if (segment.sourceTranscriptSegments?.length) {
      return buildTranscriptText(segment.sourceTranscriptSegments);
    }
    return buildTranscriptText([
      { start: segment.start, end: segment.end, text: segment.text.trim() },
    ]);
  }

  private resolveCanonicalReviewReason(
    type: string | undefined,
    confidence: number | undefined,
  ): string | null {
    if (type === 'UNKNOWN') {
      return 'Segment canonique non classifié, revue recommandée.';
    }
    if ((confidence ?? 1) < 0.7) {
      return 'Segment canonique à faible confiance.';
    }
    return null;
  }

  private buildCanonicalSummary(
    sessionId: number,
    transcript: CoachingTranscriptPayload,
    blocks: CoachingConversationBlock[],
  ): ConversationDetectionSummary {
    const detectedInternal = transcript.segments.filter((s) => s.type === 'INTERNAL').length;
    const detectedNoise = transcript.segments.filter((s) => s.type === 'NOISE').length;
    const detectedProspect = transcript.segments.filter(
      (s) => s.type === 'PROSPECT' || s.type === 'UNKNOWN',
    ).length;
    this.logger.log(
      `Session ${sessionId} — Stage 2: ${blocks.length} conversation(s) depuis segmentation canonique (${detectedProspect} prospect/unknown, ${detectedInternal} internal, ${detectedNoise} noise)`,
    );
    return {
      blocks,
      semanticDetectionUsed: false,
      detectedTotal: transcript.segments.length,
      detectedProspect,
      detectedInternal,
      detectedNoise,
    };
  }

  private async detectWithLlm(
    transcript: CoachingTranscriptPayload,
    jobId?: number,
  ): Promise<ConversationBoundary[]> {
    if (!this.vllmClient.isConfigured()) {
      this.logger.warn(
        'vLLM non configuré, détection sémantique des conversations désactivée',
      );
      return [];
    }

    const segments = transcript.segments
      .map((s) => ({ ...s, text: s.text.trim() }))
      .filter((s) => s.text.length > 0)
      .sort((a, b) => a.start - b.start);
    if (segments.length === 0) {
      return [];
    }

    const chunks = splitSegmentsIntoChunks(segments, this.resolveChunkBudgetChars());
    if (chunks.length === 0) {
      return [];
    }

    const closed: ConversationBoundary[] = [];
    let state: StreamState = {
      conversation_open: false,
      current_start_time: null,
      current_summary: '',
    };
    let failedChunks = 0;

    for (let i = 0; i < chunks.length; i += 1) {
      await this.jobs.updateAnalysisJobStep(
        jobId,
        `Détection conversations ${i + 1}/${chunks.length}`,
      );
      const result = await this.detectChunk(chunks[i], state, i === chunks.length - 1);
      if (!result) {
        failedChunks += 1;
        state = { conversation_open: false, current_start_time: null, current_summary: '' };
        continue;
      }
      closed.push(...result.closed_conversations);
      state = result.state;
    }

    this.closeOpenConversation(closed, state, segments);
    if (failedChunks === chunks.length) {
      this.logger.warn(
        `Détection sémantique totalement échouée (${failedChunks}/${chunks.length} chunks)`,
      );
      return [];
    }
    this.logger.log(
      `Détection sémantique terminée: ${closed.length} conversations sur ${chunks.length} chunks (${failedChunks} chunk(s) en échec)`,
    );
    return closed;
  }

  private resolveChunkBudgetChars(): number {
    const budgetTokens =
      this.contextWindowTokens - 1500 - 1800 - this.contextSafetyMarginTokens;
    const budgetChars = Math.floor(budgetTokens / this.tokensPerCharEstimate);
    return Math.max(4000, Math.min(resolveDetectChunkChars(), budgetChars));
  }

  private async detectChunk(
    chunkSegments: Array<{ start: number; end: number; text: string }>,
    state: StreamState,
    isLastChunk: boolean,
  ): Promise<{ closed_conversations: ConversationBoundary[]; state: StreamState } | null> {
    const messages = [
      { role: 'system', content: DETECT_CHUNK_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildDetectChunkUserPrompt(
          JSON.stringify(state, null, 2),
          buildTranscriptText(chunkSegments),
          isLastChunk,
        ),
      },
    ];
    const promptTokens = Math.ceil(
      estimatePromptCharsApprox(messages) * this.tokensPerCharEstimate,
    );
    const availableForOutput =
      this.contextWindowTokens - promptTokens - this.contextSafetyMarginTokens;
    if (availableForOutput < 800) {
      this.logger.warn(
        `detect_conversations: prompt trop long (${promptTokens} tokens), skip chunk`,
      );
      return null;
    }

    const result = await this.vllmClient.chat(
      {
        model: this.vllmClient.model,
        temperature: 0.1,
        max_tokens: Math.max(800, Math.min(2000, availableForOutput)),
        messages,
        response_format: { type: 'json_schema', json_schema: DETECT_CHUNK_JSON_SCHEMA },
      },
      { step: 'detect_conversations' },
    );
    if (!result) {
      return null;
    }

    const parsed = parseLlmJson(result.content);
    if (!isRecord(parsed)) {
      this.logger.warn('detect_conversations: JSON mal formé, chunk skippé');
      return null;
    }
    return {
      closed_conversations: this.normalizeClosedConversations(parsed.closed_conversations),
      state: this.normalizeState(parsed.state),
    };
  }

  private normalizeClosedConversations(value: unknown): ConversationBoundary[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((candidate) => this.normalizeClosedConversation(candidate))
      .filter((item): item is ConversationBoundary => Boolean(item));
  }

  private normalizeClosedConversation(value: unknown): ConversationBoundary | null {
    const record = isRecord(value) ? value : {};
    const start = Number(record.startTime);
    const end = Number(record.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      return null;
    }
    const typeRaw = String(record.type ?? '').toLowerCase();
    const type =
      typeRaw === 'prospect' ? 'prospect' : typeRaw === 'internal' ? 'internal' : 'noise';
    const reason =
      typeof record.reason === 'string' ? record.reason.slice(0, 300) : '';
    return { startTime: start, endTime: end, type, reason };
  }

  private normalizeState(value: unknown): StreamState {
    const record = isRecord(value) ? value : {};
    return {
      conversation_open: Boolean(record.conversation_open),
      current_start_time: Number.isFinite(Number(record.current_start_time))
        ? Number(record.current_start_time)
        : null,
      current_summary:
        typeof record.current_summary === 'string'
          ? record.current_summary.slice(0, 300)
          : '',
    };
  }

  private closeOpenConversation(
    closed: ConversationBoundary[],
    state: StreamState,
    segments: Array<{ end: number }>,
  ): void {
    if (!state.conversation_open || state.current_start_time === null) {
      return;
    }
    const lastTimestamp = segments[segments.length - 1]?.end ?? state.current_start_time;
    closed.push({
      startTime: state.current_start_time,
      endTime: Math.max(lastTimestamp, state.current_start_time),
      type: 'prospect',
      reason: 'Conversation ouverte en fin de transcript (fermeture auto)',
    });
  }
}
