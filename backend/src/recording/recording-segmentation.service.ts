import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  RecordingTranscriptionResult,
  TranscriptionService,
  WhisperWord,
  WhisperSegment,
} from '../transcription/transcription.service';

type TranscriptWord = {
  word: string;
  start: number;
  end: number;
  score?: number;
};

export type CanonicalConversationSegment = {
  id: number;
  s3KeyOriginal: string;
  recordingSegmentId: number | null;
  coachingSessionId: number | null;
  porteId: number | null;
  statut?: string | null;
  source: string;
  type: string;
  reviewStatus: string;
  confidence: number;
  startTime: number;
  endTime: number;
  durationSec: number;
  text: string | null;
  sourceTranscriptSegments: Array<{ start: number; end: number; text: string }> | null;
  wordsJson: TranscriptWord[] | null;
  speechScore: number | null;
  s3KeySegment: string | null;
};

@Injectable()
export class RecordingSegmentationService {
  private readonly logger = new Logger(RecordingSegmentationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transcriptionService: TranscriptionService,
  ) {}

  async ensureSegmentsForRecording(
    s3KeyOriginal: string,
    transcriptionResult?: RecordingTranscriptionResult | null,
  ): Promise<CanonicalConversationSegment[]> {
    const fromDoors = await this.syncFromRecordingSegments(
      s3KeyOriginal,
      transcriptionResult,
    );
    if (fromDoors.length > 0) {
      const usableFromDoors = fromDoors.filter(
        (segment) => (segment.text ?? '').trim().length > 0,
      );
      if (usableFromDoors.length === 0) {
        this.logger.warn(
          `Segments porte mobile présents mais sans texte exploitable pour ${s3KeyOriginal}`,
        );
      }
      return fromDoors;
    }

    await this.createFallbackSegmentsFromWhisper(
      s3KeyOriginal,
      transcriptionResult,
    );
    return this.getSegmentsForRecording(s3KeyOriginal);
  }

  async syncFromRecordingSegments(
    s3KeyOriginal: string,
    transcriptionResult?: RecordingTranscriptionResult | null,
  ): Promise<CanonicalConversationSegment[]> {
    const recordingSegments = await this.prisma.recordingSegment.findMany({
      where: { s3KeyOriginal },
      orderBy: { startTime: 'asc' },
    });

    if (recordingSegments.length === 0) {
      return [];
    }

    for (const segment of recordingSegments) {
      const whisperEnrichment = this.extractWhisperTextForWindow(
        transcriptionResult?.segments ?? [],
        segment.startTime,
        segment.endTime,
      );
      const directText = segment.transcription?.trim() || null;
      const text = directText ?? whisperEnrichment.text;
      const sourceTranscriptSegments =
        whisperEnrichment.sourceTranscriptSegments.length > 0
          ? whisperEnrichment.sourceTranscriptSegments
          : null;
      const wordsJson =
        whisperEnrichment.words.length > 0 ? whisperEnrichment.words : null;
      const speechScore =
        segment.speechScore ?? whisperEnrichment.speechScore ?? null;
      const hasSpeech =
        text !== null || (speechScore !== null && speechScore > 0);
      const type = hasSpeech ? 'PROSPECT' : 'UNKNOWN';
      const reviewStatus = hasSpeech ? 'NOT_REQUIRED' : 'PENDING';
      const confidence = directText ? 0.86 : text ? 0.82 : 0.68;

      const existing =
        await (this.prisma as any).recordingConversationSegment.findUnique({
          where: { recordingSegmentId: segment.id },
        });

      const data = {
        s3KeyOriginal,
        recordingSegmentId: segment.id,
        porteId: segment.porteId,
        commercialId: segment.commercialId,
        managerId: segment.managerId,
        immeubleId: segment.immeubleId,
        statut: segment.statut,
        source: 'MOBILE_DOOR',
        type,
        reviewStatus,
        confidence,
        startTime: segment.startTime,
        endTime: segment.endTime,
        durationSec: segment.durationSec,
        text,
        sourceTranscriptSegments,
        wordsJson,
        speechScore,
        s3KeySegment: segment.s3KeySegment,
        classificationReason: directText
          ? 'Segment porte mobile enrichi par transcription/speech score.'
          : text
            ? 'Segment porte mobile enrichi depuis Whisper complet par fenêtre temporelle.'
            : 'Segment porte mobile sans parole exploitable, revue recommandée.',
      };

      if (existing) {
        await (this.prisma as any).recordingConversationSegment.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await (this.prisma as any).recordingConversationSegment.create({
          data,
        });
      }
    }

    return this.getSegmentsForRecording(s3KeyOriginal);
  }

