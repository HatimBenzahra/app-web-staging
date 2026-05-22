import { validateDialogueFaithfulness } from './dialogue-faithfulness.utils';
import type { DialogueReconstructionPayload } from '../types/coaching-dialogue.types';

const base = (
  turns: DialogueReconstructionPayload['turns'],
): DialogueReconstructionPayload => ({
  conversationKind: 'PROSPECT',
  usableForScoring: true,
  scoreabilityReason: null,
  prospectTurnCount: 0,
  internalTurnCount: 0,
  unknownTurnCount: 0,
  averageConfidence: 0.8,
  turns,
  uncertainties: [],
});

describe('validateDialogueFaithfulness', () => {
  it('accepte une normalisation métier contrôlée', () => {
    const result = validateDialogueFaithfulness(
      base([
        {
          speaker: 'COMMERCIAL',
          startTime: 1,
          endTime: 3,
          text: 'Bonjour monsieur, c’est le groupe Finanssor.',
          rawText: 'Bonjour monsieur, c’est le groupe financier.',
          normalizedText: 'Bonjour monsieur, c’est le groupe Finanssor.',
          sourceQuote: 'Bonjour monsieur, c’est le groupe financier.',
          confidence: 0.82,
          textConfidence: 0.82,
          speakerConfidence: 0.8,
          correctionLevel: 'LIGHT',
          scorable: true,
          exclusionReason: null,
          reason: 'Ouverture commerciale probable.',
          normalizations: [
            {
              raw: 'groupe financier',
              normalized: 'groupe Finanssor',
              type: 'DOMAIN_VOCABULARY',
              confidence: 0.86,
              meaningChanged: false,
              reason: 'Nom de marque mal transcrit.',
            },
          ],
        },
      ]),
    );

    expect(result.reconstruction.usableForScoring).toBe(true);
    expect(result.reconstruction.turns[0]).toMatchObject({
      scorable: true,
      correctionLevel: 'LIGHT',
    });
  });

  it('exclut une reformulation qui ajoute trop de contenu', () => {
    const result = validateDialogueFaithfulness(
      base([
        {
          speaker: 'COMMERCIAL',
          startTime: 1,
          endTime: 3,
          text: 'Bonjour, je suis de Finanssor, avez-vous deux minutes pour parler de vos factures ?',
          rawText: 'Bonjour... électricité... deux minutes.',
          normalizedText:
            'Bonjour, je suis de Finanssor, avez-vous deux minutes pour parler de vos factures ?',
          sourceQuote: 'Bonjour... électricité... deux minutes.',
          confidence: 0.7,
          textConfidence: 0.7,
          speakerConfidence: 0.7,
          correctionLevel: 'MEDIUM',
          scorable: true,
          exclusionReason: null,
          reason: null,
          normalizations: [],
        },
      ]),
    );

    expect(result.reconstruction.turns[0]).toMatchObject({
      scorable: false,
      correctionLevel: 'RISKY',
      exclusionReason: 'Normalisation trop éloignée du transcript brut.',
    });
    expect(result.reconstruction.usableForScoring).toBe(false);
  });

  it('exclut les échanges internes du scoring', () => {
    const result = validateDialogueFaithfulness(
      base([
        {
          speaker: 'INTERNAL',
          startTime: 10,
          endTime: 12,
          text: 'C’est chaud.',
          rawText: 'C’est chaud.',
          normalizedText: 'C’est chaud.',
          sourceQuote: 'C’est chaud.',
          confidence: 0.9,
          textConfidence: 0.9,
          speakerConfidence: 0.9,
          correctionLevel: 'NONE',
          scorable: true,
          exclusionReason: null,
          reason: 'Échange entre commerciaux.',
          normalizations: [],
        },
      ]),
    );

    expect(result.reconstruction.turns[0]).toMatchObject({
      scorable: false,
      exclusionReason: 'Échange interne entre commerciaux, exclu du scoring.',
    });
    expect(result.metrics.internalTurnCount).toBe(1);
  });

  it('dégrade une transcription finale avec plusieurs locuteurs dans un même tour', () => {
    const result = validateDialogueFaithfulness(
      base([
        {
          speaker: 'COMMERCIAL',
          startTime: 10,
          endTime: 20,
          text: 'Commercial : Bonjour. Client : Non merci.',
          rawText: 'Commercial : Bonjour. Client : Non merci.',
          normalizedText: 'Commercial : Bonjour. Client : Non merci.',
          sourceQuote: 'Commercial : Bonjour. Client : Non merci.',
          confidence: 0.8,
          textConfidence: 0.8,
          speakerConfidence: 0.8,
          correctionLevel: 'NONE',
          scorable: true,
          displayable: true,
          blockType: 'PROSPECT_INTERACTION',
          exclusionReason: null,
          reason: null,
          normalizations: [],
        },
      ]),
    );

    expect(result.reconstruction.usableForScoring).toBe(false);
    expect(result.reconstruction.turns[0]).toMatchObject({
      scorable: false,
      correctionLevel: 'RISKY',
      exclusionReason: 'Plusieurs locuteurs détectés dans un même tour.',
    });
    expect(result.metrics.cleanTranscriptQuality).toBe('BAD');
    expect(result.metrics.multiSpeakerTurnsDetected).toBe(1);
  });

  it('masque une note méta dans la transcription finale', () => {
    const result = validateDialogueFaithfulness(
      base([
        {
          speaker: 'UNKNOWN',
          startTime: 20,
          endTime: 25,
          text: '[Note : transcript original incohérent.]',
          rawText: '[Note : transcript original incohérent.]',
          normalizedText: '[Note : transcript original incohérent.]',
          sourceQuote: '[Note : transcript original incohérent.]',
          confidence: 0.7,
          textConfidence: 0.7,
          speakerConfidence: 0.7,
          correctionLevel: 'NONE',
          scorable: true,
          displayable: true,
          blockType: 'UNCERTAIN',
          exclusionReason: null,
          reason: null,
          normalizations: [],
        },
      ]),
    );

    expect(result.reconstruction.turns[0]).toMatchObject({
      displayable: false,
      scorable: false,
      exclusionReason: 'Note méta détectée dans la transcription finale.',
    });
    expect(result.metrics.metaNotesDetected).toBe(1);
    expect(result.metrics.cleanTranscriptQuality).toBe('BAD');
  });

  it("accepte les timestamps dans sourceQuote d'audit", () => {
    const result = validateDialogueFaithfulness(
      base([
        {
          speaker: 'COMMERCIAL',
          startTime: 24,
          endTime: 32,
          text: "Bonjour monsieur, c'est le groupe Finanssor.",
          rawText: "Bonjour monsieur, c'est le gros financeur.",
          normalizedText: "Bonjour monsieur, c'est le groupe Finanssor.",
          sourceQuote:
            "[00:24-00:26] Bonjour ! [00:26-00:32] c'est le gros financeur.",
          confidence: 0.86,
          textConfidence: 0.9,
          speakerConfidence: 0.9,
          correctionLevel: 'LIGHT',
          scorable: true,
          displayable: true,
          blockType: 'PROSPECT_INTERACTION',
          exclusionReason: null,
          reason: null,
          normalizations: [
            {
              raw: 'gros financeur',
              normalized: 'groupe Finanssor',
              type: 'DOMAIN_VOCABULARY',
              confidence: 0.86,
              meaningChanged: false,
              reason: 'Correction métier fiable.',
            },
          ],
        },
      ]),
    );

    expect(result.metrics.inlineTimecodesDetected).toBe(0);
    expect(result.reconstruction.turns[0]).toMatchObject({
      scorable: true,
      exclusionReason: null,
    });
  });
});
