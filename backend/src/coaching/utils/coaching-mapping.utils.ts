import type {
  CoachingAnalysisJobStatusDto,
  CoachingConversationStatusDto,
  CoachingSessionDto,
  CoachingAnalysisJobDto,
  CoachingReviewStatusDto,
  CoachingSessionStatusDto,
  CoachingStepCoverageStatusDto,
  CoachingDialogueNormalizationDto,
  CoachingDialogueTurnDto,
} from '../coaching.dto';

type AnalysisJobLike = {
  id: number;
  coachingSessionId: number;
  status: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  currentStep?: string | null;
  failureReason?: string | null;
  queuedAt: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  nextRunAt?: Date | null;
  lastHeartbeatAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type StepEvaluationLike = {
  id: number;
  ordre: number;
  titre: string;
  coverageStatus: string;
  score?: number | null;
  startTime?: number | null;
  endTime?: number | null;
  verbatim?: string | null;
  feedback?: string | null;
  recommendation?: string | null;
};

type KeyMomentLike = {
  id: number;
  type: string;
  title: string;
  summary?: string | null;
  startTime?: number | null;
  endTime?: number | null;
  verbatim?: string | null;
  importance?: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type CriterionEvidenceLike = {
  id: number;
  stepOrder: number;
  criterionKey: string;
  criterionLabel: string;
  found: boolean;
  quality: string;
  confidence: number;
  verbatim?: string | null;
  startTime?: number | null;
  endTime?: number | null;
  reason?: string | null;
  evidenceCompleteness?: string | null;
  missingBecause?: string | null;
  scoreable?: boolean | null;
  sourceTurnIds?: unknown;
  reviewStatus: string;
};

type ConversationEvaluationLike = {
  id: number;
  ordre: number;
  title?: string | null;
  startTime?: number | null;
  endTime?: number | null;
  transcriptText?: string | null;
  readableTranscriptText?: string | null;
  dialogueTurns?: unknown;
  dialoguePromptVersion?: string | null;
  dialogueRawResponse?: string | null;
  conversationKind?: string | null;
  usableForScoring?: boolean | null;
  scoreabilityReason?: string | null;
  status: string;
  reviewReason?: string | null;
  overallScore?: number | null;
  planCoverageScore?: number | null;
  executionQualityScore?: number | null;
  objectionHandlingScore?: number | null;
  listeningRatioScore?: number | null;
  closingScore?: number | null;
  summary?: string | null;
  strengths?: string[];
  improvements?: string[];
  recommendations?: string[];
  scoringMode?: string | null;
  scoringSchemaVersion?: string | null;
  evidencePromptVersion?: string | null;
  evaluationPromptVersion?: string | null;
  criterionEvidences?: CriterionEvidenceLike[];
  createdAt: Date;
  updatedAt: Date;
};

export type SessionLike = {
  id: number;
  s3KeyOriginal: string;
  roomName?: string | null;
  commercialId?: number | null;
  commercial?: { prenom: string; nom: string; directeurId?: number | null } | null;
  directeurId?: number | null;
  salesPlanVersionId: number;
  salesPlanVersion?: {
    label?: string | null;
    salesPlan?: { nom?: string | null } | null;
  } | null;
  status: string;
  reviewStatus: string;
  confidenceScore?: number | null;
  identificationSource?: string | null;
  transcriptText?: string | null;
  readableTranscriptText?: string | null;
  transcriptDurationSec?: number | null;
  whisperSegmentsCount?: number | null;
  overallScore?: number | null;
  planCoverageScore?: number | null;
  executionQualityScore?: number | null;
  objectionHandlingScore?: number | null;
  listeningRatioScore?: number | null;
  closingScore?: number | null;
  summary?: string | null;
  strengths?: string[];
  improvements?: string[];
  recommendations?: string[];
  llmModel?: string | null;
  scoringMode?: string | null;
  scoringSchemaVersion?: string | null;
  evidencePromptVersion?: string | null;
  evaluationPromptVersion?: string | null;
  failureReason?: string | null;
  reviewReason?: string | null;
  reviewNotes?: string | null;
  launchedAt: Date;
  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  analysisJobs?: AnalysisJobLike[];
  stepEvaluations?: StepEvaluationLike[];
  keyMoments?: KeyMomentLike[];
  conversationEvaluations?: ConversationEvaluationLike[];
};

export function secondsSince(value: Date): number {
  return Math.max(0, Math.round((Date.now() - value.getTime()) / 1000));
}

export function pipelineStatus(
  done: boolean,
  processing: boolean,
  failed: boolean,
): string {
  if (failed) {
    return 'FAILED';
  }
  if (done) {
    return 'COMPLETED';
  }
  if (processing) {
    return 'PROCESSING';
  }
  return 'PENDING';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeDialogueTurns(value: unknown): CoachingDialogueTurnDto[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map<CoachingDialogueTurnDto | null>((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const text = typeof item.text === 'string' ? item.text.trim() : '';
      if (!text) {
        return null;
      }
      const confidence = Number(item.confidence);
      const speakerConfidence = Number(item.speakerConfidence);
      const textConfidence = Number(item.textConfidence);
      const startTime = Number(item.startTime);
      const endTime = Number(item.endTime);
      return {
        speaker:
          typeof item.speaker === 'string' && item.speaker
            ? item.speaker
            : 'UNKNOWN',
        startTime: Number.isFinite(startTime) ? startTime : undefined,
        endTime: Number.isFinite(endTime) ? endTime : undefined,
        text,
        rawText:
          typeof item.rawText === 'string' && item.rawText.trim()
            ? item.rawText.trim()
            : undefined,
        normalizedText:
          typeof item.normalizedText === 'string' && item.normalizedText.trim()
            ? item.normalizedText.trim()
            : undefined,
        sourceQuote:
          typeof item.sourceQuote === 'string' && item.sourceQuote.trim()
            ? item.sourceQuote.trim()
            : undefined,
        confidence: Number.isFinite(confidence)
          ? Math.max(0, Math.min(1, confidence))
          : 0.5,
        speakerConfidence: Number.isFinite(speakerConfidence)
          ? Math.max(0, Math.min(1, speakerConfidence))
          : undefined,
        textConfidence: Number.isFinite(textConfidence)
          ? Math.max(0, Math.min(1, textConfidence))
          : undefined,
        correctionLevel:
          typeof item.correctionLevel === 'string'
            ? item.correctionLevel
            : undefined,
        normalizations: normalizeDialogueNormalizations(item.normalizations),
        scorable: item.scorable !== false,
        displayable: item.displayable !== false,
        blockType:
          typeof item.blockType === 'string' && item.blockType.trim()
            ? item.blockType.trim()
            : undefined,
        exclusionReason:
          typeof item.exclusionReason === 'string' &&
          item.exclusionReason.trim()
            ? item.exclusionReason.trim()
            : undefined,
        reason:
          typeof item.reason === 'string' && item.reason.trim()
            ? item.reason.trim()
            : undefined,
      };
    })
    .filter((turn): turn is CoachingDialogueTurnDto => Boolean(turn));
}

function normalizeDialogueNormalizations(
  value: unknown,
): CoachingDialogueNormalizationDto[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item): CoachingDialogueNormalizationDto | null => {
      if (!isRecord(item)) return null;
      const raw = typeof item.raw === 'string' ? item.raw.trim() : '';
      const normalized =
        typeof item.normalized === 'string' ? item.normalized.trim() : '';
      const type = typeof item.type === 'string' ? item.type : 'NONE';
      const confidence = Number(item.confidence);
      if (!raw || !normalized) return null;
      return {
        raw,
        normalized,
        type,
        confidence: Number.isFinite(confidence)
          ? Math.max(0, Math.min(1, confidence))
          : 0.5,
        meaningChanged: Boolean(item.meaningChanged),
        reason:
          typeof item.reason === 'string' && item.reason.trim()
            ? item.reason.trim()
            : undefined,
      };
    })
    .filter(
      (normalization): normalization is CoachingDialogueNormalizationDto =>
        Boolean(normalization),
    );
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

export function mapAnalysisJob(job: AnalysisJobLike): CoachingAnalysisJobDto {
  return {
    id: job.id,
    coachingSessionId: job.coachingSessionId,
    status: job.status as CoachingAnalysisJobStatusDto,
    priority: job.priority,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    currentStep: job.currentStep ?? undefined,
    failureReason: job.failureReason ?? undefined,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt ?? undefined,
    completedAt: job.completedAt ?? undefined,
    failedAt: job.failedAt ?? undefined,
    nextRunAt: job.nextRunAt ?? undefined,
    lastHeartbeatAt: job.lastHeartbeatAt ?? undefined,
    waitSeconds:
      job.status === 'QUEUED'
        ? secondsSince(job.queuedAt)
        : job.startedAt
          ? Math.max(
              0,
              Math.round(
                (job.startedAt.getTime() - job.queuedAt.getTime()) / 1000,
              ),
            )
          : undefined,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function buildPipelineSteps(
  session: SessionLike,
  job?: CoachingAnalysisJobDto,
): Array<{
  key: string;
  label: string;
  status: string;
  timestamp?: Date;
  detail?: string;
}> {
  const failed = session.status === 'FAILED' || job?.status === 'FAILED';
  const processing = session.status === 'PROCESSING';
  const completed =
    session.status === 'COMPLETED' || session.status === 'NEEDS_REVIEW';

  return [
    {
      key: 'queued',
      label: 'File d’attente',
      status: job
        ? pipelineStatus(Boolean(job.startedAt), false, false)
        : 'PENDING',
      timestamp: job?.queuedAt,
      detail: job?.currentStep,
    },
    {
      key: 'processing',
      label: 'Traitement audio',
      status: pipelineStatus(
        Boolean(session.transcriptText),
        processing,
        failed && !session.transcriptText,
      ),
      timestamp: job?.startedAt,
    },
    {
      key: 'readable_transcript',
      label: 'Transcript lisible',
      status: pipelineStatus(
        Boolean(session.readableTranscriptText),
        processing && Boolean(session.transcriptText),
        failed && Boolean(session.transcriptText),
      ),
    },
    {
      key: 'evaluation',
      label: 'Évaluation IA',
      status: pipelineStatus(
        Boolean(session.overallScore || session.summary),
        processing && Boolean(session.readableTranscriptText),
        failed && Boolean(session.readableTranscriptText),
      ),
    },
    {
      key: 'completed',
      label: 'Rapport disponible',
      status: pipelineStatus(
        completed,
        processing && Boolean(session.overallScore || session.summary),
        failed,
      ),
      timestamp: session.processedAt ?? job?.completedAt ?? job?.failedAt,
      detail: session.failureReason ?? session.reviewReason ?? undefined,
    },
  ];
}

export { mapSession } from './coaching-session-mapping.utils';