  async createFallbackSegmentsFromWhisper(
    s3KeyOriginal: string,
    transcriptionResult?: RecordingTranscriptionResult | null,
  ): Promise<void> {
    const existingCount =
      await (this.prisma as any).recordingConversationSegment.count({
        where: { s3KeyOriginal },
      });
    if (existingCount > 0) {
      return;
    }

    const result =
      transcriptionResult ??
      (await this.transcriptionService.transcribeRecordingFromS3(s3KeyOriginal));
    if (!result || result.segments.length === 0) {
      this.logger.warn(
        `Aucun transcript disponible pour créer des segments fallback (${s3KeyOriginal})`,
      );
      return;
    }

    const blocks = this.groupWhisperSegments(result.segments);
    if (blocks.length === 0) {
      return;
    }

    await (this.prisma as any).recordingConversationSegment.createMany({
      data: blocks.map((block) => ({
        s3KeyOriginal,
        source: 'AUDIO_TRANSCRIPT',
        type: 'UNKNOWN',
        reviewStatus: 'PENDING',
        confidence: 0.55,
        startTime: block.startTime,
        endTime: block.endTime,
        durationSec: block.endTime - block.startTime,
        text: block.text,
        sourceTranscriptSegments: block.sourceTranscriptSegments,
        wordsJson: block.words,
        speechScore: block.speechScore,
        classificationReason:
          'Segment fallback construit depuis Whisper, sans événement porte mobile.',
      })),
    });

    this.logger.log(
      `${blocks.length} segment(s) fallback créés depuis Whisper pour ${s3KeyOriginal}`,
    );
  }

  async getSegmentsForRecording(
    s3KeyOriginal: string,
  ): Promise<CanonicalConversationSegment[]> {
    return (this.prisma as any).recordingConversationSegment.findMany({
      where: { s3KeyOriginal },
      orderBy: { startTime: 'asc' },
    });
  }

  async getUsableSegmentsForCoaching(
    s3KeyOriginal: string,
  ): Promise<CanonicalConversationSegment[]> {
    const segments = await this.getSegmentsForRecording(s3KeyOriginal);
    return segments.filter((segment) => (segment.text ?? '').trim().length > 0);
  }

  async attachSegmentsToSession(
    s3KeyOriginal: string,
    coachingSessionId: number,
  ): Promise<void> {
    await (this.prisma as any).recordingConversationSegment.updateMany({
      where: { s3KeyOriginal, coachingSessionId: null },
      data: { coachingSessionId },
    });
  }

  private groupWhisperSegments(
    segments: WhisperSegment[],
  ): Array<{
    startTime: number;
    endTime: number;
    text: string;
    sourceTranscriptSegments: Array<{ start: number; end: number; text: string }>;
    words: TranscriptWord[];
    speechScore: number;
  }> {
    const sorted = segments
      .map((segment) => ({
        start: Number(segment.start),
        end: Number(segment.end),
        text: segment.text?.trim() ?? '',
        words: this.normalizeWords(segment.words),
      }))
      .filter(
        (segment) =>
          Number.isFinite(segment.start) &&
          Number.isFinite(segment.end) &&
          segment.end > segment.start &&
          segment.text.length > 0,
      )
      .sort((a, b) => a.start - b.start);

    const blocks: Array<{
      startTime: number;
      endTime: number;
      textParts: string[];
      speechDuration: number;
      sourceTranscriptSegments: Array<{ start: number; end: number; text: string }>;
      words: TranscriptWord[];
    }> = [];
    const maxGapSec = 20;
    const maxBlockDurationSec = 180;

    for (const segment of sorted) {
      const current = blocks[blocks.length - 1];
      const shouldStartNew =
        !current ||
        segment.start - current.endTime > maxGapSec ||
        segment.end - current.startTime > maxBlockDurationSec;

      if (shouldStartNew) {
        blocks.push({
          startTime: segment.start,
          endTime: segment.end,
          textParts: [segment.text],
          speechDuration: segment.end - segment.start,
          sourceTranscriptSegments: [
            { start: segment.start, end: segment.end, text: segment.text },
          ],
          words: segment.words,
        });
        continue;
      }

      current.endTime = Math.max(current.endTime, segment.end);
      current.textParts.push(segment.text);
      current.speechDuration += segment.end - segment.start;
      current.sourceTranscriptSegments.push({
        start: segment.start,
        end: segment.end,
        text: segment.text,
      });
      current.words.push(...segment.words);
    }

    return blocks.map((block) => {
      const duration = Math.max(0.001, block.endTime - block.startTime);
      return {
        startTime: block.startTime,
        endTime: block.endTime,
        text: block.textParts.join(' ').trim(),
        sourceTranscriptSegments: block.sourceTranscriptSegments,
        words: this.dedupeWords(block.words),
        speechScore: Math.round(
          Math.min(100, (block.speechDuration / duration) * 100),
        ),
      };
    });
  }

