import { Module } from '@nestjs/common'
import { AudioMonitoringService } from './audio-monitoring.service'
import { AudioMonitoringResolver } from './audio-monitoring.resolver'
import { LiveKitService } from './livekit.service'
import { PrismaService } from '../prisma.service'

@Module({
  providers: [AudioMonitoringService, AudioMonitoringResolver, LiveKitService, PrismaService],
  exports: [AudioMonitoringService, LiveKitService],
})
export class AudioMonitoringModule {}