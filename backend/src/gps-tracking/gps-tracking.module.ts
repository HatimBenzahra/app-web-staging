import { Module } from '@nestjs/common';
import { GpsTrackingService } from './gps-tracking.service';
import { GpsTrackingResolver } from './gps-tracking.resolver';
import { PrismaService } from '../prisma.service';

// Les positions GPS sont desormais alimentees par l'app mobile via la mutation
// reportMyPositions (rattachees a un acteur polymorphe userId/userType derive du
// token). Le kiosk n'est plus une source GPS : le collecteur @Interval a ete retire.
@Module({
  providers: [GpsTrackingResolver, GpsTrackingService, PrismaService],
})
export class GpsTrackingModule {}
