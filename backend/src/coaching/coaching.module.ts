import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TranscriptionModule } from '../transcription/transcription.module';
import { CoachingService } from './coaching.service';
import { CoachingConfigService } from './coaching-config.service';
import { CoachingQueryService } from './coaching-query.service';
import { AnalysisRunnerService } from './analysis-runner.service';
import { CoachingResolver } from './coaching.resolver';
import { SalesPlanService } from './sales-plan.service';
import { LlmService } from './llm.service';
import { ScoringService } from './scoring.service';
import { SynthesisService } from './synthesis.service';
import { SnapshotBuilderService } from './snapshot-builder.service';
import { SynthesisResolver } from './synthesis.resolver';

@Module({
  imports: [TranscriptionModule],
  providers: [
    CoachingService,
    CoachingConfigService,
    CoachingQueryService,
    AnalysisRunnerService,
    CoachingResolver,
    SalesPlanService,
    LlmService,
    ScoringService,
    SynthesisService,
    SnapshotBuilderService,
    SynthesisResolver,
    PrismaService,
  ],
  exports: [CoachingService],
})
export class CoachingModule {}
