import { Injectable, Logger } from '@nestjs/common';
import { SegmentationAgentService } from '../agents/segmentation/segmentation-agent.service';
import { TranscriptCleanerAgentService } from '../agents/transcript-cleaner/transcript-cleaner-agent.service';
import type { TranscriptCleanerAgentResult } from '../agents/transcript-cleaner/transcript-cleaner-agent.types';
import { analyzeRawTranscriptForCleaning } from '../utils/dialogue-faithfulness.utils';
import {
  CandidateWindowBlock,
  CandidateWindowPipelineResult,
} from './coaching-pipeline.types';
import {
  hasCleanableTranscriptCandidate,
} from './candidate-window.builder';
import { shouldRunTranscriptCleaner } from './pipeline-quality-gates';
import {
  buildInitialTranscriptionMemory,
  summarizeTranscriptionMemory,
  updateTranscriptionMemory,
} from '../utils/transcription-memory.utils';
import { splitSegmentationBlockForCleaning } from '../utils/transcription-chunking.utils';

@Injectable()
export class CoachingAnalysisPipelineService {
  private readonly logger = new Logger(CoachingAnalysisPipelineService.name);

  constructor(
    private readonly segmentationAgent: SegmentationAgentService,
    private readonly transcriptCleanerAgent: TranscriptCleanerAgentService,
  ) {}

  async processCandidateWindow(
    block: CandidateWindowBlock,
    jobId?: number | null,
  ): Promise<CandidateWindowPipelineResult> {
    const durationSec = Math.max(0, block.endTime - block.startTime);
    const recordingMode =
      block.segmentsCount <= 1 && durationSec <= 240
        ? 'SINGLE_DOOR'
        : 'LEGACY_LONG';
    const preflight = analyzeRawTranscriptForCleaning(
      block.transcriptText,
      durationSec,
    );

    this.logger.log(
      `pipeline.candidate_window.start jobId=${jobId ?? 'null'} candidateWindowOrder=${block.ordre} recordingMode=${recordingMode} source=${block.segmentSource ?? 'unknown'} durationSec=${durationSec.toFixed(2)} rawChars=${preflight.rawChars} rawSegmentsCount=${preflight.rawSegmentsCount} doorStatus=${block.segmentStatut ?? 'unknown'}`,
    );
    this.logger.log(
      `pipeline.candidate_window.preflight jobId=${jobId ?? 'null'} candidateWindowOrder=${block.ordre} charsPerMin=${preflight.charsPerMin} speechScore=${block.speechScore ?? 'null'} duplicateLineCount=${preflight.duplicateLineCount} timestampCoverage=${preflight.timestampCoverage} qualityHint=${preflight.qualityHint} reasons="${preflight.reasons.join(';')}"`,
    );

    const segmentation = await this.segmentationAgent.run({
      jobId,
      candidateWindowOrder: block.ordre,
      startTime: block.startTime,
      endTime: block.endTime,
      status: block.segmentStatut,
      transcriptText: block.transcriptText,
      preflight,
    });

    if (!hasCleanableTranscriptCandidate(segmentation.blocks)) {
      this.logger.log(
        `pipeline.candidate_window.stop jobId=${jobId ?? 'null'} candidateWindowOrder=${block.ordre} reason=no_cleanable_candidate blocks=${segmentation.blocks.length}`,
      );
      return {
        dialogue: null,
        readableTranscriptText: block.transcriptText,
      };
    }

    const cleanedResults: TranscriptCleanerAgentResult[] = [];
    let memory = buildInitialTranscriptionMemory();
    this.logger.log(
      `transcription.memory.start jobId=${jobId ?? 'null'} candidateWindowOrder=${block.ordre} ${summarizeTranscriptionMemory(memory)}`,
    );
    for (const segmentBlock of segmentation.blocks) {
      if (!shouldRunTranscriptCleaner(segmentBlock)) {
        continue;
      }
      const chunks = splitSegmentationBlockForCleaning({
        block: segmentBlock,
        transcriptText: block.transcriptText,
      });
      this.logger.log(
        `transcription.chunking.block jobId=${jobId ?? 'null'} candidateWindowOrder=${block.ordre} blockId=${segmentBlock.id} chunks=${chunks.length} durationSec=${(segmentBlock.endTime - segmentBlock.startTime).toFixed(2)}`,
      );
      for (const chunk of chunks) {
        const transcriptText = this.transcriptCleanerAgent.extractTranscriptForBlock(
          block.transcriptText,
          {
            startTime: chunk.startTime,
            endTime: chunk.endTime,
          },
        );
        const cleaned = await this.transcriptCleanerAgent.run({
          jobId,
          candidateWindowOrder: block.ordre,
          windowStartTime: block.startTime,
          windowEndTime: block.endTime,
          block: chunk,
          transcriptText,
          status: block.segmentStatut,
          memory,
        });
        if (cleaned) {
          cleanedResults.push(cleaned);
          memory = updateTranscriptionMemory(memory, cleaned);
          this.logger.log(
            `transcription.memory.updated jobId=${jobId ?? 'null'} candidateWindowOrder=${block.ordre} blockId=${chunk.id} ${summarizeTranscriptionMemory(memory)}`,
          );
        }
      }
    }

    const dialogue = this.transcriptCleanerAgent.mergeResults(cleanedResults);
    const readableTranscriptText = dialogue
      ? this.transcriptCleanerAgent.renderDialogueTurns(dialogue.turns)
      : block.transcriptText;
    const finalizerStats = dialogue?.finalizerStats;
    if (finalizerStats) {
      this.logger.log(
        `transcription.finalizer.done jobId=${jobId ?? 'null'} candidateWindowOrder=${block.ordre} inputTurns=${finalizerStats.inputTurns} outputTurns=${finalizerStats.outputTurns} duplicatesRemoved=${finalizerStats.duplicatesRemoved} repeatedTextCompactions=${finalizerStats.repeatedTextCompactions} nonClientCompacted=${finalizerStats.nonClientCompacted} hiddenTurns=${finalizerStats.hiddenTurns} compactMarkers=${finalizerStats.compactMarkers}`,
      );
    }

    this.logger.log(
      `pipeline.candidate_window.done jobId=${jobId ?? 'null'} candidateWindowOrder=${block.ordre} segmentationBlocks=${segmentation.blocks.length} cleanedBlocks=${cleanedResults.length} dialogueTurns=${dialogue?.turns.length ?? 0} usableForScoring=${dialogue?.usableForScoring ?? null}`,
    );

    return {
      dialogue,
      readableTranscriptText,
    };
  }
}
