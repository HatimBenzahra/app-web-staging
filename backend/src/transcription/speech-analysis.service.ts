import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { spawn } from 'child_process';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { PrismaService } from '../prisma.service';

const execFileAsync = promisify(execFile);

export interface SpeechScore {
  score: number; // 0–100
  totalDurationSec: number;
  speechDurationSec: number;
}

@Injectable()
export class SpeechAnalysisService implements OnModuleDestroy {
  private readonly logger = new Logger(SpeechAnalysisService.name);
  private readonly prisma: PrismaService;

  private readonly cache = new Map<string, SpeechScore>();

  /** Track in-flight analyses to avoid duplicate work */
  private readonly analyzing = new Set<string>();

  /** Concurrency limiter — max N simultaneous analyses */
  private readonly maxConcurrency = 3;
  private runningCount = 0;
  private readonly waitQueue: (() => void)[] = [];

  private readonly region = process.env.AWS_REGION || 'eu-west-3';
  private readonly bucket = process.env.S3_BUCKET_NAME!;

  private readonly s3 = new S3Client({
    region: this.region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  /** Silence detection thresholds tuned for compressed phone audio */
  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  private readonly noiseThresholdDb = -40;
  private readonly minSilenceSec = 0.5;

  onModuleDestroy(): void {
    this.cache.clear();
    this.analyzing.clear();
    this.waitQueue.length = 0;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async computeScore(filePath: string): Promise<number | null> {
    try {
      const [totalDuration, silences] = await Promise.all([
        this.getMediaDuration(filePath),
        this.detectSilences(filePath),
      ]);
      if (totalDuration <= 0) return null;
      const silenceDuration = silences.reduce((sum, s) => sum + (s.end - s.start), 0);
      const speechDurationSec = Math.max(0, totalDuration - silenceDuration);
      return Math.round(Math.min(100, (speechDurationSec / totalDuration) * 100));
    } catch (error) {
      this.logger.warn(`computeScore failed: ${error?.message || error}`);
      return null;
    }
  }

  getCachedScore(key: string): SpeechScore | null {
    return this.cache.get(key) ?? null;
  }

  /** Return all cached scores for the given keys */
  getCachedScores(keys: string[]): Map<string, SpeechScore> {
    const result = new Map<string, SpeechScore>();
    for (const key of keys) {
      const cached = this.cache.get(key);
      if (cached) result.set(key, cached);
    }
    return result;
  }

  /** Check if analysis is currently running for a key */
  isAnalyzing(key: string): boolean {
    return this.analyzing.has(key);
  }

  /**
   * Cache a speech score derived from Whisper segments (free — no extra processing).
   * Called by TranscriptionService after successful transcription.
   */
  cacheFromWhisperSegments(
    key: string,
    segments: { start: number; end: number }[],
    totalDurationSec: number,
  ): void {
    if (totalDurationSec <= 0 || segments.length === 0) return;

    const speechDurationSec = segments.reduce(
      (sum, s) => sum + (s.end - s.start),
      0,
    );

    const score = Math.round(
      Math.min(100, (speechDurationSec / totalDurationSec) * 100),
    );

    this.cache.set(key, { score, totalDurationSec, speechDurationSec });

    this.logger.debug(
      `Score Whisper pour ${key}: ${score}% (${speechDurationSec.toFixed(1)}s / ${totalDurationSec.toFixed(1)}s)`,
    );
  }

  /**
   * Trigger background analysis for all uncached keys.
   * Does NOT await — fire and forget. Frontend polls getCachedScores().
   */
  triggerBatchAnalysis(keys: string[]): number {
    const toAnalyze = keys.filter(
      (k) =>
        !k.endsWith('_conv.mp4') &&
        !this.cache.has(k) &&
        !this.analyzing.has(k),
    );

    if (toAnalyze.length === 0) return 0;

    for (const key of toAnalyze) {
      void this.analyzeRecording(key);
    }

    return toAnalyze.length;
  }

  // ---------------------------------------------------------------------------
  // Core analysis
  // ---------------------------------------------------------------------------

  /**
   * Download a recording from S3, run ffprobe + silencedetect, cache result.
   * Never throws — logs errors and silently skips.
   */
  private async analyzeRecording(s3Key: string): Promise<void> {
    if (this.cache.has(s3Key) || this.analyzing.has(s3Key)) return;

    this.analyzing.add(s3Key);
    await this.acquireSlot();

    const tmpDir = path.join(
      os.tmpdir(),
      `speech-analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    const filePath = path.join(tmpDir, 'audio.mp4');

    try {
      fs.mkdirSync(tmpDir, { recursive: true });

      const downloaded = await this.downloadFromS3(s3Key, filePath);
      if (!downloaded) return;

      const [totalDuration, silences] = await Promise.all([
        this.getMediaDuration(filePath),
        this.detectSilences(filePath),
      ]);

      if (totalDuration <= 0) {
        this.logger.warn(`Durée invalide pour ${s3Key}: ${totalDuration}`);
        return;
      }

      const silenceDuration = silences.reduce(
        (sum, s) => sum + (s.end - s.start),
        0,
      );
      const speechDurationSec = Math.max(0, totalDuration - silenceDuration);
      const score = Math.round(
        Math.min(100, (speechDurationSec / totalDuration) * 100),
      );

      this.cache.set(s3Key, {
        score,
        totalDurationSec: totalDuration,
        speechDurationSec,
      });

      await this.persistScore(s3Key, score);

      this.logger.debug(
        `Score silencedetect pour ${s3Key}: ${score}% (${speechDurationSec.toFixed(1)}s parole / ${totalDuration.toFixed(1)}s total)`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur analyse ${s3Key}: ${error?.message || error}`,
      );
    } finally {
      this.cleanupDir(tmpDir);
      this.analyzing.delete(s3Key);
      this.releaseSlot();
    }
  }

  private async persistScore(s3Key: string, score: number): Promise<void> {
    try {
      await this.prisma.recordingSegment.updateMany({
        where: { s3KeySegment: s3Key, speechScore: null },
        data: { speechScore: score },
      });
    } catch {
      // Best-effort — segment may not exist for full recordings
    }
  }

  // ---------------------------------------------------------------------------
  // ffprobe — total duration
  // ---------------------------------------------------------------------------

  private async getMediaDuration(filePath: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        filePath,
      ]);

      const parsed = JSON.parse(stdout);
      const duration = parseFloat(parsed?.format?.duration ?? '0');
      return Number.isFinite(duration) ? duration : 0;
    } catch (error) {
      this.logger.error(
        `ffprobe échoué: ${error?.message || error}`,
      );
      return 0;
    }
  }

  // ---------------------------------------------------------------------------
  // ffmpeg silencedetect — silence segments
  // ---------------------------------------------------------------------------

  private detectSilences(
    filePath: string,
  ): Promise<Array<{ start: number; end: number }>> {
    return new Promise((resolve, reject) => {
      const silences: Array<{ start: number; end: number }> = [];
      let currentStart: number | null = null;
      let stderrBuffer = '';

      const proc = spawn('ffmpeg', [
        '-i',
        filePath,
        '-af',
        `silencedetect=n=${this.noiseThresholdDb}dB:d=${this.minSilenceSec}`,
        '-f',
        'null',
        '-',
      ]);

      proc.stderr.on('data', (chunk: Buffer) => {
        stderrBuffer += chunk.toString();

        // Process complete lines only
        const lines = stderrBuffer.split('\n');
        stderrBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const startMatch = line.match(/silence_start:\s*(\d+(?:\.\d+)?)/);
          if (startMatch) {
            currentStart = parseFloat(startMatch[1]);
            continue;
          }

          const endMatch = line.match(/silence_end:\s*(\d+(?:\.\d+)?)/);
          if (endMatch && currentStart !== null) {
            const end = parseFloat(endMatch[1]);
            if (end > currentStart) {
              silences.push({ start: currentStart, end });
            }
            currentStart = null;
          }
        }
      });

      proc.on('close', (code) => {
        // ffmpeg returns 0 on success, but also sometimes 1 for audio issues
        // We still want partial results in those cases
        resolve(silences);
      });

      proc.on('error', (err) => {
        this.logger.error(`ffmpeg silencedetect spawn error: ${err.message}`);
        resolve([]); // Don't reject — return empty silences
      });

      // Safety timeout (30s should be more than enough)
      setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch {
          // Process may already be dead
        }
        resolve(silences);
      }, 30_000);
    });
  }

  // ---------------------------------------------------------------------------
  // S3 + filesystem helpers
  // ---------------------------------------------------------------------------

  private async downloadFromS3(
    s3Key: string,
    destPath: string,
  ): Promise<boolean> {
    try {
      const resp = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
      );

      if (!resp.Body) {
        this.logger.warn(`S3 Body vide pour ${s3Key}`);
        return false;
      }

      const writeStream = fs.createWriteStream(destPath);
      await pipeline(resp.Body as Readable, writeStream);
      return true;
    } catch (error) {
      this.logger.error(
        `Échec téléchargement S3 pour analyse ${s3Key}: ${error?.message || error}`,
      );
      return false;
    }
  }

  private cleanupDir(dirPath: string): void {
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    } catch {
      // Cleanup is best-effort
    }
  }

  private acquireSlot(): Promise<void> {
    if (this.runningCount < this.maxConcurrency) {
      this.runningCount++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waitQueue.push(() => {
        this.runningCount++;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.runningCount--;
    const next = this.waitQueue.shift();
    if (next) next();
  }
}
