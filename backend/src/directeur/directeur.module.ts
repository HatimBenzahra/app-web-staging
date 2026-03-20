import { Module } from '@nestjs/common';
import { DirecteurService } from './directeur.service';
import { DirecteurResolver } from './directeur.resolver';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [DirecteurResolver, DirecteurService, PrismaService],
})
export class DirecteurModule {}
