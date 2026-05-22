import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { RecordingSegmentationService } from '../../recording/recording-segmentation.service';
import { TranscriptionService } from '../../transcription/transcription.service';
import type { SourceTranscriptSegmentPayload } from '../types/coaching-dialogue.types';
import { normalizeText } from '../utils/evaluation-normalizers.utils';
import { normalizeTranscriptWords } from '../utils/transcript-word-timing.utils';
import { CoachingAnalysisJobService } from './coaching-analysis-job.service';
import type { CoachingTranscriptPayload } from './coaching-engine.types';
import { isRecord } from './coaching-engine.types';

@Injectable()
export class CoachingTranscriptLoaderService {
  private readonly logger = new Logger(CoachingTranscriptLoaderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly segmentationService: RecordingSegmentationService,
    private readonly transcriptionService: TranscriptionService,
    private readonly jobs: CoachingAnalysisJobService,
  ) {}

  async ensureTranscription(
    session: { id: number; s3KeyOriginal: string },
    jobId?: number,
  ): Promise<CoachingTranscriptPayload> {
    const s3Key = session.s3KeyOriginal;

    let transcript = await this.loadFromConversationSegments(s3Key);
    if (transcript) {
      await this.attachSegments(s3Key, session.id);
      await this.logCacheHit(session.id, transcript, jobId);
      return transcript;
    }

    transcript = await this.loadFromRecordingSegments(s3Key);
    if (transcript) {
      await this.segmentationService.syncFromRecordingSegments(s3Key);
      const canonicalTranscript = await this.loadFromConversationSegments(s3Key);
      if (canonicalTranscript) {
        await this.attachSegments(s3Key, session.id);
        return canonicalTranscript;
      }
      await this.logRecordingSegmentHit(session.id, transcript, jobId);
      return transcript;
    }

    this.logger.log(
      `Session ${session.id} — Stage 1: aucun segment en DB, déclenchement Analyse IA biblio (Whisper)`,
    );
    await this.jobs.updateAnalysisJobStep(
      jobId,
      'Analyse IA en cours (transcription Whisper + segmentation)',
    );

    const whisperResult = await this.transcriptionService.processRecording(s3Key);
    await this.segmentationService.ensureSegmentsForRecording(
      s3Key,
      whisperResult,
    );

    transcript = await this.loadFromConversationSegments(s3Key);
    if (transcript) {
      await this.attachSegments(s3Key, session.id);
      this.logTranscriptGenerated(session.id, transcript, 'segmentation canonique');
      return transcript;
    }

    transcript = await this.loadFromRecordingSegments(s3Key);
    if (!transcript) {
      throw new Error(
        "L'Analyse IA n'a produit aucun segment exploitable pour cet audio. Vérifier l'audio source.",
      );
    }
    this.logTranscriptGenerated(session.id, transcript, 'segments DB');
    return transcript;
  }

  private async attachSegments(s3Key: string, sessionId: number): Promise<void> {
    await this.segmentationService.attachSegmentsToSession(s3Key, sessionId);
  }

  private async logCacheHit(
    sessionId: number,
    transcript: CoachingTranscriptPayload,
    jobId?: number,
  ): Promise<void> {
    this.logger.log(
      `Session ${sessionId} — Stage 1: transcript depuis segmentation canonique (${transcript.segments.length} segments, ${this.countChars(transcript)} chars)`,
    );
    await this.jobs.updateAnalysisJobStep(
      jobId,
      `Segmentation canonique en cache (${transcript.segments.length} segments)`,
    );
  }

  private async logRecordingSegmentHit(
    sessionId: number,
    transcript: CoachingTranscriptPayload,
    jobId?: number,
  ): Promise<void> {
    this.logger.log(
      `Session ${sessionId} — Stage 1: transcript depuis DB (${transcript.segments.length} segments, ${this.countChars(transcript)} chars)`,
    );
    await this.jobs.updateAnalysisJobStep(
      jobId,
      `Transcript en cache (${transcript.segments.length} segments)`,
    );
  }

  private logTranscriptGenerated(
    sessionId: number,
    transcript: CoachingTranscriptPayload,
    source: string,
  ): void {
    this.logger.log(
      `Session ${sessionId} — Stage 1: transcript généré depuis ${source} (${transcript.segments.length} segments, ${this.countChars(transcript)} chars)`,
    );
  }

  private countChars(transcript: CoachingTranscriptPayload): number {
    return transcript.segments.reduce((sum, segment) => sum + segment.text.length, 0);
  }

  private async loadFromConversationSegments(
    s3KeyOriginal: string,
  ): Promise<CoachingTranscriptPayload | null> {
    const segments =
      await this.segmentationService.getUsableSegmentsForCoaching(
        s3KeyOriginal,
      );

    const transcriptSegments = segments
      .map((segment) => ({
        start: segment.startTime,
        end: segment.endTime,
        text: segment.text?.trim() ?? '',
        type: segment.type as 'PROSPECT' | 'INTERNAL' | 'NOISE' | 'UNKNOWN',
        source: segment.source,
        confidence: segment.confidence,
        statut: segment.statut ?? null,
        speechScore: segment.speechScore ?? null,
        sourceTranscriptSegments: this.normalizeSourceTranscriptSegments(
          segment.sourceTranscriptSegments,
        ),
        words: normalizeTranscriptWords(segment.wordsJson),
      }))
      .filter((segment) => segment.text.length > 0);

    if (transcriptSegments.length === 0) {
      return null;
    }

    return {
      segments: transcriptSegments,
      duration: Math.max(...transcriptSegments.map((segment) => segment.end)),
      source: 'RECORDING_CONVERSATION_SEGMENTS',
    };
  }

  private async loadFromRecordingSegments(
    s3KeyOriginal: string,
  ): Promise<CoachingTranscriptPayload | null> {
    const segments = await this.prisma.recordingSegment.findMany({
      where: { s3KeyOriginal, transcription: { not: null } },
      select: { startTime: true, endTime: true, transcription: true },
      orderBy: { startTime: 'asc' },
    });

    const transcriptSegments = segments
      .map((segment) => ({
        start: segment.startTime,
        end: segment.endTime,
        text: segment.transcription?.trim() ?? '',
      }))
      .filter((segment) => segment.text.length > 0);

    if (transcriptSegments.length === 0) {
      return null;
    }

    return {
      segments: transcriptSegments,
      duration: Math.max(...transcriptSegments.map((segment) => segment.end)),
      source: 'RECORDING_SEGMENTS',
    };
  }

  private normalizeSourceTranscriptSegments(
    value: unknown,
  ): SourceTranscriptSegmentPayload[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.normalizeSourceTranscriptSegment(item))
      .filter(
        (segment): segment is SourceTranscriptSegmentPayload =>
          Boolean(segment),
      );
  }

  private normalizeSourceTranscriptSegment(
    value: unknown,
  ): SourceTranscriptSegmentPayload | null {
    if (!isRecord(value)) {
      return null;
    }
    const start = Number(value.start);
    const end = Number(value.end);
    const text = normalizeText(value.text);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) {
      return null;
    }
    return { start, end, text };
  }
}
