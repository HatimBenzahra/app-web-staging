import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TranscriptionModule } from '../transcription/transcription.module';
import { CoachingService } from './coaching.service';
import { CoachingResolver } from './coaching.resolver';
import { SalesPlanService } from './sales-plan.service';
import { LlmService } from './llm.service';
import { ScoringService } from './scoring.service';

@Module({
  imports: [TranscriptionModule],
  providers: [
    CoachingService,
    CoachingResolver,
    SalesPlanService,
    LlmService,
    ScoringService,
    PrismaService,
  ],
  exports: [CoachingService],
})
export class CoachingModule {}
