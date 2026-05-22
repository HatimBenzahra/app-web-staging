import { Field, Float, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ArrayMinSize, IsArray, IsBoolean, IsDate, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { CoachingConversationStatusDto, CoachingReviewStatusDto, CoachingStepCoverageStatusDto } from './coaching.enums.dto';

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

  @Field(() => Float, { nullable: true })
  startTime?: number;

  @Field(() => Float, { nullable: true })
  endTime?: number;

  @Field({ nullable: true })
  verbatim?: string;

  @Field({ nullable: true })
  feedback?: string;

  @Field({ nullable: true })
  recommendation?: string;
}

@ObjectType()
export class CoachingCriterionEvidenceDto {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  stepOrder: number;

  @Field()
  criterionKey: string;

  @Field()
  criterionLabel: string;

  @Field()
  found: boolean;

  @Field()
  quality: string;

  @Field(() => Float)
  confidence: number;

  @Field({ nullable: true })
  verbatim?: string;

  @Field(() => Float, { nullable: true })
  startTime?: number;

  @Field(() => Float, { nullable: true })
  endTime?: number;

  @Field({ nullable: true })
  reason?: string;

  @Field({ nullable: true })
  evidenceCompleteness?: string;

  @Field({ nullable: true })
  missingBecause?: string;

  @Field()
  scoreable: boolean;

  @Field(() => [String])
  sourceTurnIds: string[];

  @Field()
  reviewStatus: string;
}

@ObjectType()
export class CoachingKeyMomentDto {
  @Field(() => Int)
  id: number;

  @Field()
  type: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  summary?: string;

  @Field(() => Float, { nullable: true })
  startTime?: number;

  @Field(() => Float, { nullable: true })
  endTime?: number;

  @Field({ nullable: true })
  verbatim?: string;

  @Field(() => Int, { nullable: true })
  importance?: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class CoachingDialogueNormalizationDto {
  @Field()
  raw: string;

  @Field()
  normalized: string;

  @Field()
  type: string;

  @Field(() => Float)
  confidence: number;

  @Field()
  meaningChanged: boolean;

  @Field({ nullable: true })
  reason?: string;
}

@ObjectType()
export class CoachingDialogueTurnDto {
  @Field()
  speaker: string;

  @Field(() => Float, { nullable: true })
  startTime?: number;

  @Field(() => Float, { nullable: true })
  endTime?: number;

  @Field()
  text: string;

  @Field({ nullable: true })
  rawText?: string;

  @Field({ nullable: true })
  normalizedText?: string;

  @Field({ nullable: true })
  sourceQuote?: string;

  @Field(() => Float)
  confidence: number;

  @Field(() => Float, { nullable: true })
  speakerConfidence?: number;

  @Field(() => Float, { nullable: true })
  textConfidence?: number;

  @Field({ nullable: true })
  correctionLevel?: string;

  @Field(() => [CoachingDialogueNormalizationDto])
  normalizations: CoachingDialogueNormalizationDto[];

  @Field()
  scorable: boolean;

  @Field()
  displayable: boolean;

  @Field({ nullable: true })
  blockType?: string;

  @Field({ nullable: true })
  exclusionReason?: string;

  @Field({ nullable: true })
  reason?: string;
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

  @Field(() => [CoachingDialogueTurnDto])
  dialogueTurns: CoachingDialogueTurnDto[];

  @Field({ nullable: true })
  dialoguePromptVersion?: string;

  @Field({ nullable: true })
  dialogueRawResponse?: string;

  @Field({ nullable: true })
  conversationKind?: string;

  @Field(() => Boolean, { nullable: true })
  usableForScoring?: boolean;

  @Field({ nullable: true })
  scoreabilityReason?: string;

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

  @Field({ nullable: true })
  scoringMode?: string;

  @Field({ nullable: true })
  scoringSchemaVersion?: string;

  @Field({ nullable: true })
  evidencePromptVersion?: string;

  @Field({ nullable: true })
  evaluationPromptVersion?: string;

  @Field(() => [CoachingCriterionEvidenceDto])
  criterionEvidences: CoachingCriterionEvidenceDto[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

