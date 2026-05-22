import { SegmentationAgentService } from '../agents/segmentation/segmentation-agent.service';
import type { SegmentationAgentResult } from '../agents/segmentation/segmentation-agent.types';
import { TranscriptCleanerAgentService } from '../agents/transcript-cleaner/transcript-cleaner-agent.service';
import type { TranscriptCleanerAgentResult } from '../agents/transcript-cleaner/transcript-cleaner-agent.types';
import type { DialogueReconstructionPayload } from '../types/coaching-dialogue.types';
import { CoachingAnalysisPipelineService } from './coaching-analysis-pipeline.service';
import type { CandidateWindowBlock } from './coaching-pipeline.types';
import { shouldRunSalesPlan } from './pipeline-quality-gates';

describe('CoachingAnalysisPipelineService', () => {
  const baseWindow: CandidateWindowBlock = {
    ordre: 1,
    title: 'Fenêtre 1',
    startTime: 0,
    endTime: 60,
    transcriptText: '[00:01 → 00:03] On monte au prochain étage.',
    segmentsCount: 1,
    status: 'COMPLETED',
    segmentType: 'PROSPECT',
  };

  it("n'appelle pas le cleaner quand la segmentation ne sort que du bruit non nettoyable", async () => {
    const segmentationResult: SegmentationAgentResult = {
      blocks: [
        {
          id: 'noise-1',
          startTime: 1,
          endTime: 20,
          type: 'NOISE',
          confidence: 0.9,
          shouldClean: false,
          reason: 'Bruit sans parole exploitable.',
        },
      ],
      uncertainties: [],
    };
    const segmentationAgent = {
      run: jest.fn().mockResolvedValue(segmentationResult),
    } as unknown as SegmentationAgentService;
    const transcriptCleanerAgent = {
      extractTranscriptForBlock: jest.fn(),
      run: jest.fn(),
      mergeResults: jest.fn(),
      renderDialogueTurns: jest.fn(),
    } as unknown as TranscriptCleanerAgentService;

    const service = new CoachingAnalysisPipelineService(
      segmentationAgent,
      transcriptCleanerAgent,
    );
    const result = await service.processCandidateWindow(baseWindow, 42);

    expect(result.dialogue).toBeNull();
    expect(result.readableTranscriptText).toBe(baseWindow.transcriptText);
    expect(transcriptCleanerAgent.run).not.toHaveBeenCalled();
  });

  it('nettoie aussi un bloc interne pour produire une transcription affichable', async () => {
    const segmentationResult: SegmentationAgentResult = {
      blocks: [{
        id: 'internal-1',
        startTime: 1,
        endTime: 20,
        type: 'INTERNAL_DISCUSSION',
        confidence: 0.9,
        shouldClean: true,
        reason: 'Discussion entre commerciaux.',
      }],
      uncertainties: [],
    };
    const dialogue: DialogueReconstructionPayload = {
      conversationKind: 'INTERNAL',
      usableForScoring: false,
      internalTurnCount: 1,
      prospectTurnCount: 0,
      unknownTurnCount: 0,
      averageConfidence: 0.8,
      turns: [{
        speaker: 'INTERNAL',
        startTime: 1,
        endTime: 3,
        text: 'On monte au prochain étage.',
        confidence: 0.8,
        blockType: 'INTERNAL_DISCUSSION',
        scorable: false,
        displayable: true,
      }],
      uncertainties: [],
    };
    const cleaned: TranscriptCleanerAgentResult = {
      ...dialogue,
      sourceBlockId: 'internal-1',
      sourceBlockType: 'INTERNAL_DISCUSSION',
    };
    const segmentationAgent = {
      run: jest.fn().mockResolvedValue(segmentationResult),
    } as unknown as SegmentationAgentService;
    const transcriptCleanerAgent = {
      extractTranscriptForBlock: jest.fn().mockReturnValue('[00:01 → 00:03] On monte au prochain étage.'),
      run: jest.fn().mockResolvedValue(cleaned),
      mergeResults: jest.fn().mockReturnValue(dialogue),
      renderDialogueTurns: jest.fn().mockReturnValue('Interne : On monte au prochain étage.'),
    } as unknown as TranscriptCleanerAgentService;

    const service = new CoachingAnalysisPipelineService(
      segmentationAgent,
      transcriptCleanerAgent,
    );
    const result = await service.processCandidateWindow(baseWindow, 42);

    expect(result.dialogue?.conversationKind).toBe('INTERNAL');
    expect(transcriptCleanerAgent.run).toHaveBeenCalledTimes(1);
  });

  it('remonte un dialogue non scoreable sans lancer la suite sales-plan', async () => {
    const segmentationResult: SegmentationAgentResult = {
      blocks: [
        {
          id: 'prospect-1',
          startTime: 1,
          endTime: 30,
          type: 'PROSPECT_INTERACTION',
          confidence: 0.8,
          shouldClean: true,
          reason: 'Interaction prospect probable.',
        },
      ],
      uncertainties: [],
    };
    const dialogue: DialogueReconstructionPayload = {
      conversationKind: 'PROSPECT',
      usableForScoring: false,
      scoreabilityReason: 'Transcript trop incertain.',
      prospectTurnCount: 1,
      internalTurnCount: 0,
      unknownTurnCount: 0,
      averageConfidence: 0.42,
      turns: [
        {
          speaker: 'COMMERCIAL',
          startTime: 1,
          endTime: 3,
          text: 'Bonjour monsieur.',
          confidence: 0.42,
          blockType: 'PROSPECT_INTERACTION',
          scorable: true,
          displayable: true,
        },
      ],
      uncertainties: ['Transcript incertain.'],
    };
    const cleaned: TranscriptCleanerAgentResult = {
      ...dialogue,
      sourceBlockId: 'prospect-1',
      sourceBlockType: 'PROSPECT_INTERACTION',
    };
    const segmentationAgent = {
      run: jest.fn().mockResolvedValue(segmentationResult),
    } as unknown as SegmentationAgentService;
    const transcriptCleanerAgent = {
      extractTranscriptForBlock: jest.fn().mockReturnValue('[00:01 → 00:03] Bonjour monsieur.'),
      run: jest.fn().mockResolvedValue(cleaned),
      mergeResults: jest.fn().mockReturnValue(dialogue),
      renderDialogueTurns: jest.fn().mockReturnValue('Commercial : Bonjour monsieur.'),
    } as unknown as TranscriptCleanerAgentService;

    const service = new CoachingAnalysisPipelineService(
      segmentationAgent,
      transcriptCleanerAgent,
    );
    const result = await service.processCandidateWindow(baseWindow, 42);

    expect(result.dialogue?.usableForScoring).toBe(false);
    expect(shouldRunSalesPlan(result.dialogue)).toBe(false);
    expect(transcriptCleanerAgent.run).toHaveBeenCalledTimes(1);
  });
});
