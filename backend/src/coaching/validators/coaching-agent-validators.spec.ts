import type { SalesPlanApplicationPayload } from '../scoring/coaching-scoring.types';
import { SalesPlanValidator } from './sales-plan.validator';
import { SegmentationValidator } from './segmentation.validator';

describe('SegmentationValidator', () => {
  const validator = new SegmentationValidator();

  it('borne, trie et signale les blocs invalides', () => {
    const result = validator.validate(
      {
        blocks: [
          {
            id: 'b',
            startTime: 20,
            endTime: 10,
            type: 'PROSPECT_INTERACTION',
            confidence: 1.5,
            shouldClean: true,
            reason: null,
          },
          {
            id: 'b',
            startTime: -5,
            endTime: 0.1,
            type: 'NOISE',
            confidence: -1,
            shouldClean: false,
            reason: null,
          },
        ],
        uncertainties: [],
      },
      { startTime: 0, endTime: 30 },
    );

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({
      id: 'b',
      startTime: 10,
      endTime: 20,
      confidence: 1,
    });
    expect(result.reasons).toEqual(
      expect.arrayContaining(['duplicate_id:b', 'too_short:b']),
    );
  });
});

describe('SalesPlanValidator', () => {
  const validator = new SalesPlanValidator();

  it('refuse une application sans preuve', () => {
    const application: SalesPlanApplicationPayload = {
      steps: [],
      keyMoments: [],
      strengths: [],
      improvements: [],
      recommendations: [],
      uncertainties: [],
    };

    expect(validator.validate(application)).toEqual({
      valid: false,
      reasons: ['no_steps', 'no_evidence'],
    });
  });

  it('accepte une application avec étape et verbatim', () => {
    const application: SalesPlanApplicationPayload = {
      steps: [
        {
          stepOrder: 1,
          observed: true,
          quality: 'PARTIAL',
          confidence: 0.8,
          evidence: [{ verbatim: 'Bonjour madame.' }],
          whatWentWell: [],
          whatIsMissing: [],
          coachingAdvice: [],
        },
      ],
      keyMoments: [],
      strengths: [],
      improvements: [],
      recommendations: [],
      uncertainties: [],
    };

    expect(validator.validate(application)).toEqual({
      valid: true,
      reasons: [],
    });
  });
});
