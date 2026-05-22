import { Field, Float, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ArrayMinSize, IsArray, IsBoolean, IsDate, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { CoachingRecordingPeriodDto, CoachingReviewActionDto, CoachingReviewStatusDto } from './coaching.enums.dto';

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
  @MaxLength(2000, {
    message: 'promptInstructions ne peut dépasser 2000 caractères',
  })
  @Matches(
    /^(?!.*(ignore\s+(previous|all)\s+(instructions|prompts)|disregard\s+previous|forget\s+previous|system\s*:)).*$/is,
    {
      message:
        'promptInstructions contient des motifs interdits (tentative d\'injection)',
    },
  )
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
  @MaxLength(2000, {
    message: 'promptInstructions ne peut dépasser 2000 caractères',
  })
  @Matches(
    /^(?!.*(ignore\s+(previous|all)\s+(instructions|prompts)|disregard\s+previous|forget\s+previous|system\s*:)).*$/is,
    {
      message:
        'promptInstructions contient des motifs interdits (tentative d\'injection)',
    },
  )
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
export class ReviewCoachingCriterionEvidenceInput {
  @Field(() => Int)
  @IsInt()
  evidenceId: number;

  @Field()
  @IsString()
  reviewStatus: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
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

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  commercialId?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  analysisStatus?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  speechLevel?: string;

  @Field(() => CoachingRecordingPeriodDto, {
    nullable: true,
    defaultValue: CoachingRecordingPeriodDto.LAST_7_DAYS,
  })
  @IsOptional()
  period?: CoachingRecordingPeriodDto;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  from?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  to?: Date;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  includeLowValue?: boolean;
}

@InputType()
export class CoachingSessionsInput {
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

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field(() => CoachingReviewStatusDto, { nullable: true })
  @IsOptional()
  reviewStatus?: CoachingReviewStatusDto;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  scoreLevel?: string;
}

@InputType()
export class CoachingAnalysisQueueInput {
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
}
