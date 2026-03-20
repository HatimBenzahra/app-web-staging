import { Module } from '@nestjs/common';
import { TranscriptionService } from './transcription.service';
import { SpeechAnalysisService } from './speech-analysis.service';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [TranscriptionService, SpeechAnalysisService, PrismaService],
  exports: [TranscriptionService, SpeechAnalysisService],
})
export class TranscriptionModule {}
