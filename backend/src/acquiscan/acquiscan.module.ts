import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AcquiscanResolver } from './acquiscan.resolver';
import { AcquiscanService } from './acquiscan.service';

@Module({
  providers: [AcquiscanResolver, AcquiscanService, PrismaService],
})
export class AcquiscanModule {}
