import { forwardRef, Module } from '@nestjs/common';
import { CoachingResolver } from './coaching.resolver';
import { CoachingService } from './coaching.service';
import { PrismaService } from '../prisma.service';
import { RecordingModule } from '../recording/recording.module';
import { TranscriptionModule } from '../transcription/transcription.module';

@Module({
  imports: [forwardRef(() => RecordingModule), TranscriptionModule],
  providers: [CoachingResolver, CoachingService, PrismaService],
  exports: [CoachingService],
})
export class CoachingModule {}
