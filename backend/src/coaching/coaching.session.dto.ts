import { Field, Float, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ArrayMinSize, IsArray, IsBoolean, IsDate, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { CoachingAnalysisJobStatusDto, CoachingReviewStatusDto, CoachingSessionStatusDto } from './coaching.enums.dto';
import { SalesPlanVersionDto } from './coaching.sales-plan.dto';
import { CoachingConversationEvaluationDto, CoachingKeyMomentDto, CoachingStepEvaluationDto } from './coaching.evaluation.dto';

@ObjectType()
export class CoachingAnalysisJobDto {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  coachingSessionId: number;

  @Field(() => CoachingAnalysisJobStatusDto)
  status: CoachingAnalysisJobStatusDto;

  @Field(() => Int)
  priority: number;

  @Field(() => Int)
  attempts: number;

  @Field(() => Int)
  maxAttempts: number;

  @Field({ nullable: true })
  currentStep?: string;

  @Field({ nullable: true })
  failureReason?: string;

  @Field()
  queuedAt: Date;

  @Field({ nullable: true })
  startedAt?: Date;

  @Field({ nullable: true })
  completedAt?: Date;

  @Field({ nullable: true })
  failedAt?: Date;

  @Field({ nullable: true })
  nextRunAt?: Date;

  @Field({ nullable: true })
  lastHeartbeatAt?: Date;

  @Field(() => Float, { nullable: true })
  waitSeconds?: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class CoachingAnalysisPipelineStepDto {
  @Field()
  key: string;

  @Field()
  label: string;

  @Field()
  status: string;

  @Field({ nullable: true })
  timestamp?: Date;

  @Field({ nullable: true })
  detail?: string;
}

@ObjectType()
export class CoachingQueueSummaryDto {
  @Field(() => Int)
  queued: number;

  @Field(() => Int)
  processing: number;

  @Field(() => Int)
  completed: number;

  @Field(() => Int)
  failed: number;

  @Field(() => Int)
  cancelled: number;

  @Field(() => Int)
  concurrency: number;

  @Field(() => Float, { nullable: true })
  oldestQueuedAgeSeconds?: number;
}

@ObjectType()
export class CoachingQueueStateDto {
  @Field(() => CoachingQueueSummaryDto)
  summary: CoachingQueueSummaryDto;

  @Field(() => [CoachingAnalysisJobDto])
  jobs: CoachingAnalysisJobDto[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  offset: number;
}

@ObjectType()
export class CoachingSessionDto {
  @Field(() => Int)
  id: number;

  @Field()
  s3KeyOriginal: string;

  @Field({ nullable: true })
  roomName?: string;

  @Field(() => Int, { nullable: true })
  commercialId?: number;

  @Field({ nullable: true })
  commercialNom?: string;

  @Field(() => Int, { nullable: true })
  directeurId?: number;

  @Field(() => Int)
  salesPlanVersionId: number;

  @Field({ nullable: true })
  salesPlanNom?: string;

  @Field({ nullable: true })
  salesPlanVersionLabel?: string;

  @Field(() => CoachingSessionStatusDto)
  status: CoachingSessionStatusDto;

  @Field(() => CoachingReviewStatusDto)
  reviewStatus: CoachingReviewStatusDto;

  @Field(() => Float, { nullable: true })
  confidenceScore?: number;

  @Field({ nullable: true })
  identificationSource?: string;

  @Field({ nullable: true })
  transcriptText?: string;

  @Field({ nullable: true })
  readableTranscriptText?: string;

  @Field(() => Float, { nullable: true })
  transcriptDurationSec?: number;

  @Field(() => Int, { nullable: true })
  whisperSegmentsCount?: number;

  @Field(() => Int, { nullable: true })
  overallScore?: number;

  @Field(() => Int, { nullable: true })
  planCoverageScore?: number;

  @Field(() => Int, { nullable: true })
  executionQualityScore?: number;

  @Field(() => Int, { nullable: true })
  objectionHandlingScore?: number;

  @Field(() => Int, { nullable: true })
  listeningRatioScore?: number;

  @Field(() => Int, { nullable: true })
  closingScore?: number;

  @Field({ nullable: true })
  summary?: string;

  @Field(() => [String])
  strengths: string[];

  @Field(() => [String])
  improvements: string[];

  @Field(() => [String])
  recommendations: string[];

  @Field({ nullable: true })
  llmModel?: string;

  @Field({ nullable: true })
  scoringMode?: string;

  @Field({ nullable: true })
  scoringSchemaVersion?: string;

  @Field({ nullable: true })
  evidencePromptVersion?: string;

  @Field({ nullable: true })
  evaluationPromptVersion?: string;

  @Field({ nullable: true })
  failureReason?: string;

  @Field({ nullable: true })
  reviewReason?: string;

  @Field({ nullable: true })
  reviewNotes?: string;

  @Field({ nullable: true })
  audioUrl?: string;

  @Field()
  launchedAt: Date;

  @Field({ nullable: true })
  processedAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => CoachingAnalysisJobDto, { nullable: true })
  analysisJob?: CoachingAnalysisJobDto;

  @Field(() => [CoachingAnalysisPipelineStepDto])
  pipelineSteps: CoachingAnalysisPipelineStepDto[];

  @Field(() => [CoachingStepEvaluationDto])
  stepEvaluations: CoachingStepEvaluationDto[];

  @Field(() => [CoachingKeyMomentDto])
  keyMoments: CoachingKeyMomentDto[];

  @Field(() => [CoachingConversationEvaluationDto])
  conversationEvaluations: CoachingConversationEvaluationDto[];
}

@ObjectType()
export class CoachingSessionsPageDto {
  @Field(() => [CoachingSessionDto])
  items: CoachingSessionDto[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  offset: number;
}
