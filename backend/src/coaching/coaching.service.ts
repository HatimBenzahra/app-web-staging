import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { CoachingSessionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  TranscriptionService,
  WhisperSegment,
} from '../transcription/transcription.service';
import {
  CoachingSalesPlanDto,
  CoachingSessionDto,
  LaunchCoachingAnalysisInput,
  ListCoachingSessionsInput,
  PaginatedCoachingSessionsResult,
} from './coaching.dto';

type CurrentUser = {
  id: number | string;
  role: string;
};

type SegmentForCoaching = {
  id?: number;
  orderIndex: number;
  porteId?: number;
  porteNumero?: string;
  immeubleAdresse?: string;
  statut?: string;
  startTime: number;
  endTime: number;
  durationSec: number;
  speechScore?: number;
  transcription: string;
};

type SourceContext = {
  recordingId?: number;
  s3KeyOriginal: string;
  commercialId?: number;
  managerId?: number;
  directeurId?: number;
  segments: SegmentForCoaching[];
};

type AiConversationEvaluation = {
  orderIndex?: number;
  segmentId?: number;
  title?: string;
  score?: number;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  recommendations?: string[];
  readableTranscriptText?: string;
};

type AiEvaluation = {
  score?: number;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  recommendations?: string[];
  conversations?: AiConversationEvaluation[];
};

const DEFAULT_CRITERIA = [
  'Accroche claire et professionnelle au début de l’échange',
  'Découverte du besoin client avant argumentaire',
  'Argumentation adaptée au statut de la porte et aux objections',
  'Gestion des refus sans insistance excessive',
  'Clôture concrète: rendez-vous, repassage ou prochaine action',
  'Qualité d’écoute et temps de parole équilibré',
];

const DEFAULT_PROMPT = [
  'Tu es un coach de vente porte-a-porte pour Pro Win.',
  'Analyse uniquement les transcripts fournis, sans inventer de faits.',
  'Retourne un JSON strict avec: score, summary, strengths, improvements, recommendations, conversations.',
  'Les scores sont des entiers de 0 à 100.',
  'Les listes strengths, improvements et recommendations contiennent des phrases courtes en français.',
].join('\n');

@Injectable()
export class CoachingService {
  private readonly logger = new Logger(CoachingService.name);

  private readonly vllmBaseUrl = process.env.VLLM_BASE_URL;
  private readonly vllmApiKey = process.env.VLLM_API_KEY;
  private readonly vllmModel = process.env.VLLM_MODEL || 'qwen35-35b-a3b';
  private readonly vllmTimeoutMs = this.resolvePositiveInt(
    process.env.VLLM_TIMEOUT_MS,
    180_000,
  );
  private readonly maxTranscriptPromptChars = this.resolvePositiveInt(
    process.env.COACHING_MAX_TRANSCRIPT_PROMPT_CHARS,
    60_000,
  );
  private readonly maxConversations = this.resolvePositiveInt(
    process.env.COACHING_MAX_CONVERSATIONS,
    12,
  );

  constructor(
    private prisma: PrismaService,
    private transcriptionService: TranscriptionService,
  ) {}

  async activeCoachingSalesPlan(): Promise<CoachingSalesPlanDto> {
    const version = await this.ensureActiveSalesPlanVersion();
    return this.mapSalesPlan(version.salesPlan, version);
  }

  async listSessions(
    input: ListCoachingSessionsInput,
    user: CurrentUser,
  ): Promise<PaginatedCoachingSessionsResult> {
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 100);
    const offset = Math.max(input.offset ?? 0, 0);
    const where = this.sessionScopeWhere(user);

