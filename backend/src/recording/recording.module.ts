import { forwardRef, Module } from '@nestjs/common';
import { RecordingService } from './recording.service';
import { RecordingResolver } from './recording.resolver';
import { PrismaService } from '../prisma.service';
import { TranscriptionModule } from '../transcription/transcription.module';
import { CoachingModule } from '../coaching/coaching.module';

@Module({
  imports: [TranscriptionModule, forwardRef(() => CoachingModule)],
  providers: [RecordingService, RecordingResolver, PrismaService],
  exports: [RecordingService],
})
export class RecordingModule {}
