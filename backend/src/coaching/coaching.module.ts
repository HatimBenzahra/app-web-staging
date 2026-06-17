import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TranscriptionModule } from '../transcription/transcription.module';
import { CoachingResolver } from './coaching.resolver';
import { CoachingService } from './coaching.service';

@Module({
  imports: [TranscriptionModule],
  providers: [CoachingResolver, CoachingService, PrismaService],
  exports: [CoachingService],
})
export class CoachingModule {}
