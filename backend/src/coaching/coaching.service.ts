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
import {
  FINAL_SALES_PLAN_CRITERIA,
  FINAL_SALES_PLAN_DESCRIPTION,
  FINAL_SALES_PLAN_PRODUCTS,
  FINAL_SALES_PLAN_PROMPT,
  FINAL_SALES_PLAN_TITLE,
  FINAL_SALES_PLAN_VERSION_LABEL,
} from './final-sales-plan';

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
  detectedProducts?: AiDetectedProduct[];
  conversationReading?: AiConversationReading;
  title?: string;
  score?: number;
  summary?: string;
  criterionResults?: AiCriterionResult[];
  strengths?: string[];
  improvements?: string[];
  recommendations?: string[];
  readableTranscriptText?: string;
};

type AiEvaluation = {
  score?: number;
  detectedProducts?: AiDetectedProduct[];
  conversationReading?: AiConversationReading;
  summary?: string;
  criterionResults?: AiCriterionResult[];
  strengths?: string[];
  improvements?: string[];
  recommendations?: string[];
  conversations?: AiConversationEvaluation[];
};

type CriterionDefinition = {
  key: string;
  title: string;
  weight: number;
  description?: string;
  phaseRefs?: string[];
  expectedSignals?: string[];
  negativeSignals?: string[];
  productKeys?: string[];
  appliesWhen?: {
    detectedProductsAny?: string[];
  };
};

type AiDetectedProduct = {
  key?: string;
  title?: string;
  evidence?: string[];
  confidence?: number;
};

type AiCriterionResult = {
  key?: string;
  title?: string;
  score?: number;
  maxScore?: number;
  applicability?: string;
  applicabilityRationale?: string;
  evidence?: string[];
  rationale?: string;
  recommendations?: string[];
};

type AiConversationReading = {
  observedPhase?: string;
  phaseConfidence?: number;
  entryStatus?: string;
  transcriptQuality?: string;
  reasoning?: string;
  evidence?: string[];
  observablePlanSteps?: string[];
  notObservablePlanSteps?: string[];
  expectedButMissingPlanSteps?: string[];
};

type NormalizedConversationReading = {
  observedPhase?: string;
  phaseConfidence?: number;
  entryStatus?: string;
  transcriptQuality?: string;
  reasoning?: string;
  evidence: string[];
  observablePlanSteps: string[];
  notObservablePlanSteps: string[];
  expectedButMissingPlanSteps: string[];
};

type NormalizedCriterionResult = {
  key: string;
  title: string;
  score: number;
  maxScore: number;
  weight: number;
  weightedScore: number;
  applicability?: string;
  applicabilityRationale?: string;
  evidence: string[];
  rationale?: string;
  recommendations: string[];
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
  'Avant de scorer, lis la scène commerciale globale: phase réelle, étapes observables du plan, étapes non observables car absentes du segment, et étapes attendues mais manquées.',
  'Retourne un JSON strict avec: conversationReading, summary, criterionResults, strengths, improvements, recommendations, conversations.',
  'Pour chaque critère, cite des preuves du transcript, justifie la note et donne des recommandations concrètes.',
  'Chaque critère doit avoir applicability: observable, partially_observable, not_observable ou missed.',
  'Ne pénalise pas une étape not_observable. Pénalise une étape missed quand elle aurait dû apparaître au vu de la phase commerciale observée.',
  'Les scores par critère sont des entiers de 0 à 100. Le backend calcule le score final.',
  'Les listes strengths, improvements et recommendations contiennent des phrases courtes en français.',
].join('\n');

