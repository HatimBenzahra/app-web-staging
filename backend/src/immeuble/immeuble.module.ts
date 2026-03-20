import { Module } from '@nestjs/common';
import { ImmeubleService } from './immeuble.service';
import { ImmeubleResolver } from './immeuble.resolver';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [ImmeubleResolver, ImmeubleService, PrismaService],
})
export class ImmeubleModule {}
