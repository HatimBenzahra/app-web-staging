import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GpsTrackingService } from './gps-tracking.service';
import {
  GpsPosition,
  GpsHistoryResponse,
  SaveGpsPositionsInput,
  SaveGpsPositionsResponse,
  DeviceMapping,
  SetDeviceCommercialInput,
} from './gps-tracking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Resolver(() => GpsPosition)
@UseGuards(JwtAuthGuard, RolesGuard)
export class GpsTrackingResolver {
  constructor(private readonly gpsTrackingService: GpsTrackingService) {}

  @Mutation(() => SaveGpsPositionsResponse)
  @Roles('admin', 'directeur')
  saveGpsPositions(@Args('input') input: SaveGpsPositionsInput) {
    return this.gpsTrackingService.savePositions(input.positions);
  }

  @Query(() => GpsHistoryResponse, { name: 'gpsHistory' })
  @Roles('admin', 'directeur')
  getGpsHistory(
    @Args('deviceId') deviceId: string,
    @Args('from', { nullable: true }) from?: string,
    @Args('to', { nullable: true }) to?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.gpsTrackingService.getHistory(deviceId, from, to, limit);
  }

  @Query(() => GpsHistoryResponse, { name: 'gpsDailyRoute' })
  @Roles('admin', 'directeur')
  getDailyRoute(@Args('deviceId') deviceId: string, @Args('date') date: string) {
    return this.gpsTrackingService.getDailyRoute(deviceId, date);
  }

  @Query(() => [GpsPosition], { name: 'gpsLatestPositions' })
  @Roles('admin', 'directeur')
  getLatestPositions() {
    return this.gpsTrackingService.getLatestPositions();
  }

  @Query(() => GpsHistoryResponse, { name: 'gpsAllPositions' })
  @Roles('admin', 'directeur')
  getAllPositions(
    @Args('from') from: string,
    @Args('to') to: string,
    @Args('deviceId', { nullable: true }) deviceId?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.gpsTrackingService.getAllPositions(from, to, deviceId, limit);
  }

  @Query(() => [GpsPosition], { name: 'gpsDevices' })
  @Roles('admin', 'directeur')
  getDeviceIds() {
    return this.gpsTrackingService.getDeviceIds();
  }

  @Query(() => [DeviceMapping], { name: 'deviceMappings' })
  @Roles('admin', 'directeur')
  getDeviceMappings() {
    return this.gpsTrackingService.getDeviceMappings();
  }

  @Mutation(() => DeviceMapping)
  @Roles('admin', 'directeur')
  setDeviceCommercial(@Args('input') input: SetDeviceCommercialInput) {
    return this.gpsTrackingService.setDeviceCommercial(input.deviceId, input.commercialName);
  }

  @Mutation(() => DeviceMapping)
  @Roles('admin', 'directeur')
  removeDeviceMapping(@Args('deviceId') deviceId: string) {
    return this.gpsTrackingService.removeDeviceMapping(deviceId);
  }
}
