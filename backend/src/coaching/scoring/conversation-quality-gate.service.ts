import { Injectable } from '@nestjs/common';
import { QualityGateResult } from './coaching-scoring.types';
import { computeTranscriptQuality } from '../utils/transcript-quality.utils';

type ConversationQualityInput = {
  status?: string | null;
  type?: string | null;
  source?: string | null;
  confidence?: number | null;
  speechScore?: number | null;
  durationSec: number;
  transcriptText: string;
};

@Injectable()
export class ConversationQualityGateService {
  evaluate(input: ConversationQualityInput): QualityGateResult {
    const reasons: string[] = [];
    const transcriptQuality = computeTranscriptQuality({
      transcriptText: input.transcriptText,
      durationSec: input.durationSec,
      speechScore: input.speechScore,
    });
    const textLength = transcriptQuality.textLength;
    let confidence = this.clamp(input.confidence ?? 0.75);
    const qualityPayload = {
      state: transcriptQuality.state,
      charsPerMin: transcriptQuality.charsPerMin,
      duplicateRatio: transcriptQuality.duplicateRatio,
      textLength: transcriptQuality.textLength,
      suspiciousPhraseCount: transcriptQuality.suspiciousPhraseCount,
    };

    if (input.type === 'INTERNAL' || input.type === 'NOISE') {
      return {
        decision: 'SKIP',
        reasons: [`Segment ${input.type.toLowerCase()} non évaluable commercialement.`],
        confidence: Math.min(confidence, 0.3),
        transcriptQuality: qualityPayload,
      };
    }

    if (transcriptQuality.state === 'NON_EVALUABLE') {
      return {
        decision: textLength === 0 ? 'SKIP' : 'REVIEW_ONLY',
        reasons: transcriptQuality.reasons,
        confidence: Math.min(confidence, 0.25),
        transcriptQuality: qualityPayload,
      };
    }

    reasons.push(...transcriptQuality.reasons);
    if (transcriptQuality.state === 'REVIEW') {
      confidence = Math.min(confidence, 0.6);
    }

    if (input.durationSec < 15) {
      reasons.push('Segment très court (< 15 s).');
      confidence = Math.min(confidence, 0.45);
    } else if (input.durationSec < 30) {
      reasons.push('Segment court (15-30 s), scoring à vérifier.');
      confidence = Math.min(confidence, 0.65);
    }

    if (input.speechScore != null && input.speechScore < 35) {
      reasons.push('Score de parole faible.');
      confidence = Math.min(confidence, 0.55);
    }

    if (textLength < 80) {
      reasons.push('Transcript pauvre pour une évaluation complète.');
      confidence = Math.min(confidence, 0.6);
    }

    if (input.type === 'UNKNOWN') {
      reasons.push('Type de segment inconnu.');
      confidence = Math.min(confidence, 0.55);
    }

    if (input.source === 'AUDIO_TRANSCRIPT' || input.source === 'FALLBACK') {
      reasons.push('Segmentation issue d’un fallback audio.');
      confidence = Math.min(confidence, 0.55);
    }

    if (input.status === 'ABSENT' && textLength > 80) {
      reasons.push('Statut ABSENT incohérent avec une parole détectée.');
      confidence = Math.min(confidence, 0.45);
      return {
        decision: 'REVIEW_ONLY',
        reasons,
        confidence,
        transcriptQuality: qualityPayload,
      };
    }

    if (reasons.length === 0) {
      return {
        decision: 'EVALUATE',
        reasons: [],
        confidence,
        transcriptQuality: qualityPayload,
      };
    }

    if (confidence < 0.45) {
      return {
        decision: 'REVIEW_ONLY',
        reasons,
        confidence,
        transcriptQuality: qualityPayload,
      };
    }

    return {
      decision: 'EVALUATE_WITH_REVIEW',
      reasons,
      confidence,
      transcriptQuality: qualityPayload,
    };
  }

  private clamp(value: number): number {
    if (!Number.isFinite(value)) return 0.5;
    return Math.max(0, Math.min(1, value));
  }
}
