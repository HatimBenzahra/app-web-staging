import type { TranscriptCleanerAgentResult } from '../agents/transcript-cleaner/transcript-cleaner-agent.types';
import {
  buildInitialTranscriptionMemory,
  renderTranscriptionMemoryPrompt,
  updateTranscriptionMemory,
} from './transcription-memory.utils';

describe('transcription memory', () => {
  it('charge les corrections métier contrôlées au démarrage', () => {
    const memory = buildInitialTranscriptionMemory();
    const prompt = renderTranscriptionMemoryPrompt(memory);

    expect(prompt).toContain('gros financeur');
    expect(prompt).toContain('groupe Finanssor');
    expect(prompt).toContain('gaz et électricité');
  });

  it('réutilise les normalisations fiables sans garder les corrections risquées', () => {
    const memory = buildInitialTranscriptionMemory();
    const result: TranscriptCleanerAgentResult = {
      conversationKind: 'PROSPECT',
      usableForScoring: false,
      prospectTurnCount: 1,
      internalTurnCount: 0,
      unknownTurnCount: 0,
      averageConfidence: 0.8,
      turns: [{
        speaker: 'COMMERCIAL',
        startTime: 1,
        endTime: 4,
        text: 'Bonjour, c’est le groupe Finanssor.',
        rawText: 'Bonjour, c’est le gros financeur.',
        normalizedText: 'Bonjour, c’est le groupe Finanssor.',
        sourceQuote: 'Bonjour, c’est le gros financeur.',
        confidence: 0.82,
        normalizations: [
          {
            raw: 'gros financeur',
            normalized: 'groupe Finanssor',
            type: 'DOMAIN_VOCABULARY',
            confidence: 0.86,
            meaningChanged: false,
            reason: 'Correction métier fiable.',
          },
          {
            raw: 'bonjour',
            normalized: 'signature immédiate',
            type: 'PHONETIC_CONTEXTUAL',
            confidence: 0.4,
            meaningChanged: true,
            reason: 'Correction risquée.',
          },
        ],
        scorable: false,
        displayable: true,
        blockType: 'PROSPECT_INTERACTION',
      }],
      uncertainties: ['passage bruité'],
      sourceBlockId: 'block-1',
      sourceBlockType: 'PROSPECT_INTERACTION',
    };

    const updated = updateTranscriptionMemory(memory, result);
    const prompt = renderTranscriptionMemoryPrompt(updated);

    expect(prompt).toContain('gros financeur');
    expect(prompt).toContain('groupe Finanssor');
    expect(prompt).not.toContain('signature immédiate');
    expect(updated.speakerHints[0]).toMatchObject({ speaker: 'COMMERCIAL' });
  });
});
