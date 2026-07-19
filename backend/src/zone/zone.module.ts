import { Module } from '@nestjs/common';
import { ZoneService } from './zone.service';
import { ZoneResolver } from './zone.resolver';
import { PrismaService } from '../prisma.service';
import { ImmeubleModule } from '../immeuble/immeuble.module';

@Module({
  imports: [ImmeubleModule],
  providers: [ZoneResolver, ZoneService, PrismaService],
})
export class ZoneModule {}
