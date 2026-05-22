import type { DialogueReconstructionPayload } from '../types/coaching-dialogue.types';
import { renderCleanerDialogueTurns } from '../agents/transcript-cleaner/transcript-cleaner-agent-output.utils';
import { finalizeTranscriptionForUser } from './transcription-finalizer.utils';

describe('transcription finalizer', () => {
  it('supprime les doublons mécaniques proches', () => {
    const finalized = finalizeTranscriptionForUser({
      ...baseReconstruction(),
      turns: [
        commercialTurn(10, 12, 'Bonjour madame.'),
        commercialTurn(12, 14, 'Bonjour madame.'),
        prospectTurn(15, 17, 'Bonjour.'),
      ],
    });

    expect(finalized.turns).toHaveLength(2);
    expect(finalized.turns[0].text).toBe('Bonjour madame.');
    expect(finalized.finalizerStats?.duplicatesRemoved).toBe(1);
  });

  it('compacte les passages non-client longs en marqueur neutre', () => {
    const finalized = finalizeTranscriptionForUser({
      ...baseReconstruction(),
      turns: [
        internalTurn(1, 6, 'On monte au prochain étage.'),
        unknownTurn(7, 12, 'Bruit de couloir.'),
        commercialTurn(20, 24, 'Bonjour madame, c’est le groupe Finanssor.'),
      ],
    });

    expect(finalized.turns).toHaveLength(2);
    expect(finalized.turns[0]).toMatchObject({
      speaker: 'UNKNOWN',
      text: 'Passage hors échange client condensé.',
      blockType: undefined,
      exclusionReason: null,
    });
    expect(finalized.turns[1].speaker).toBe('COMMERCIAL');
    expect(finalized.finalizerStats?.nonClientCompacted).toBe(2);
    expect(finalized.finalizerStats?.compactMarkers).toBe(1);
  });

  it('garde les tours commercial et client ordonnés', () => {
    const finalized = finalizeTranscriptionForUser({
      ...baseReconstruction(),
      turns: [
        commercialTurn(1, 3, 'Bonjour monsieur.'),
        prospectTurn(4, 6, 'Pas intéressé, merci.'),
      ],
    });

    expect(finalized.turns.map((turn) => turn.speaker)).toEqual([
      'COMMERCIAL',
      'PROSPECT',
    ]);
    expect(finalized.prospectTurnCount).toBe(1);
  });

  it('rend une transcription utilisateur sans libellés diagnostic', () => {
    const finalized = finalizeTranscriptionForUser({
      ...baseReconstruction(),
      turns: [
        internalTurn(1, 8, 'C’est chaud. C’est chaud.'),
        commercialTurn(10, 12, 'Bonjour.'),
      ],
    });
    const rendered = renderCleanerDialogueTurns(finalized.turns);

    expect(rendered).toContain('Contexte');
    expect(rendered).toContain('Commercial');
    expect(rendered).not.toContain('Interne');
    expect(rendered).not.toContain('Incertain');
    expect(rendered).not.toContain('Bruit');
    expect(rendered).not.toContain('Inaudible');
  });
});

function baseReconstruction(): DialogueReconstructionPayload {
  return {
    conversationKind: 'MIXED',
    usableForScoring: false,
    prospectTurnCount: 0,
    internalTurnCount: 0,
    unknownTurnCount: 0,
    averageConfidence: 0.8,
    turns: [],
    uncertainties: [],
  };
}

function commercialTurn(startTime: number, endTime: number, text: string) {
  return {
    speaker: 'COMMERCIAL' as const,
    startTime,
    endTime,
    text,
    confidence: 0.9,
    scorable: true,
    displayable: true,
    blockType: 'PROSPECT_INTERACTION' as const,
  };
}

function prospectTurn(startTime: number, endTime: number, text: string) {
  return {
    speaker: 'PROSPECT' as const,
    startTime,
    endTime,
    text,
    confidence: 0.85,
    scorable: true,
    displayable: true,
    blockType: 'PROSPECT_INTERACTION' as const,
  };
}

function internalTurn(startTime: number, endTime: number, text: string) {
  return {
    speaker: 'INTERNAL' as const,
    startTime,
    endTime,
    text,
    confidence: 0.7,
    scorable: false,
    displayable: true,
    blockType: 'INTERNAL_DISCUSSION' as const,
  };
}

function unknownTurn(startTime: number, endTime: number, text: string) {
  return {
    speaker: 'UNKNOWN' as const,
    startTime,
    endTime,
    text,
    confidence: 0.4,
    scorable: false,
    displayable: true,
    blockType: 'NOISE' as const,
  };
}
