import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CoachingService } from './coaching.service';
import {
  CoachingSalesPlanDto,
  CoachingSessionDto,
  LaunchCoachingAnalysisInput,
  ListCoachingSessionsInput,
  PaginatedCoachingSessionsResult,
} from './coaching.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoachingResolver {
  constructor(private readonly coachingService: CoachingService) {}

  @Query(() => CoachingSalesPlanDto)
  @Roles('admin', 'directeur')
  activeCoachingSalesPlan(): Promise<CoachingSalesPlanDto> {
    return this.coachingService.activeCoachingSalesPlan();
  }

  @Query(() => PaginatedCoachingSessionsResult)
  @Roles('admin', 'directeur')
  coachingSessions(
    @Args('input', { nullable: true }) input: ListCoachingSessionsInput,
    @CurrentUser() user: any,
  ): Promise<PaginatedCoachingSessionsResult> {
    return this.coachingService.listSessions(input ?? {}, user);
  }

  @Query(() => CoachingSessionDto)
  @Roles('admin', 'directeur')
  coachingSession(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: any,
  ): Promise<CoachingSessionDto> {
    return this.coachingService.getSession(id, user);
  }

  @Mutation(() => CoachingSessionDto)
  @Roles('admin', 'directeur')
  launchCoachingAnalysis(
    @Args('input') input: LaunchCoachingAnalysisInput,
    @CurrentUser() user: any,
  ): Promise<CoachingSessionDto> {
    return this.coachingService.launchCoachingAnalysis(input, user);
  }

  @Mutation(() => CoachingSessionDto)
  @Roles('admin', 'directeur')
  relaunchCoachingAnalysis(
    @Args('sessionId', { type: () => Int }) sessionId: number,
    @CurrentUser() user: any,
  ): Promise<CoachingSessionDto> {
    return this.coachingService.relaunchCoachingAnalysis(sessionId, user);
  }
}
