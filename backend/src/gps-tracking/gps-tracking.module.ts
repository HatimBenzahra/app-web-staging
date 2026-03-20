import { Module } from '@nestjs/common';
import { GpsTrackingService } from './gps-tracking.service';
import { GpsTrackingResolver } from './gps-tracking.resolver';
import { GpsCollectorService } from './gps-collector.service';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [GpsTrackingResolver, GpsTrackingService, GpsCollectorService, PrismaService],
})
export class GpsTrackingModule {}
