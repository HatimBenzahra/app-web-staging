import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CoachingService } from './coaching.service';
import {
  CoachingRecordingCandidatesInput,
  CoachingRecordingCandidatesPageDto,
  CoachingQueueStateDto,
  CoachingSessionDto,
  CreateSalesPlanInput,
  CreateSalesPlanVersionInput,
  LaunchCoachingAnalysisInput,
  ReviewCoachingSessionInput,
  SalesPlanDto,
} from './coaching.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoachingResolver {
  constructor(private readonly coachingService: CoachingService) {}

  @Query(() => [SalesPlanDto])
  @Roles('admin', 'directeur')
  coachingSalesPlans(@CurrentUser() currentUser: any): Promise<SalesPlanDto[]> {
    return this.coachingService.getSalesPlans(currentUser);
  }

  @Mutation(() => SalesPlanDto)
  @Roles('admin', 'directeur')
  createCoachingSalesPlan(
    @Args('input') input: CreateSalesPlanInput,
    @CurrentUser() currentUser: any,
  ): Promise<SalesPlanDto> {
    return this.coachingService.createSalesPlan(input, currentUser);
  }

  @Mutation(() => SalesPlanDto)
  @Roles('admin', 'directeur')
  createCoachingSalesPlanVersion(
    @Args('input') input: CreateSalesPlanVersionInput,
    @CurrentUser() currentUser: any,
  ): Promise<SalesPlanDto> {
    return this.coachingService.createSalesPlanVersion(input, currentUser);
  }

  @Mutation(() => SalesPlanDto)
  @Roles('admin', 'directeur')
  publishCoachingSalesPlanVersion(
    @Args('versionId', { type: () => Int }) versionId: number,
    @CurrentUser() currentUser: any,
  ): Promise<SalesPlanDto> {
    return this.coachingService.publishSalesPlanVersion(versionId, currentUser);
  }

  @Query(() => CoachingRecordingCandidatesPageDto)
  @Roles('admin', 'directeur')
  coachingRecordingCandidates(
    @Args('input', { nullable: true }) input: CoachingRecordingCandidatesInput,
    @CurrentUser() currentUser: any,
  ): Promise<CoachingRecordingCandidatesPageDto> {
    return this.coachingService.getRecordingCandidates(input, currentUser);
  }

  @Query(() => [CoachingSessionDto])
  @Roles('admin', 'directeur')
  coachingSessions(
    @CurrentUser() currentUser: any,
  ): Promise<CoachingSessionDto[]> {
    return this.coachingService.getCoachingSessions(currentUser);
  }

  @Query(() => CoachingQueueStateDto)
  @Roles('admin', 'directeur')
  coachingAnalysisQueue(
    @CurrentUser() currentUser: any,
  ): Promise<CoachingQueueStateDto> {
    return this.coachingService.getAnalysisQueue(currentUser);
  }

  @Query(() => CoachingSessionDto)
  @Roles('admin', 'directeur')
  coachingSession(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser: any,
  ): Promise<CoachingSessionDto> {
    return this.coachingService.getCoachingSession(id, currentUser);
  }

  @Mutation(() => CoachingSessionDto)
  @Roles('admin', 'directeur')
  launchCoachingAnalysis(
    @Args('input') input: LaunchCoachingAnalysisInput,
    @CurrentUser() currentUser: any,
  ): Promise<CoachingSessionDto> {
    return this.coachingService.launchCoachingAnalysis(input, currentUser);
  }

  @Mutation(() => CoachingSessionDto)
  @Roles('admin', 'directeur')
  relaunchCoachingAnalysis(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser: any,
  ): Promise<CoachingSessionDto> {
    return this.coachingService.relaunchCoachingAnalysis(id, currentUser);
  }

  @Mutation(() => CoachingSessionDto)
  @Roles('admin', 'directeur')
  reviewCoachingSession(
    @Args('input') input: ReviewCoachingSessionInput,
    @CurrentUser() currentUser: any,
  ): Promise<CoachingSessionDto> {
    return this.coachingService.reviewCoachingSession(input, currentUser);
  }
}
