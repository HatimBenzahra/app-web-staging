import {
  Field,
  Float,
  InputType,
  Int,
  ObjectType,
} from '@nestjs/graphql';

@ObjectType()
export class CoachingSubScoreDto {
  @Field() key: string;
  @Field() label: string;
  @Field(() => Int) weight: number;
  @Field() applicable: boolean;
  @Field(() => Float, { nullable: true }) score?: number | null;
}

@ObjectType()
export class CoachingCriterionResultDto {
  @Field() stepKey: string;
  @Field() criterionKey: string;
  @Field() title: string;
  @Field() status: string;
  @Field(() => Int) maxPoints: number;
  @Field(() => Float) score: number;
  @Field(() => Int) weightStep: number;
  @Field(() => [String]) evidence: string[];
  @Field(() => String, { nullable: true }) comment?: string;
}

@ObjectType()
export class CoachingAnalysisDto {
  @Field(() => Int) id: number;
  @Field(() => Int) recordingId: number;
  @Field(() => Int, { nullable: true }) porteId?: number | null;
  @Field(() => Int, { nullable: true }) commercialId?: number | null;
  @Field(() => Int, { nullable: true }) managerId?: number | null;
  @Field() s3KeyOriginal: string;
  @Field(() => String, { nullable: true }) statutPorte?: string | null;
  @Field() status: string;
  @Field(() => String, { nullable: true }) quality?: string | null;
  @Field(() => Float, { nullable: true }) score?: number | null;
  @Field(() => Float, { nullable: true }) confidence?: number | null;
  @Field(() => String, { nullable: true }) summary?: string | null;
  @Field(() => [String]) strengths: string[];
  @Field(() => [String]) improvements: string[];
  @Field(() => [String]) recommendations: string[];
  @Field(() => [CoachingSubScoreDto]) subScores: CoachingSubScoreDto[];
  @Field(() => [CoachingCriterionResultDto])
  criterionResults: CoachingCriterionResultDto[];
  @Field(() => String, { nullable: true }) transcript?: string | null;
  @Field(() => Float, { nullable: true }) transcriptDurationSec?: number | null;
  @Field(() => String, { nullable: true }) error?: string | null;
  @Field() planSlug: string;
  @Field(() => Int) planVersion: number;
  @Field() createdAt: string;
  @Field() updatedAt: string;
  // Sujet de l'analyse (commercial ou manager qui a enregistré).
  @Field(() => String, { nullable: true }) subjectName?: string | null;
  @Field(() => String, { nullable: true }) subjectRole?: string | null; // 'commercial' | 'manager'
  @Field(() => Int, { nullable: true }) subjectId?: number | null;
}

@ObjectType()
export class PaginatedCoachingAnalyses {
  @Field(() => [CoachingAnalysisDto]) items: CoachingAnalysisDto[];
  @Field(() => Int) total: number;
}

/** Un audio en attente ou en cours de traitement (pile interrogeable). */
@ObjectType()
export class CoachingQueueItemDto {
  @Field(() => Int) id: number;
  @Field() status: string;
  @Field() s3KeyOriginal: string;
  @Field(() => String, { nullable: true }) subjectName?: string | null;
  @Field(() => String, { nullable: true }) subjectRole?: string | null;
  @Field(() => Int, { nullable: true }) subjectId?: number | null;
  @Field(() => String, { nullable: true }) statutPorte?: string | null;
  @Field(() => Float, { nullable: true }) durationSec?: number | null;
  @Field() createdAt: string;
}

@ObjectType()
export class CoachingStatsDto {
  @Field(() => Int) pending: number; // en file
  @Field(() => Int) processing: number; // transcription + analyse en cours
  @Field(() => Int) ready: number; // analysés
  @Field(() => Int) failed: number; // échecs
  @Field(() => Int) inexploitable: number;
  @Field(() => Int) total: number;
  @Field(() => Float, { nullable: true }) avgScore?: number | null;
}

@ObjectType()
export class CoachingConfigDto {
  @Field(() => [String]) coachableStatuts: string[];
  @Field(() => [String]) allStatuts: string[];
  @Field(() => Int) minAutoDurationSec: number; // durée min (s) pour l'analyse auto
}

@ObjectType()
export class SalesPlanCriterionDto {
  @Field() key: string;
  @Field() label: string;
  @Field(() => Int) points: number;
  @Field() evidenceRequired: boolean;
  @Field() appliesWhen: string;
}

@ObjectType()
export class SalesPlanStepDto {
  @Field() key: string;
  @Field() label: string;
  @Field(() => Int) weight: number;
  @Field() appliesWhen: string;
  @Field(() => [SalesPlanCriterionDto]) criteria: SalesPlanCriterionDto[];
}

@ObjectType()
export class ActiveSalesPlanDto {
  @Field() slug: string;
  @Field() title: string;
  @Field(() => Int) version: number;
  @Field(() => Int) scoringScale: number;
  @Field(() => [SalesPlanStepDto]) steps: SalesPlanStepDto[];
}

@InputType()
export class CoachingAnalysesFilter {
  @Field(() => Int, { nullable: true, defaultValue: 0 }) skip?: number;
  @Field(() => Int, { nullable: true, defaultValue: 20 }) take?: number;
  @Field(() => Int, { nullable: true }) commercialId?: number;
  @Field(() => Int, { nullable: true }) managerId?: number;
  @Field(() => Int, { nullable: true }) porteId?: number;
  @Field(() => String, { nullable: true }) status?: string;
}
