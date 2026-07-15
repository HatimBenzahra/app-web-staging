import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GpsTrackingService } from './gps-tracking.service';
import { GpsPosition, ReportPositionInput } from './gps-tracking.dto';
import { UserType } from '../zone/zone.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Resolver(() => GpsPosition)
@UseGuards(JwtAuthGuard, RolesGuard)
export class GpsTrackingResolver {
  constructor(private readonly gpsTrackingService: GpsTrackingService) {}

  // Remontee des positions par l'app mobile (batch => flush hors-ligne).
  // L'identite de l'acteur provient EXCLUSIVEMENT du token (user.id + user.role) :
  // on ne fait jamais confiance a un id fourni par le client.
  @Mutation(() => Int, { name: 'reportMyPositions' })
  @Roles('commercial', 'manager')
  reportMyPositions(
    @CurrentUser() user: { id: number; role: string },
    @Args('input', { type: () => [ReportPositionInput] })
    input: ReportPositionInput[],
  ) {
    const userType =
      user.role === 'manager' ? UserType.MANAGER : UserType.COMMERCIAL;
    return this.gpsTrackingService.saveForActor(user.id, userType, input);
  }

  @Query(() => [GpsPosition], { name: 'gpsLatestActorPositions' })
  @Roles('admin', 'directeur', 'manager')
  getLatestActorPositions() {
    return this.gpsTrackingService.getLatestActorPositions();
  }

  @Query(() => [GpsPosition], { name: 'gpsDailyRouteByActor' })
  @Roles('admin', 'directeur', 'manager')
  getDailyRouteByActor(
    @Args('userId', { type: () => Int }) userId: number,
    @Args('userType', { type: () => UserType }) userType: UserType,
    @Args('date') date: string,
  ) {
    return this.gpsTrackingService.getDailyRouteByActor(userId, userType, date);
  }

  @Query(() => [GpsPosition], { name: 'gpsRouteByActor' })
  @Roles('admin', 'directeur', 'manager')
  getRouteByActor(
    @Args('userId', { type: () => Int }) userId: number,
    @Args('userType', { type: () => UserType }) userType: UserType,
    @Args('from') from: string,
    @Args('to') to: string,
  ) {
    return this.gpsTrackingService.getRouteByActor(userId, userType, from, to);
  }
}