    const [items, totalCount] = await Promise.all([
      this.prisma.coachingSession.findMany({
        where,
        include: this.sessionInclude(false),
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.coachingSession.count({ where }),
    ]);

    return {
      items: items.map((session) => this.mapSession(session)),
      totalCount,
    };
  }

  async getSession(id: number, user: CurrentUser): Promise<CoachingSessionDto> {
    const session = await this.findSessionOrThrow(id, user, true);
    return this.mapSession(session);
  }

  async launchCoachingAnalysis(
    input: LaunchCoachingAnalysisInput,
    user: CurrentUser,
  ): Promise<CoachingSessionDto> {
    const source = await this.resolveSourceContext(input.s3KeyOriginal, user);
    const salesPlanVersion = input.salesPlanVersionId
      ? await this.getSalesPlanVersion(input.salesPlanVersionId)
      : await this.ensureActiveSalesPlanVersion();

    const existing = await this.prisma.coachingSession.findUnique({
      where: {
        s3KeyOriginal_salesPlanVersionId: {
          s3KeyOriginal: source.s3KeyOriginal,
          salesPlanVersionId: salesPlanVersion.id,
        },
      },
      include: this.sessionInclude(true),
    });

    if (existing) {
      await this.ensureSessionAccess(existing, user);
      return this.mapSession(existing);
    }

    const session = await this.prisma.coachingSession.create({
      data: {
        recordingId: source.recordingId ?? null,
        s3KeyOriginal: source.s3KeyOriginal,
        salesPlanVersionId: salesPlanVersion.id,
        status: CoachingSessionStatus.ANALYZING,
        launchedById: Number(user.id),
        launchedByRole: user.role,
        commercialId: source.commercialId ?? null,
        managerId: source.managerId ?? null,
        directeurId: source.directeurId ?? null,
      },
    });

    return this.processSession(session.id, source, salesPlanVersion);
  }

  async relaunchCoachingAnalysis(
    sessionId: number,
    user: CurrentUser,
  ): Promise<CoachingSessionDto> {
    const session = await this.findSessionOrThrow(sessionId, user, false);
    const source = await this.resolveSourceContext(session.s3KeyOriginal, user);
    const salesPlanVersion = await this.getSalesPlanVersion(
      session.salesPlanVersionId,
    );

    await this.prisma.coachingConversationEvaluation.deleteMany({
      where: { sessionId },
    });
    await this.prisma.coachingSession.update({
      where: { id: sessionId },
      data: {
        status: CoachingSessionStatus.ANALYZING,
        score: null,
        summary: null,
        strengths: Prisma.JsonNull,
        improvements: Prisma.JsonNull,
        recommendations: Prisma.JsonNull,
        error: null,
        analyzedAt: null,
      },
    });

    return this.processSession(sessionId, source, salesPlanVersion);
  }

  private async processSession(
    sessionId: number,
    source: SourceContext,
    salesPlanVersion: any,
  ): Promise<CoachingSessionDto> {
    try {
      if (source.segments.length === 0) {
        throw new Error(
          'Whisper n’a produit aucun transcript exploitable pour cet enregistrement.',
        );
      }

      const evaluation = await this.requestAiEvaluation(
        source,
        salesPlanVersion,
      );

      await this.prisma.coachingConversationEvaluation.createMany({
        data: this.buildConversationRows(sessionId, source, evaluation),
      });

      const updated = await this.prisma.coachingSession.update({
        where: { id: sessionId },
        data: {
          status: CoachingSessionStatus.READY,
          score: this.clampScore(evaluation.score),
          summary: evaluation.summary ?? 'Analyse coaching terminée.',
          strengths: this.toJsonArray(evaluation.strengths),
          improvements: this.toJsonArray(evaluation.improvements),
          recommendations: this.toJsonArray(evaluation.recommendations),
          error: null,
          analyzedAt: new Date(),
        },
        include: this.sessionInclude(true),
      });

      return this.mapSession(updated);
    } catch (error) {
      const message = error?.message || 'Analyse coaching impossible.';
      this.logger.warn(`coachingAnalysis failed session=${sessionId}: ${message}`);

      const failed = await this.prisma.coachingSession.update({
        where: { id: sessionId },
        data: {
          status: CoachingSessionStatus.FAILED,
          error: message,
          analyzedAt: new Date(),
        },
        include: this.sessionInclude(true),
      });

      return this.mapSession(failed);
    }
  }

  private async requestAiEvaluation(
    source: SourceContext,
    salesPlanVersion: any,
  ): Promise<AiEvaluation> {
    if (!this.vllmBaseUrl) {
      throw new Error(
        'Configuration vLLM manquante: VLLM_BASE_URL est requis.',
      );
    }

    const criteria = this.jsonToStringArray(salesPlanVersion.criteria);
    const transcript = this.truncatePromptText(source.segments
      .map((segment) =>
        [
          `Segment ${segment.orderIndex + 1}`,
          typeof segment.id === 'number' ? `segmentId=${segment.id}` : null,
          segment.statut ? `statut=${segment.statut}` : null,
          segment.porteNumero ? `porte=${segment.porteNumero}` : null,
          `transcript=${segment.transcription}`,
        ]
          .filter(Boolean)
          .join(' | '),
      )
      .join('\n\n'));

    const response = await axios.post(
      this.getVllmChatCompletionsUrl(),
      {
        model: this.vllmModel,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: salesPlanVersion.prompt || DEFAULT_PROMPT,
          },
          {
            role: 'user',
            content: JSON.stringify({
              language: 'fr',
              criteria,
              expectedJsonShape: {
                score: 0,
                summary: 'string',
                strengths: ['string'],
                improvements: ['string'],
                recommendations: ['string'],
                conversations: [
                  {
                    orderIndex: 0,
                    segmentId: 0,
                    title: 'string',
                    score: 0,
                    summary: 'string',
                    strengths: ['string'],
                    improvements: ['string'],
                    recommendations: ['string'],
                    readableTranscriptText: 'string',
                  },
                ],
              },
              transcript,
            }),
          },
        ],
      },
      {
        timeout: this.vllmTimeoutMs,
        headers: this.buildVllmHeaders(),
      },
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error('Réponse IA vide ou invalide.');
    }

