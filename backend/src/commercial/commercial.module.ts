import { Module } from '@nestjs/common';
import { CommercialService } from './commercial.service';
import { CommercialResolver } from './commercial.resolver';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [CommercialResolver, CommercialService, PrismaService],
})
export class CommercialModule {}
