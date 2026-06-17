import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CoachingSalesPlanVersionDto {
  @Field(() => Int) id: number;
  @Field(() => Int) salesPlanId: number;
  @Field(() => Int) version: number;
  @Field() title: string;
  @Field(() => [String]) criteria: string[];
  @Field({ nullable: true }) prompt?: string;
  @Field() isActive: boolean;
  @Field() createdAt: Date;
  @Field() updatedAt: Date;
}

@ObjectType()
export class CoachingSalesPlanDto {
  @Field(() => Int) id: number;
  @Field() name: string;
  @Field({ nullable: true }) description?: string;
  @Field() isDefault: boolean;
  @Field(() => CoachingSalesPlanVersionDto, { nullable: true })
  activeVersion?: CoachingSalesPlanVersionDto;
  @Field() createdAt: Date;
  @Field() updatedAt: Date;
}

@ObjectType()
export class CoachingConversationEvaluationDto {
  @Field(() => Int) id: number;
  @Field(() => Int) sessionId: number;
  @Field(() => Int, { nullable: true }) segmentId?: number;
  @Field(() => Int) orderIndex: number;
  @Field({ nullable: true }) title?: string;
  @Field() status: string;
  @Field(() => Int, { nullable: true }) score?: number;
  @Field({ nullable: true }) summary?: string;
  @Field(() => [String]) strengths: string[];
  @Field(() => [String]) improvements: string[];
  @Field(() => [String]) recommendations: string[];
  @Field({ nullable: true }) transcriptText?: string;
  @Field({ nullable: true }) readableTranscriptText?: string;
  @Field({ nullable: true }) statut?: string;
  @Field(() => Int, { nullable: true }) porteId?: number;
  @Field({ nullable: true }) startTime?: number;
  @Field({ nullable: true }) endTime?: number;
  @Field({ nullable: true }) durationSec?: number;
  @Field() createdAt: Date;
  @Field() updatedAt: Date;
}

@ObjectType()
export class CoachingSessionDto {
  @Field(() => Int) id: number;
  @Field(() => Int, { nullable: true }) recordingId?: number;
  @Field() s3KeyOriginal: string;
  @Field(() => Int) salesPlanVersionId: number;
  @Field() status: string;
  @Field(() => Int, { nullable: true }) score?: number;
  @Field({ nullable: true }) summary?: string;
  @Field(() => [String]) strengths: string[];
  @Field(() => [String]) improvements: string[];
  @Field(() => [String]) recommendations: string[];
  @Field({ nullable: true }) error?: string;
  @Field({ nullable: true }) analyzedAt?: Date;
  @Field(() => Int, { nullable: true }) launchedById?: number;
  @Field({ nullable: true }) launchedByRole?: string;
  @Field(() => Int, { nullable: true }) commercialId?: number;
  @Field(() => Int, { nullable: true }) managerId?: number;
  @Field(() => Int, { nullable: true }) directeurId?: number;
  @Field(() => [CoachingConversationEvaluationDto])
  conversations: CoachingConversationEvaluationDto[];
  @Field(() => CoachingSalesPlanVersionDto, { nullable: true })
  salesPlanVersion?: CoachingSalesPlanVersionDto;
  @Field() createdAt: Date;
  @Field() updatedAt: Date;
}

@ObjectType()
export class PaginatedCoachingSessionsResult {
  @Field(() => [CoachingSessionDto]) items: CoachingSessionDto[];
  @Field(() => Int) totalCount: number;
}

@InputType()
export class ListCoachingSessionsInput {
  @Field(() => Int, { nullable: true, defaultValue: 30 })
  limit?: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  offset?: number;
}

@InputType()
export class LaunchCoachingAnalysisInput {
  @Field() s3KeyOriginal: string;

  @Field(() => Int, { nullable: true })
  salesPlanVersionId?: number;
}
