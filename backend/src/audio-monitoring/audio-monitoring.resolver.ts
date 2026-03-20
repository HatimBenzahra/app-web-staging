import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AudioMonitoringService } from './audio-monitoring.service';
import {
  MonitoringSession,
  LiveKitConnectionDetails,
  StartMonitoringInput,
  StopMonitoringInput,
  ActiveRoom,
} from './audio-monitoring.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AudioMonitoringResolver {
  constructor(private audioMonitoringService: AudioMonitoringService) {}

  @Mutation(() => LiveKitConnectionDetails)
  @Roles('admin', 'directeur', 'manager')
  async startMonitoring(
    @Args('input') input: StartMonitoringInput,
    @CurrentUser() user: any,
  ) {
    return this.audioMonitoringService.startMonitoring(input, user);
  }

  @Mutation(() => Boolean)
  @Roles('admin', 'directeur', 'manager')
  async stopMonitoring(
    @Args('input') input: StopMonitoringInput,
    @CurrentUser() user: any,
  ) {
    return this.audioMonitoringService.stopMonitoring(input.sessionId, user);
  }

  @Query(() => [MonitoringSession])
  @Roles('admin', 'directeur', 'manager')
  async getActiveSessions(@CurrentUser() user: any) {
    return this.audioMonitoringService.getActiveSessions(user);
  }

  @Query(() => [ActiveRoom])
  @Roles('admin', 'directeur', 'manager')
  async getActiveRooms(@CurrentUser() user: any) {
    return this.audioMonitoringService.getActiveRooms(user);
  }

  @Mutation(() => LiveKitConnectionDetails)
  @Roles('commercial')
  async generateCommercialToken(
    @Args('commercialId', { type: () => Int, nullable: true })
    commercialId: number | undefined,
    @Args('roomName', { nullable: true }) roomName?: string,
    @CurrentUser() user?: any,
  ) {
    return this.audioMonitoringService.generateCommercialToken(
      commercialId,
      roomName,
      user,
    );
  }

  @Mutation(() => LiveKitConnectionDetails)
  @Roles('manager')
  async generateManagerToken(
    @Args('managerId', { type: () => Int, nullable: true })
    managerId: number | undefined,
    @Args('roomName', { nullable: true }) roomName?: string,
    @CurrentUser() user?: any,
  ) {
    return this.audioMonitoringService.generateManagerToken(
      managerId,
      roomName,
      user,
    );
  }

  @Mutation(() => Boolean)
  @Roles('commercial', 'manager')
  async logAudioEvent(
    @Args('eventType') eventType: string,
    @Args('message') message: string,
    @Args('details', { nullable: true }) details?: string,
    @CurrentUser() user?: any,
  ) {
    return this.audioMonitoringService.logAudioEvent(
      eventType,
      message,
      details,
      user,
    );
  }
}
