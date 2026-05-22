import { forwardRef, Module } from '@nestjs/common';
import { CoachingResolver } from './coaching.resolver';
import { CoachingService } from './coaching.service';
import { CoachingRecordingCatalogService } from './domain/coaching-recording-catalog.service';
import { CoachingSalesPlanService } from './domain/coaching-sales-plan.service';
import { CoachingVllmClient } from './infrastructure/coaching-vllm-client.service';
import { CoachingAgentLogger } from './agents/shared/coaching-agent-logger.service';
import { CoachingAgentRunner } from './agents/shared/coaching-agent-runner.service';
import { SegmentationAgentService } from './agents/segmentation/segmentation-agent.service';
import { TranscriptCleanerAgentService } from './agents/transcript-cleaner/transcript-cleaner-agent.service';
import { SalesPlanAgentService } from './agents/sales-plan/sales-plan-agent.service';
import { RemarksAgentService } from './agents/remarks/remarks-agent.service';
import { CoachingAnalysisPipelineService } from './pipeline/coaching-analysis-pipeline.service';
import { SegmentationValidator } from './validators/segmentation.validator';
import { TranscriptCleanerValidator } from './validators/transcript-cleaner.validator';
import { SalesPlanValidator } from './validators/sales-plan.validator';
import { RemarksValidator } from './validators/remarks.validator';
import { CoachingEngineService } from './processing/coaching-engine.service';
import { CoachingAutoQueueService } from './processing/coaching-auto-queue.service';
import { CoachingAnalysisJobService } from './processing/coaching-analysis-job.service';
import { CoachingQueueService } from './processing/coaching-queue.service';
import { CoachingSessionCommandService } from './processing/coaching-session-command.service';
import { CoachingSessionQueryService } from './processing/coaching-session-query.service';
import { CoachingSessionPersistenceService } from './processing/coaching-session-persistence.service';
import { CoachingTranscriptLoaderService } from './processing/coaching-transcript-loader.service';
import { CoachingConversationDetectorService } from './processing/coaching-conversation-detector.service';
import { CoachingReadableTranscriptService } from './processing/coaching-readable-transcript.service';
import { CoachingConversationClassifierService } from './processing/coaching-conversation-classifier.service';
import { CoachingSalesPlanApplicationService } from './processing/coaching-sales-plan-application.service';
import { CoachingSessionStateService } from './processing/coaching-session-state.service';
import { CoachingLegacyEvaluationService } from './processing/coaching-legacy-evaluation.service';
import { CoachingConversationEvaluationService } from './processing/coaching-conversation-evaluation.service';
import { CoachingScoringEngineService } from './scoring/coaching-scoring-engine.service';
import { ConversationQualityGateService } from './scoring/conversation-quality-gate.service';
import { SalesPlanCriterionService } from './scoring/sales-plan-criterion.service';
import { PrismaService } from '../prisma.service';
import { RecordingModule } from '../recording/recording.module';
import { TranscriptionModule } from '../transcription/transcription.module';

@Module({
  imports: [forwardRef(() => RecordingModule), TranscriptionModule],
  providers: [
    CoachingResolver,
    CoachingService,
    CoachingEngineService,
    CoachingAutoQueueService,
    CoachingAnalysisJobService,
    CoachingQueueService,
    CoachingSessionCommandService,
    CoachingSessionQueryService,
    CoachingSessionPersistenceService,
    CoachingTranscriptLoaderService,
    CoachingConversationDetectorService,
    CoachingReadableTranscriptService,
    CoachingConversationClassifierService,
    CoachingSalesPlanApplicationService,
    CoachingSessionStateService,
    CoachingLegacyEvaluationService,
    CoachingConversationEvaluationService,
    CoachingScoringEngineService,
    ConversationQualityGateService,
    SalesPlanCriterionService,
    CoachingRecordingCatalogService,
    CoachingSalesPlanService,
    CoachingVllmClient,
    CoachingAgentLogger,
    CoachingAgentRunner,
    SegmentationAgentService,
    TranscriptCleanerAgentService,
    SalesPlanAgentService,
    RemarksAgentService,
    CoachingAnalysisPipelineService,
    SegmentationValidator,
    TranscriptCleanerValidator,
    SalesPlanValidator,
    RemarksValidator,
    PrismaService,
  ],
  exports: [CoachingService, CoachingSalesPlanService],
})
export class CoachingModule {}
