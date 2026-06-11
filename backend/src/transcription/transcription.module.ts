import { Module } from '@nestjs/common';
import { TranscriptionService } from './transcription.service';
import { SpeechAnalysisService } from './speech-analysis.service';
import { PrismaService } from '../prisma.service';
import { S3DiagnosticsModule } from '../s3-diagnostics/s3-diagnostics.module';

@Module({
  imports: [S3DiagnosticsModule],
  providers: [TranscriptionService, SpeechAnalysisService, PrismaService],
  exports: [TranscriptionService, SpeechAnalysisService],
})
export class TranscriptionModule {}
