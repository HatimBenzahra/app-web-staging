import { Module } from '@nestjs/common';
import { GamificationResolver } from './gamification.resolver';
import { WinleadPlusApiService } from './winleadplus-api.service';
import { MappingService } from './mapping.service';
import { OffreService } from './offre.service';
import { BadgeService } from './badge.service';
import { RankingService } from './ranking.service';
import { ContratService } from './contrat.service';
import { EvaluationService } from './evaluation.service';
import { GamificationCronService } from './gamification-cron.service';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [
    GamificationResolver,
    WinleadPlusApiService,
    MappingService,
    OffreService,
    BadgeService,
    RankingService,
    ContratService,
    EvaluationService,
    GamificationCronService,
    PrismaService,
  ],
})
export class GamificationModule {}
