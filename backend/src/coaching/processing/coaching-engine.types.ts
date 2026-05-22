import { Prisma } from '@prisma/client';
import type {
  CriterionEvidencePayload,
  DeterministicScoringResult,
} from '../scoring/coaching-scoring.types';
import type {
  ConversationKind,
  DialogueTurnPayload,
  SourceTranscriptSegmentPayload,
} from '../types/coaching-dialogue.types';
import type { DialogueFaithfulnessMetrics } from '../utils/dialogue-faithfulness.utils';
import type { TranscriptWordTiming } from '../utils/transcript-word-timing.utils';

export type CurrentUser = {
  id: number;
  role: string;
};

export const SESSION_FULL_INCLUDE =
  Prisma.validator<Prisma.CoachingSessionInclude>()({
    commercial: true,
    salesPlanVersion: { include: { salesPlan: true } },
    analysisJobs: { orderBy: { createdAt: 'desc' } },
    stepEvaluations: { orderBy: { ordre: 'asc' } },
    keyMoments: { orderBy: { startTime: 'asc' } },
    conversationEvaluations: {
      orderBy: { ordre: 'asc' },
      include: { criterionEvidences: { orderBy: { id: 'asc' } } },
    },
  });

export const SESSION_LIST_INCLUDE =
  Prisma.validator<Prisma.CoachingSessionInclude>()({
    commercial: true,
    salesPlanVersion: {
      select: {
        id: true,
        label: true,
        versionNumber: true,
        salesPlan: { select: { id: true, nom: true } },
      },
    },
    analysisJobs: { orderBy: { createdAt: 'desc' }, take: 1 },
  });

export type CoachingSessionWithFullRelations =
  Prisma.CoachingSessionGetPayload<{ include: typeof SESSION_FULL_INCLUDE }>;

export type CoachingSessionWithListRelations =
  Prisma.CoachingSessionGetPayload<{ include: typeof SESSION_LIST_INCLUDE }>;

export type StepEvaluationPayload = {
  ordre: number;
  titre: string;
  coverageStatus: 'COVERED' | 'PARTIAL' | 'MISSING';
  score?: number | null;
  startTime?: number | null;
  endTime?: number | null;
  verbatim?: string | null;
  feedback?: string | null;
  recommendation?: string | null;
};

export type KeyMomentPayload = {
  type: string;
  title: string;
  summary?: string | null;
  startTime?: number | null;
  endTime?: number | null;
  verbatim?: string | null;
  importance?: number | null;
};

export type SessionEvaluationPayload = {
  overallScore?: number | null;
  planCoverageScore?: number | null;
  executionQualityScore?: number | null;
  objectionHandlingScore?: number | null;
  listeningRatioScore?: number | null;
  closingScore?: number | null;
  summary?: string | null;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  keyMoments: KeyMomentPayload[];
  stepEvaluations: StepEvaluationPayload[];
  rawResponse?: string | null;
  usedFallback?: boolean;
  scoringMode?: string;
  scoringSchemaVersion?: string;
  evidencePromptVersion?: string;
  evaluationPromptVersion?: string;
  criterionEvidences?: CriterionEvidencePayload[];
};

export type CoachingTranscriptPayload = {
  segments: Array<{
    start: number;
    end: number;
    text: string;
    type?: 'PROSPECT' | 'INTERNAL' | 'NOISE' | 'UNKNOWN';
    source?: string;
    confidence?: number;
    statut?: string | null;
    speechScore?: number | null;
    sourceTranscriptSegments?: SourceTranscriptSegmentPayload[];
    words?: TranscriptWordTiming[];
  }>;
  duration: number;
  source:
    | 'WHISPER_FULL_RECORDING'
    | 'RECORDING_SEGMENTS'
    | 'RECORDING_CONVERSATION_SEGMENTS';
};

export type CoachingConversationBlock = {
  ordre: number;
  title: string;
  startTime: number;
  endTime: number;
  transcriptText: string;
  readableTranscriptText?: string | null;
  sourceTranscriptSegments?: SourceTranscriptSegmentPayload[];
  words?: TranscriptWordTiming[];
  dialogueTurns?: DialogueTurnPayload[];
  dialoguePromptVersion?: string | null;
  dialogueRawResponse?: string | null;
  conversationKind?: ConversationKind | null;
  usableForScoring?: boolean | null;
  scoreabilityReason?: string | null;
  dialogueQualityJson?: DialogueFaithfulnessMetrics | null;
  segmentsCount: number;
  status: 'COMPLETED' | 'NEEDS_REVIEW' | 'SKIPPED' | 'FAILED';
  reviewReason?: string | null;
  segmentType?: 'PROSPECT' | 'INTERNAL' | 'NOISE' | 'UNKNOWN';
  segmentSource?: string | null;
  segmentConfidence?: number | null;
  segmentStatut?: string | null;
  speechScore?: number | null;
};

export type ConversationDetectionSummary = {
  blocks: CoachingConversationBlock[];
  semanticDetectionUsed: boolean;
  detectedTotal: number;
  detectedProspect: number;
  detectedInternal: number;
  detectedNoise: number;
};

export type SessionStatusContext = {
  status: 'COMPLETED' | 'NEEDS_REVIEW';
  reviewStatus: 'NOT_REQUIRED' | 'PENDING';
  reviewReason: string | null;
  confidenceScore: number;
  identificationSource: string;
};

export type EvidenceRemarksResult = {
  summary?: string | null;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
};

export type EvidenceSummaryInput = {
  scoring: Pick<DeterministicScoringResult, 'overallScore' | 'reviewRequired' | 'reviewReason'>;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
