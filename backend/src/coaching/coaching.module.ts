import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TranscriptionModule } from '../transcription/transcription.module';
import { CoachingService } from './coaching.service';
import { CoachingConfigService } from './coaching-config.service';
import { CoachingQueryService } from './lecture/coaching-query.service';
import { AnalysisRunnerService } from './analyse-porte/analysis-runner.service';
import { CoachingResolver } from './coaching.resolver';
import { SalesPlanService } from './referentiels/sales-plan.service';
import { LlmService } from './shared/llm.service';
import { ScoringService } from './analyse-porte/etape-5-scoring/scoring.service';
import { ProductSheetService } from './referentiels/product-sheet.service';
import { ProductPriceService } from './referentiels/product-price.service';
import { SynthesisService } from './synthese-globale/synthesis.service';
import { SnapshotBuilderService } from './synthese-globale/snapshot-builder.service';
import { SynthesisResolver } from './synthese-globale/synthesis.resolver';

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
    ProductSheetService,
    ProductPriceService,
    SynthesisService,
    SnapshotBuilderService,
    SynthesisResolver,
    PrismaService,
  ],
  exports: [CoachingService],
})
export class CoachingModule {}
