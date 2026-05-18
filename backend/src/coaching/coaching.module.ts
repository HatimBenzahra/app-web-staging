import { forwardRef, Module } from '@nestjs/common';
import { CoachingResolver } from './coaching.resolver';
import { CoachingService } from './coaching.service';
import { CoachingRecordingCatalogService } from './domain/coaching-recording-catalog.service';
import { CoachingSalesPlanService } from './domain/coaching-sales-plan.service';
import { CoachingVllmClient } from './infrastructure/coaching-vllm-client.service';
import { CoachingEngineService } from './processing/coaching-engine.service';
import { CoachingQueueService } from './processing/coaching-queue.service';
import { CoachingSessionPersistenceService } from './processing/coaching-session-persistence.service';
import { PrismaService } from '../prisma.service';
import { RecordingModule } from '../recording/recording.module';
import { TranscriptionModule } from '../transcription/transcription.module';

@Module({
  imports: [forwardRef(() => RecordingModule), TranscriptionModule],
  providers: [
    CoachingResolver,
    CoachingService,
    CoachingEngineService,
    CoachingQueueService,
    CoachingSessionPersistenceService,
    CoachingRecordingCatalogService,
    CoachingSalesPlanService,
    CoachingVllmClient,
    PrismaService,
  ],
  exports: [CoachingService, CoachingSalesPlanService],
})
export class CoachingModule {}