  private extractWhisperTextForWindow(
    segments: WhisperSegment[],
    windowStart: number,
    windowEnd: number,
  ): {
    text: string | null;
    speechScore: number | null;
    sourceTranscriptSegments: Array<{ start: number; end: number; text: string }>;
    words: TranscriptWord[];
  } {
    if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd)) {
      return {
        text: null,
        speechScore: null,
        sourceTranscriptSegments: [],
        words: [],
      };
    }

    const windowDuration = Math.max(0.001, windowEnd - windowStart);
    const matching = segments
      .map((segment) => {
        const start = Number(segment.start);
        const end = Number(segment.end);
        const text = segment.text?.trim() ?? '';
        const words = this.extractWordsForWindow(
          this.normalizeWords(segment.words),
          windowStart,
          windowEnd,
        );
        const overlap = Math.max(
          0,
          Math.min(end, windowEnd) - Math.max(start, windowStart),
        );
        const segmentDuration = Math.max(0.001, end - start);
        return { start, end, text, words, overlap, segmentDuration };
      })
      .filter(
        (segment) =>
          Number.isFinite(segment.start) &&
          Number.isFinite(segment.end) &&
          segment.end > segment.start &&
          segment.text.length > 0 &&
          (segment.overlap >= 1 ||
            segment.overlap / segment.segmentDuration >= 0.5),
      )
      .sort((a, b) => a.start - b.start);

    if (matching.length === 0) {
      return {
        text: null,
        speechScore: null,
        sourceTranscriptSegments: [],
        words: [],
      };
    }

    const speechDuration = matching.reduce(
      (sum, segment) => sum + segment.overlap,
      0,
    );

    return {
      text: matching.map((segment) => segment.text).join(' ').trim(),
      sourceTranscriptSegments: matching.map((segment) => ({
        start: segment.start,
        end: segment.end,
        text: segment.text,
      })),
      words: this.dedupeWords(matching.flatMap((segment) => segment.words)),
      speechScore: Math.round(
        Math.min(100, (speechDuration / windowDuration) * 100),
      ),
    };
  }

  private normalizeWords(words: WhisperWord[] | undefined): TranscriptWord[] {
    if (!Array.isArray(words)) {
      return [];
    }

    return words
      .map((word) => {
        const text = typeof word.word === 'string' ? word.word.trim() : '';
        const start = Number(word.start);
        const end = Number(word.end);
        const score = Number(word.score);
        return {
          word: text,
          start,
          end,
          ...(Number.isFinite(score) ? { score } : {}),
        };
      })
      .filter(
        (word) =>
          word.word.length > 0 &&
          Number.isFinite(word.start) &&
          Number.isFinite(word.end) &&
          word.end > word.start,
      )
      .sort((a, b) => a.start - b.start);
  }

  private extractWordsForWindow(
    words: TranscriptWord[],
    windowStart: number,
    windowEnd: number,
  ): TranscriptWord[] {
    return words.filter((word) => {
      const overlap = Math.max(
        0,
        Math.min(word.end, windowEnd) - Math.max(word.start, windowStart),
      );
      const center = (word.start + word.end) / 2;
      return (
        overlap > 0 ||
        (center >= windowStart && center <= windowEnd)
      );
    });
  }

  private dedupeWords(words: TranscriptWord[]): TranscriptWord[] {
    const seen = new Set<string>();
    const output: TranscriptWord[] = [];
    for (const word of words.sort((a, b) => a.start - b.start)) {
      const key = `${word.start.toFixed(2)}:${word.end.toFixed(2)}:${word.word.toLowerCase()}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      output.push(word);
    }
    return output;
  }
}
