import {
  Field,
  Float,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SalesPlanStatusDto {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum SalesPlanVersionStatusDto {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum CoachingSessionStatusDto {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
}

export enum CoachingReviewStatusDto {
  NOT_REQUIRED = 'NOT_REQUIRED',
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED',
}

export enum CoachingStepCoverageStatusDto {
  COVERED = 'COVERED',
  PARTIAL = 'PARTIAL',
  MISSING = 'MISSING',
}

export enum CoachingConversationStatusDto {
  COMPLETED = 'COMPLETED',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  SKIPPED = 'SKIPPED',
  FAILED = 'FAILED',
}

export enum CoachingReviewActionDto {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

registerEnumType(SalesPlanStatusDto, { name: 'SalesPlanStatusDto' });
registerEnumType(SalesPlanVersionStatusDto, {
  name: 'SalesPlanVersionStatusDto',
});
registerEnumType(CoachingSessionStatusDto, {
  name: 'CoachingSessionStatusDto',
});
registerEnumType(CoachingReviewStatusDto, {
  name: 'CoachingReviewStatusDto',
});
registerEnumType(CoachingStepCoverageStatusDto, {
  name: 'CoachingStepCoverageStatusDto',
});
registerEnumType(CoachingConversationStatusDto, {
  name: 'CoachingConversationStatusDto',
});
registerEnumType(CoachingReviewActionDto, {
  name: 'CoachingReviewActionDto',
});

@InputType()
export class SalesPlanStepInput {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  ordre?: number;

  @Field()
  @IsString()
  @IsNotEmpty()
  titre: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  expectedSignals?: string;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  poids?: number;
}

@InputType()
export class CreateSalesPlanInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  nom: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  versionLabel?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  promptInstructions?: string;

  @Field(() => [SalesPlanStepInput])
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesPlanStepInput)
  steps: SalesPlanStepInput[];

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  publishNow?: boolean;
}

@InputType()
export class CreateSalesPlanVersionInput {
  @Field(() => Int)
  @IsInt()
  salesPlanId: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  label?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  promptInstructions?: string;

  @Field(() => [SalesPlanStepInput])
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesPlanStepInput)
  steps: SalesPlanStepInput[];

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  publishNow?: boolean;
}

@InputType()
export class LaunchCoachingAnalysisInput {
  @Field(() => Int)
  @IsInt()
  salesPlanVersionId: number;

  @Field()
  @IsString()
  @IsNotEmpty()
  s3KeyOriginal: string;
}

@InputType()
export class ReviewCoachingSessionInput {
  @Field(() => Int)
  @IsInt()
  sessionId: number;

  @Field(() => CoachingReviewActionDto)
  action: CoachingReviewActionDto;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  commercialId?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

@InputType()
export class CoachingRecordingCandidatesInput {
  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;
}

@ObjectType()
export class SalesPlanStepDto {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  ordre: number;

  @Field()
  titre: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  expectedSignals?: string;

  @Field(() => Int)
  poids: number;
}

@ObjectType()
export class SalesPlanVersionDto {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  versionNumber: number;

  @Field({ nullable: true })
  label?: string;

  @Field(() => SalesPlanVersionStatusDto)
  status: SalesPlanVersionStatusDto;

  @Field({ nullable: true })
  promptInstructions?: string;

  @Field({ nullable: true })
  publishedAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => [SalesPlanStepDto])
  steps: SalesPlanStepDto[];
}

@ObjectType()
export class SalesPlanDto {
  @Field(() => Int)
  id: number;

  @Field()
  nom: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => SalesPlanStatusDto)
  status: SalesPlanStatusDto;

  @Field(() => [SalesPlanVersionDto])
  versions: SalesPlanVersionDto[];
}

@ObjectType()
export class CoachingRecordingCandidateDto {
  @Field()
  key: string;

  @Field({ nullable: true })
  roomName?: string;

  @Field(() => Int, { nullable: true })
  commercialId?: number;

  @Field({ nullable: true })
  commercialNom?: string;

  @Field({ nullable: true })
  commercialEmail?: string;

  @Field({ nullable: true })
  lastModified?: Date;

  @Field(() => Float, { nullable: true })
  size?: number;

  @Field(() => Int, { nullable: true })
  latestSessionId?: number;

  @Field(() => CoachingSessionStatusDto, { nullable: true })
  latestSessionStatus?: CoachingSessionStatusDto;
}

@ObjectType()
export class CoachingRecordingCandidatesPageDto {
  @Field(() => [CoachingRecordingCandidateDto])
  items: CoachingRecordingCandidateDto[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  offset: number;
}

@ObjectType()
export class CoachingStepEvaluationDto {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  ordre: number;

  @Field()
  titre: string;

  @Field(() => CoachingStepCoverageStatusDto)
  coverageStatus: CoachingStepCoverageStatusDto;

  @Field(() => Int, { nullable: true })
  score?: number;

  @Field({ nullable: true })
  verbatim?: string;

  @Field({ nullable: true })
  feedback?: string;

  @Field({ nullable: true })
  recommendation?: string;
}

@ObjectType()
export class CoachingConversationEvaluationDto {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  ordre: number;

  @Field({ nullable: true })
  title?: string;

  @Field(() => Float, { nullable: true })
  startTime?: number;

  @Field(() => Float, { nullable: true })
  endTime?: number;

  @Field({ nullable: true })
  transcriptText?: string;

  @Field({ nullable: true })
  readableTranscriptText?: string;

  @Field(() => CoachingConversationStatusDto)
  status: CoachingConversationStatusDto;

  @Field({ nullable: true })
  reviewReason?: string;

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

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
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

  @Field(() => [CoachingStepEvaluationDto])
  stepEvaluations: CoachingStepEvaluationDto[];

  @Field(() => [CoachingConversationEvaluationDto])
  conversationEvaluations: CoachingConversationEvaluationDto[];
}
