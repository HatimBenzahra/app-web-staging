import { forwardRef, Module } from '@nestjs/common';
import { CoachingResolver } from './coaching.resolver';
import { CoachingService } from './coaching.service';
import { CoachingRecordingCatalogService } from './coaching-recording-catalog.service';
import { PrismaService } from '../prisma.service';
import { RecordingModule } from '../recording/recording.module';
import { TranscriptionModule } from '../transcription/transcription.module';

@Module({
  imports: [forwardRef(() => RecordingModule), TranscriptionModule],
  providers: [
    CoachingResolver,
    CoachingService,
    CoachingRecordingCatalogService,
    PrismaService,
  ],
  exports: [CoachingService],
})
export class CoachingModule {}
