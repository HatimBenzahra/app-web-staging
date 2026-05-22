import { Field, Float, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ArrayMinSize, IsArray, IsBoolean, IsDate, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { CoachingAnalysisJobStatusDto, CoachingRecordingExploitabilityStatusDto, CoachingSessionStatusDto, SalesPlanStatusDto, SalesPlanVersionStatusDto } from './coaching.enums.dto';

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

  @Field(() => Int, { nullable: true })
  speechScore?: number;

  @Field({ nullable: true })
  speechScoreStatus?: string;

  @Field(() => Float, { nullable: true })
  totalDurationSec?: number;

  @Field(() => Float, { nullable: true })
  speechDurationSec?: number;

  @Field(() => Float)
  exploitabilityScore: number;

  @Field(() => CoachingRecordingExploitabilityStatusDto)
  exploitabilityStatus: CoachingRecordingExploitabilityStatusDto;

  @Field(() => [String])
  exploitabilityReasons: string[];

  @Field(() => Int, { nullable: true })
  analysisJobId?: number;

  @Field(() => CoachingAnalysisJobStatusDto, { nullable: true })
  analysisJobStatus?: CoachingAnalysisJobStatusDto;

  @Field({ nullable: true })
  analysisQueuedAt?: Date;

  @Field({ nullable: true })
  analysisStartedAt?: Date;
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