    return this.parseAiJson(content);
  }

  private buildConversationRows(
    sessionId: number,
    source: SourceContext,
    evaluation: AiEvaluation,
  ) {
    const bySegmentId = new Map<number, AiConversationEvaluation>();
    const byOrderIndex = new Map<number, AiConversationEvaluation>();

    for (const conversation of evaluation.conversations ?? []) {
      if (typeof conversation.segmentId === 'number') {
        bySegmentId.set(conversation.segmentId, conversation);
      }
      if (typeof conversation.orderIndex === 'number') {
        byOrderIndex.set(conversation.orderIndex, conversation);
      }
    }

    return source.segments.map((segment) => {
      const ai =
        (typeof segment.id === 'number' ? bySegmentId.get(segment.id) : undefined) ??
        byOrderIndex.get(segment.orderIndex) ??
        {};

      return {
        sessionId,
        segmentId: segment.id ?? null,
        orderIndex: segment.orderIndex,
        title: ai.title ?? `Moment ${segment.orderIndex + 1}`,
        status: CoachingSessionStatus.READY,
        score: this.clampScore(ai.score),
        summary: ai.summary ?? undefined,
        strengths: this.toJsonArray(ai.strengths),
        improvements: this.toJsonArray(ai.improvements),
        recommendations: this.toJsonArray(ai.recommendations),
        transcriptText: segment.transcription,
        readableTranscriptText: ai.readableTranscriptText ?? segment.transcription,
        startTime: segment.startTime,
        endTime: segment.endTime,
        durationSec: segment.durationSec,
        statut: segment.statut as any,
        porteId: segment.porteId ?? null,
      };
    });
  }

  private async resolveSourceContext(
    s3KeyOriginal: string,
    user: CurrentUser,
  ): Promise<SourceContext> {
    const recording = await this.prisma.recording.findUnique({
      where: { s3Key: s3KeyOriginal },
      include: {
        commercial: { select: { id: true, directeurId: true, managerId: true } },
        manager: { select: { id: true, directeurId: true } },
      },
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    const commercialId = recording.commercialId ?? undefined;
    const managerId = recording.managerId ?? recording.commercial?.managerId ?? undefined;
    const directeurId =
      recording.commercial?.directeurId ??
      recording.manager?.directeurId ??
      undefined;

    if (!this.isAdmin(user) && Number(user.id) !== directeurId) {
      throw new ForbiddenException('Access denied to coaching recording');
    }

    const transcription =
      await this.transcriptionService.transcribeRecordingFromS3(s3KeyOriginal);

    return {
      recordingId: recording.id,
      s3KeyOriginal,
      commercialId: commercialId ?? undefined,
      managerId: managerId ?? undefined,
      directeurId: directeurId ?? undefined,
      segments: transcription
        ? this.buildSegmentsFromWhisper(transcription.segments)
        : [],
    };
  }

  private async ensureActiveSalesPlanVersion() {
    const existing = await this.prisma.coachingSalesPlanVersion.findFirst({
      where: {
        isActive: true,
        salesPlan: { isDefault: true },
      },
      include: { salesPlan: true },
      orderBy: { version: 'desc' },
    });

    if (existing) return existing;

    return this.prisma.$transaction(async (tx) => {
      const salesPlan = await tx.coachingSalesPlan.create({
        data: {
          name: 'Plan de vente porte-a-porte',
          description:
            'Grille MVP pour analyser les conversations de prospection terrain.',
          isDefault: true,
        },
      });

      return tx.coachingSalesPlanVersion.create({
        data: {
          salesPlanId: salesPlan.id,
          version: 1,
          title: 'Grille standard porte-a-porte v1',
          criteria: DEFAULT_CRITERIA,
          prompt: DEFAULT_PROMPT,
          isActive: true,
        },
        include: { salesPlan: true },
      });
    });
  }

  private async getSalesPlanVersion(id: number) {
    const version = await this.prisma.coachingSalesPlanVersion.findUnique({
      where: { id },
      include: { salesPlan: true },
    });
    if (!version) {
      throw new NotFoundException('Coaching sales plan version not found');
    }
    return version;
  }

  private async findSessionOrThrow(
    id: number,
    user: CurrentUser,
    includeConversations: boolean,
  ): Promise<any> {
    const session = await this.prisma.coachingSession.findUnique({
      where: { id },
      include: this.sessionInclude(includeConversations),
    });

    if (!session) {
      throw new NotFoundException('Coaching session not found');
    }

    await this.ensureSessionAccess(session, user);
    return session;
  }

  private async ensureSessionAccess(
    session: { directeurId?: number | null },
    user: CurrentUser,
  ): Promise<void> {
    if (this.isAdmin(user)) return;
    if (session.directeurId && session.directeurId === Number(user.id)) return;
    throw new ForbiddenException('Access denied to coaching session');
  }

  private sessionScopeWhere(user: CurrentUser) {
    if (this.isAdmin(user)) return {};
    return { directeurId: Number(user.id) };
  }

  private sessionInclude(includeConversations: boolean) {
    return {
      salesPlanVersion: true,
      conversations: includeConversations
        ? { orderBy: { orderIndex: 'asc' as const } }
        : false,
    };
  }

  private mapSalesPlan(plan: any, activeVersion: any): CoachingSalesPlanDto {
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description ?? undefined,
      isDefault: plan.isDefault,
      activeVersion: this.mapSalesPlanVersion(activeVersion),
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  private mapSalesPlanVersion(version: any) {
    return {
      id: version.id,
      salesPlanId: version.salesPlanId,
      version: version.version,
      title: version.title,
      criteria: this.jsonToStringArray(version.criteria),
      prompt: version.prompt ?? undefined,
      isActive: version.isActive,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
    };
  }

  private mapSession(session: any): CoachingSessionDto {
    return {
      id: session.id,
      recordingId: session.recordingId ?? undefined,
      s3KeyOriginal: session.s3KeyOriginal,
      salesPlanVersionId: session.salesPlanVersionId,
      status: session.status,
      score: session.score ?? undefined,
      summary: session.summary ?? undefined,
      strengths: this.jsonToStringArray(session.strengths),
      improvements: this.jsonToStringArray(session.improvements),
      recommendations: this.jsonToStringArray(session.recommendations),
      error: session.error ?? undefined,
      analyzedAt: session.analyzedAt ?? undefined,
      launchedById: session.launchedById ?? undefined,
      launchedByRole: session.launchedByRole ?? undefined,
      commercialId: session.commercialId ?? undefined,
      managerId: session.managerId ?? undefined,
      directeurId: session.directeurId ?? undefined,
      conversations: (session.conversations ?? []).map((conversation) => ({
        id: conversation.id,
        sessionId: conversation.sessionId,
        segmentId: conversation.segmentId ?? undefined,
        orderIndex: conversation.orderIndex,
        title: conversation.title ?? undefined,
        status: conversation.status,
        score: conversation.score ?? undefined,
        summary: conversation.summary ?? undefined,
        strengths: this.jsonToStringArray(conversation.strengths),
        improvements: this.jsonToStringArray(conversation.improvements),
        recommendations: this.jsonToStringArray(conversation.recommendations),
        transcriptText: conversation.transcriptText ?? undefined,
        readableTranscriptText:
          conversation.readableTranscriptText ?? undefined,
        statut: conversation.statut ?? undefined,
        porteId: conversation.porteId ?? undefined,
        startTime: conversation.startTime ?? undefined,
        endTime: conversation.endTime ?? undefined,
        durationSec: conversation.durationSec ?? undefined,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      })),
      salesPlanVersion: session.salesPlanVersion
        ? this.mapSalesPlanVersion(session.salesPlanVersion)
        : undefined,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  private jsonToStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }

  private toJsonArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 10);
  }

  private clampScore(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private buildSegmentsFromWhisper(
    whisperSegments: WhisperSegment[],
  ): SegmentForCoaching[] {
    const cleanSegments = whisperSegments
      .filter((segment) => segment.text?.trim())
      .sort((a, b) => a.start - b.start);

    if (cleanSegments.length <= this.maxConversations) {
      return cleanSegments.map((segment, orderIndex) =>
        this.mapWhisperChunk([segment], orderIndex),
      );
    }

    const chunkSize = Math.ceil(cleanSegments.length / this.maxConversations);
    const chunks: WhisperSegment[][] = [];

    for (let i = 0; i < cleanSegments.length; i += chunkSize) {
      chunks.push(cleanSegments.slice(i, i + chunkSize));
    }

    return chunks
      .slice(0, this.maxConversations)
      .map((chunk, orderIndex) => this.mapWhisperChunk(chunk, orderIndex));
  }

  private mapWhisperChunk(
    chunk: WhisperSegment[],
    orderIndex: number,
  ): SegmentForCoaching {
    const startTime = Math.min(...chunk.map((segment) => segment.start));
    const endTime = Math.max(...chunk.map((segment) => segment.end));

    return {
      orderIndex,
      startTime,
      endTime,
      durationSec: Math.max(0, endTime - startTime),
      transcription: chunk
        .map((segment) => segment.text.trim())
        .filter(Boolean)
        .join(' ')
        .trim(),
    };
  }

  private getVllmChatCompletionsUrl(): string {
    const baseUrl = this.vllmBaseUrl!.replace(/\/+$/, '');
    if (baseUrl.endsWith('/chat/completions')) {
      return baseUrl;
    }
    return `${baseUrl}/chat/completions`;
  }

  private truncatePromptText(text: string): string {
    if (text.length <= this.maxTranscriptPromptChars) {
      return text;
    }
    return `${text.slice(0, this.maxTranscriptPromptChars)}\n\n[Transcript tronqué pour respecter la limite de prompt.]`;
  }

  private parseAiJson(content: string): AiEvaluation {
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned) as AiEvaluation;
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');

      if (start >= 0 && end > start) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1)) as AiEvaluation;
        } catch {
          // Fall through to the stable domain error below.
        }
      }

      throw new Error('Réponse vLLM non JSON.');
    }
  }

  private resolvePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.round(parsed);
  }

  private isAdmin(user: CurrentUser): boolean {
    return user.role?.toLowerCase() === 'admin';
  }

  private buildVllmHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.vllmApiKey) {
      headers.Authorization = `Bearer ${this.vllmApiKey}`;
    }

    return headers;
  }
}
