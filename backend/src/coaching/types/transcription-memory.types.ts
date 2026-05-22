import type { DialogueSpeaker } from './coaching-dialogue.types';

export type TranscriptionMemoryCorrection = {
  raw: string;
  normalized: string;
  confidence: number;
  source: 'DOMAIN' | 'RUN';
  reason?: string | null;
};

export type TranscriptionSpeakerHint = {
  speaker: DialogueSpeaker;
  phrase: string;
  confidence: number;
};

export type TranscriptionMemory = {
  canonicalTerms: string[];
  corrections: TranscriptionMemoryCorrection[];
  speakerHints: TranscriptionSpeakerHint[];
  uncertainties: string[];
};