const DEFAULT_CRITERION_WEIGHTS = [15, 20, 20, 15, 15, 15];

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
        conversationReading: Prisma.JsonNull,
        criterionResults: Prisma.JsonNull,
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
      const criteria = this.normalizeCriterionDefinitions(
        salesPlanVersion.criteria,
      );
      const applicableCriteria = this.filterApplicableCriteria(
        criteria,
        this.detectedProductKeysFromEvaluation(evaluation),
      );
      const sessionCriterionResults = this.buildSessionCriterionResults(
        evaluation,
        applicableCriteria,
      );
      const sessionScore = this.calculateWeightedScore(sessionCriterionResults);

      await this.prisma.coachingConversationEvaluation.createMany({
        data: this.buildConversationRows(
          sessionId,
          source,
          evaluation,
          applicableCriteria,
        ),
      });

      const updated = await this.prisma.coachingSession.update({
        where: { id: sessionId },
        data: {
          status: CoachingSessionStatus.READY,
          score: sessionScore,
          summary: evaluation.summary ?? 'Analyse coaching terminée.',
          conversationReading: this.normalizeConversationReading(
            evaluation.conversationReading,
          ),
          criterionResults: sessionCriterionResults,
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

    const criteria = this.normalizeCriterionDefinitions(
      salesPlanVersion.criteria,
    );
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
              products: FINAL_SALES_PLAN_PRODUCTS,
              scoringRules: [
                'readSceneFirst: avant les scores, interprète la scène commerciale complète selon le plan: phase observée, progression réelle, étapes observables, étapes non observables et étapes attendues mais manquées',
                'noKeywordShortcut: ne te limite pas à une liste de mots; compare le sens du transcript aux phases, scripts, signaux attendus et signaux négatifs du plan',
                'evidenceRequired: chaque interprétation et chaque critère doit citer des preuves textuelles courtes du transcript',
                'applicability: pour chaque critère retourne observable, partially_observable, not_observable ou missed',
                'notObservableRule: ne pénalise pas une étape absente parce que le segment commence après cette phase ou parce que cette phase n’est pas observable dans le transcript',
                'missedRule: pénalise une étape missed si elle aurait dû apparaître dans la phase commerciale observée mais n’apparaît pas',
                'detectProducts: retourne uniquement les produits explicitement évoqués dans le transcript',
                'universalCriteria: évalue les critères sans appliesWhen à chaque analyse',
                'productCriteria: évalue seulement les critères dont appliesWhen.detectedProductsAny contient un produit détecté',
                'recommendations: rattache chaque recommandation aux expectedSignals ou negativeSignals du critère',
              ],
              expectedJsonShape: {
                detectedProducts: [
                  {
                    key: 'string',
                    title: 'string',
                    evidence: ['citation courte du transcript'],
                    confidence: 0,
                  },
                ],
                conversationReading: {
                  observedPhase:
                    'door_approach | entry_obtained | inside_home_discovery | offer_presentation | closing | post_signature | refusal | mixed | unclear',
                  phaseConfidence: 0,
                  entryStatus:
                    'outside_door | entry_requested | entered_or_installed | meter_access | not_observable | unclear',
                  transcriptQuality:
                    'usable | usable_noisy | partial | poor | inexploitable',
                  reasoning:
                    'interprétation courte de la scène avant scoring, liée au plan de vente',
                  evidence: ['citation courte du transcript'],
                  observablePlanSteps: ['étape du plan observable'],
                  notObservablePlanSteps: [
                    'étape du plan non observable dans ce segment',
                  ],
                  expectedButMissingPlanSteps: [
                    'étape attendue à cette phase mais absente',
                  ],
                },
                summary: 'string',
                criterionResults: [
                  {
                    key: 'string',
                    title: 'string',
                    score: 0,
                    maxScore: 100,
                    applicability:
                      'observable | partially_observable | not_observable | missed',
                    applicabilityRationale:
                      'pourquoi ce critère est scoré, partiellement scoré, non observable ou manqué',
                    evidence: ['citation courte du transcript'],
                    rationale: 'string',
                    recommendations: ['string'],
                  },
                ],
                strengths: ['string'],
                improvements: ['string'],
                recommendations: ['string'],
                conversations: [
                  {
                    orderIndex: 0,
                    segmentId: 0,
                    detectedProducts: [
                      {
                        key: 'string',
                        title: 'string',
                        evidence: ['citation courte du transcript'],
                        confidence: 0,
                      },
                    ],
                    conversationReading: {
                      observedPhase: 'string',
                      phaseConfidence: 0,
                      entryStatus: 'string',
                      transcriptQuality: 'string',
                      reasoning: 'string',
                      evidence: ['citation courte du transcript'],
                      observablePlanSteps: ['string'],
                      notObservablePlanSteps: ['string'],
                      expectedButMissingPlanSteps: ['string'],
                    },
                    title: 'string',
                    summary: 'string',
                    criterionResults: [
                      {
                        key: 'string',
                        title: 'string',
                        score: 0,
                        maxScore: 100,
                        applicability:
                          'observable | partially_observable | not_observable | missed',
                        applicabilityRationale: 'string',
                        evidence: ['citation courte du transcript'],
                        rationale: 'string',
                        recommendations: ['string'],
                      },
                    ],
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
    criteria: CriterionDefinition[],
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
      const criterionResults = this.normalizeCriterionResults(
        ai.criterionResults,
        criteria,
      );
      const calculatedScore = this.calculateWeightedScore(criterionResults);

      return {
        sessionId,
        segmentId: segment.id ?? null,
        orderIndex: segment.orderIndex,
        title: ai.title ?? `Moment ${segment.orderIndex + 1}`,
        status: CoachingSessionStatus.READY,
        score: calculatedScore ?? this.clampScore(ai.score),
        summary: ai.summary ?? undefined,
        conversationReading: this.normalizeConversationReading(
          ai.conversationReading,
        ),
        criterionResults,
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

    if (existing && this.isFinalSalesPlanVersion(existing)) return existing;

    return this.prisma.$transaction(async (tx) => {
      const salesPlan =
        existing?.salesPlan ??
        (await tx.coachingSalesPlan.create({
          data: {
            name: FINAL_SALES_PLAN_TITLE,
            description: FINAL_SALES_PLAN_DESCRIPTION,
            isDefault: true,
          },
        }));

      await tx.coachingSalesPlanVersion.updateMany({
        where: { salesPlanId: salesPlan.id, isActive: true },
        data: { isActive: false },
      });

      const lastVersion = await tx.coachingSalesPlanVersion.findFirst({
        where: { salesPlanId: salesPlan.id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      await tx.coachingSalesPlan.update({
        where: { id: salesPlan.id },
        data: {
          name: FINAL_SALES_PLAN_TITLE,
          description: FINAL_SALES_PLAN_DESCRIPTION,
          isDefault: true,
        },
      });

      return tx.coachingSalesPlanVersion.create({
        data: {
          salesPlanId: salesPlan.id,
          version: (lastVersion?.version ?? 0) + 1,
          title: `${FINAL_SALES_PLAN_TITLE} (${FINAL_SALES_PLAN_VERSION_LABEL})`,
          criteria: FINAL_SALES_PLAN_CRITERIA,
          prompt: FINAL_SALES_PLAN_PROMPT,
          isActive: true,
        },
        include: { salesPlan: true },
      });
    });
  }

  private isFinalSalesPlanVersion(version: {
    title?: string | null;
    criteria?: unknown;
  }): boolean {
    return (
      typeof version.title === 'string' &&
      version.title.includes(FINAL_SALES_PLAN_VERSION_LABEL) &&
      Array.isArray(version.criteria)
    );
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
    const criterionDefinitions = this.normalizeCriterionDefinitions(
      version.criteria,
    );
    return {
      id: version.id,
      salesPlanId: version.salesPlanId,
      version: version.version,
      title: version.title,
      criteria: criterionDefinitions.map((criterion) => criterion.title),
      criterionDefinitions,
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
      conversationReading: this.mapConversationReading(
        session.conversationReading,
      ),
      criterionResults: this.mapCriterionResults(session.criterionResults),
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
        conversationReading: this.mapConversationReading(
          conversation.conversationReading,
        ),
        criterionResults: this.mapCriterionResults(conversation.criterionResults),
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

  private normalizeCriterionDefinitions(value: unknown): CriterionDefinition[] {
    if (!Array.isArray(value)) {
      return this.defaultCriterionDefinitions();
    }

    const definitions = value
      .map((item, index): CriterionDefinition | null => {
        if (typeof item === 'string') {
          return {
            key: this.slugify(item) || `criterion_${index + 1}`,
            title: item,
            weight: DEFAULT_CRITERION_WEIGHTS[index] ?? 10,
          };
        }

        if (!item || typeof item !== 'object') {
          return null;
        }

        const record = item as Record<string, unknown>;
        const rawTitle =
          typeof record.title === 'string'
            ? record.title
            : typeof record.name === 'string'
              ? record.name
              : typeof record.label === 'string'
                ? record.label
                : DEFAULT_CRITERIA[index] ?? `Critère ${index + 1}`;
        const rawKey =
          typeof record.key === 'string' ? record.key : this.slugify(rawTitle);
        const rawWeight = Number(record.weight);

        return {
          key: rawKey || `criterion_${index + 1}`,
          title: rawTitle,
          weight:
            Number.isFinite(rawWeight) && rawWeight > 0
              ? Math.round(rawWeight)
              : DEFAULT_CRITERION_WEIGHTS[index] ?? 10,
          description:
            typeof record.description === 'string'
              ? record.description
              : undefined,
          phaseRefs: this.toJsonArray(record.phaseRefs),
          expectedSignals: this.toJsonArray(record.expectedSignals),
          negativeSignals: this.toJsonArray(record.negativeSignals),
          productKeys: this.toJsonArray(record.productKeys),
          appliesWhen:
            record.appliesWhen &&
            typeof record.appliesWhen === 'object' &&
            Array.isArray(
              (record.appliesWhen as Record<string, unknown>).detectedProductsAny,
            )
              ? {
                  detectedProductsAny: this.toJsonArray(
                    (record.appliesWhen as Record<string, unknown>)
                      .detectedProductsAny,
                  ),
                }
              : undefined,
        };
      })
      .filter((item): item is CriterionDefinition => Boolean(item));

    return definitions.length > 0 ? definitions : this.defaultCriterionDefinitions();
  }

  private defaultCriterionDefinitions(): CriterionDefinition[] {
    return DEFAULT_CRITERIA.map((title, index) => ({
      key: this.slugify(title) || `criterion_${index + 1}`,
      title,
      weight: DEFAULT_CRITERION_WEIGHTS[index] ?? 10,
    }));
  }

  private detectedProductKeys(value: unknown): Set<string> {
    if (!Array.isArray(value)) return new Set();

    return new Set(
      value
        .map((item) => {
          if (!item || typeof item !== 'object') return undefined;
          const key = (item as Record<string, unknown>).key;
          return typeof key === 'string' ? key.trim() : undefined;
        })
        .filter((key): key is string => Boolean(key)),
    );
  }

  private detectedProductKeysFromEvaluation(
    evaluation: AiEvaluation,
  ): Set<string> {
    const detected = this.detectedProductKeys(evaluation.detectedProducts);

    for (const conversation of evaluation.conversations ?? []) {
      for (const key of this.detectedProductKeys(conversation.detectedProducts)) {
        detected.add(key);
      }
    }

    return detected;
  }

  private filterApplicableCriteria(
    criteria: CriterionDefinition[],
    detectedProducts: Set<string>,
  ): CriterionDefinition[] {
    return criteria.filter((criterion) => {
      const requiredProducts = criterion.appliesWhen?.detectedProductsAny ?? [];
      if (requiredProducts.length === 0) return true;
      return requiredProducts.some((productKey) => detectedProducts.has(productKey));
    });
  }

  private normalizeCriterionResults(
    value: unknown,
    criteria: CriterionDefinition[],
  ): NormalizedCriterionResult[] {
    const rawResults = Array.isArray(value) ? value : [];
    if (rawResults.length === 0) {
      return this.buildFallbackCriterionResults(criteria);
    }

    return criteria.map((criterion) => {
      const raw = rawResults.find((item) => {
        if (!item || typeof item !== 'object') return false;
        const record = item as Record<string, unknown>;
        const key = typeof record.key === 'string' ? record.key : '';
        const title = typeof record.title === 'string' ? record.title : '';
        return (
          key === criterion.key ||
          this.slugify(key) === criterion.key ||
          this.slugify(title) === criterion.key ||
          title === criterion.title
        );
      }) as Record<string, unknown> | undefined;

      const maxScore = this.clampPositiveInt(raw?.maxScore, 100);
      const score = this.clampScore(raw?.score) ?? 0;
      const applicability = this.normalizeApplicability(raw?.applicability);

      return {
        key: criterion.key,
        title:
          typeof raw?.title === 'string' && raw.title.trim()
            ? raw.title.trim()
            : criterion.title,
        score: Math.min(score, maxScore),
        maxScore,
        weight: criterion.weight,
        weightedScore: Math.round((Math.min(score, maxScore) / maxScore) * criterion.weight),
        applicability,
        applicabilityRationale:
          typeof raw?.applicabilityRationale === 'string' &&
          raw.applicabilityRationale.trim()
            ? raw.applicabilityRationale.trim()
            : undefined,
        evidence: this.toJsonArray(raw?.evidence).slice(0, 5),
        rationale:
          typeof raw?.rationale === 'string' && raw.rationale.trim()
            ? raw.rationale.trim()
            : undefined,
        recommendations: this.toJsonArray(raw?.recommendations).slice(0, 5),
      };
    });
  }

  private buildSessionCriterionResults(
    evaluation: AiEvaluation,
    criteria: CriterionDefinition[],
  ): NormalizedCriterionResult[] {
    if (Array.isArray(evaluation.criterionResults) && evaluation.criterionResults.length > 0) {
      return this.normalizeCriterionResults(evaluation.criterionResults, criteria);
    }

    const conversationResults = (evaluation.conversations ?? [])
      .map((conversation) =>
        Array.isArray(conversation.criterionResults)
          ? this.normalizeCriterionResults(conversation.criterionResults, criteria)
          : [],
      )
      .filter((results) => results.length > 0);

    if (conversationResults.length === 0) {
      return this.buildFallbackCriterionResults(criteria);
    }

    return criteria.map((criterion) => {
      const matching = conversationResults
        .map((results) => results.find((result) => result.key === criterion.key))
        .filter((result): result is NormalizedCriterionResult => Boolean(result));

      if (matching.length === 0) {
        return this.buildFallbackCriterionResults([criterion])[0];
      }

      const averageScore = Math.round(
        matching.reduce((sum, result) => sum + result.score, 0) / matching.length,
      );
      const maxScore = 100;

      return {
        key: criterion.key,
        title: criterion.title,
        score: averageScore,
        maxScore,
        weight: criterion.weight,
        weightedScore: Math.round((averageScore / maxScore) * criterion.weight),
        applicability: this.mergeApplicability(matching),
        applicabilityRationale: matching
          .map((result) => result.applicabilityRationale)
          .filter(Boolean)
          .join(' '),
        evidence: matching.flatMap((result) => result.evidence).slice(0, 5),
        rationale: matching
          .map((result) => result.rationale)
          .filter(Boolean)
          .join(' '),
        recommendations: matching
          .flatMap((result) => result.recommendations)
          .slice(0, 5),
      };
    });
  }

  private buildFallbackCriterionResults(
    criteria: CriterionDefinition[],
  ): NormalizedCriterionResult[] {
    return criteria.map((criterion) => ({
      key: criterion.key,
      title: criterion.title,
      score: 0,
      maxScore: 100,
      weight: criterion.weight,
      weightedScore: 0,
      applicability: 'missed',
      applicabilityRationale:
        'Le modèle n’a pas retourné d’analyse pour ce critère applicable.',
      evidence: [],
      rationale: 'Aucun résultat fiable retourné par le modèle pour ce critère.',
      recommendations: [],
    }));
  }

  private calculateWeightedScore(
    results: NormalizedCriterionResult[],
  ): number | undefined {
    const scoredResults = results.filter(
      (item) => item.applicability !== 'not_observable',
    );
    if (scoredResults.length === 0) return undefined;

    const totalWeight = scoredResults.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight <= 0) return undefined;

    const weightedTotal = scoredResults.reduce(
      (sum, item) => sum + item.weightedScore,
      0,
    );
    return Math.max(0, Math.min(100, Math.round((weightedTotal / totalWeight) * 100)));
  }

  private mapCriterionResults(value: unknown): NormalizedCriterionResult[] {
    if (!Array.isArray(value)) return [];

    return value
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => ({
        key: typeof item.key === 'string' ? item.key : '',
        title: typeof item.title === 'string' ? item.title : '',
        score: this.clampScore(item.score) ?? 0,
        maxScore: this.clampPositiveInt(item.maxScore, 100),
        weight: this.clampPositiveInt(item.weight, 1),
        weightedScore: this.clampScore(item.weightedScore) ?? 0,
        applicability: this.normalizeApplicability(item.applicability),
        applicabilityRationale:
          typeof item.applicabilityRationale === 'string' &&
          item.applicabilityRationale.trim()
            ? item.applicabilityRationale.trim()
            : undefined,
        evidence: this.toJsonArray(item.evidence).slice(0, 5),
        rationale:
          typeof item.rationale === 'string' && item.rationale.trim()
            ? item.rationale.trim()
            : undefined,
        recommendations: this.toJsonArray(item.recommendations).slice(0, 5),
      }))
      .filter((item) => item.key && item.title);
  }

  private normalizeConversationReading(
    value: unknown,
  ): NormalizedConversationReading {
    if (!value || typeof value !== 'object') {
      return this.emptyConversationReading();
    }

    const record = value as Record<string, unknown>;
    return {
      observedPhase: this.optionalString(record.observedPhase),
      phaseConfidence: this.clampScore(record.phaseConfidence),
      entryStatus: this.optionalString(record.entryStatus),
      transcriptQuality: this.optionalString(record.transcriptQuality),
      reasoning: this.optionalString(record.reasoning),
      evidence: this.toJsonArray(record.evidence).slice(0, 8),
      observablePlanSteps: this.toJsonArray(record.observablePlanSteps).slice(0, 12),
      notObservablePlanSteps: this.toJsonArray(
        record.notObservablePlanSteps,
      ).slice(0, 12),
      expectedButMissingPlanSteps: this.toJsonArray(
        record.expectedButMissingPlanSteps,
      ).slice(0, 12),
    };
  }

  private mapConversationReading(
    value: unknown,
  ): NormalizedConversationReading | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const reading = this.normalizeConversationReading(value);
    if (
      !reading.observedPhase &&
      !reading.entryStatus &&
      !reading.transcriptQuality &&
      !reading.reasoning &&
      reading.evidence.length === 0 &&
      reading.observablePlanSteps.length === 0 &&
      reading.notObservablePlanSteps.length === 0 &&
      reading.expectedButMissingPlanSteps.length === 0
    ) {
      return undefined;
    }
    return reading;
  }

  private emptyConversationReading(): NormalizedConversationReading {
    return {
      evidence: [],
      observablePlanSteps: [],
      notObservablePlanSteps: [],
      expectedButMissingPlanSteps: [],
    };
  }

  private normalizeApplicability(value: unknown): string {
    if (typeof value !== 'string') return 'observable';
    const normalized = value.trim().toLowerCase();
    if (
      normalized === 'observable' ||
      normalized === 'partially_observable' ||
      normalized === 'not_observable' ||
      normalized === 'missed'
    ) {
      return normalized;
    }
    return 'observable';
  }

  private mergeApplicability(results: NormalizedCriterionResult[]): string {
    const values = results.map((result) => result.applicability ?? 'observable');
    if (values.includes('missed')) return 'missed';
    if (values.includes('observable')) return 'observable';
    if (values.includes('partially_observable')) return 'partially_observable';
    if (values.includes('not_observable')) return 'not_observable';
    return 'observable';
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim()
      ? value.trim()
      : undefined;
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

  private clampPositiveInt(value: unknown, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.round(parsed);
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
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
