import { Field, Float, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ArrayMinSize, IsArray, IsBoolean, IsDate, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
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

export enum CoachingAnalysisJobStatusDto {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum CoachingRecordingPeriodDto {
  TODAY = 'TODAY',
  LAST_7_DAYS = 'LAST_7_DAYS',
  LAST_30_DAYS = 'LAST_30_DAYS',
  CUSTOM = 'CUSTOM',
  ALL = 'ALL',
}

export enum CoachingRecordingExploitabilityStatusDto {
  PRIORITY = 'PRIORITY',
  GOOD = 'GOOD',
  LOW_VALUE = 'LOW_VALUE',
  ALREADY_ANALYZED = 'ALREADY_ANALYZED',
  REVIEW = 'REVIEW',
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
registerEnumType(CoachingAnalysisJobStatusDto, {
  name: 'CoachingAnalysisJobStatusDto',
});
registerEnumType(CoachingRecordingPeriodDto, {
  name: 'CoachingRecordingPeriodDto',
});
registerEnumType(CoachingRecordingExploitabilityStatusDto, {
  name: 'CoachingRecordingExploitabilityStatusDto',
});
