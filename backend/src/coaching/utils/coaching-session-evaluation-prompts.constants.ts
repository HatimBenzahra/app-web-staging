import { buildDomainVocabularyPrompt } from './coaching-domain-vocabulary.constants';

export const SESSION_EVALUATION_JSON_SCHEMA = {
  name: 'session_evaluation',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'overallScore',
      'planCoverageScore',
      'executionQualityScore',
      'objectionHandlingScore',
      'listeningRatioScore',
      'closingScore',
      'summary',
      'strengths',
      'improvements',
      'recommendations',
      'keyMoments',
      'stepEvaluations',
    ],
    properties: {
      overallScore: { type: ['integer', 'null'] },
      planCoverageScore: { type: ['integer', 'null'] },
      executionQualityScore: { type: ['integer', 'null'] },
      objectionHandlingScore: { type: ['integer', 'null'] },
      listeningRatioScore: { type: ['integer', 'null'] },
      closingScore: { type: ['integer', 'null'] },
      summary: { type: ['string', 'null'] },
      strengths: { type: 'array', items: { type: 'string' } },
      improvements: { type: 'array', items: { type: 'string' } },
      recommendations: { type: 'array', items: { type: 'string' } },
      keyMoments: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'title'],
          properties: {
            type: { type: 'string' },
            title: { type: 'string' },
            summary: { type: ['string', 'null'] },
            startTime: { type: ['number', 'null'] },
            endTime: { type: ['number', 'null'] },
            verbatim: { type: ['string', 'null'] },
            importance: { type: ['integer', 'null'] },
          },
        },
      },
      stepEvaluations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['ordre', 'titre', 'coverageStatus'],
          properties: {
            ordre: { type: 'integer' },
            titre: { type: 'string' },
            coverageStatus: {
              type: 'string',
              enum: ['COVERED', 'PARTIAL', 'MISSING'],
            },
            score: { type: ['integer', 'null'] },
            startTime: { type: ['number', 'null'] },
            endTime: { type: ['number', 'null'] },
            verbatim: { type: ['string', 'null'] },
            feedback: { type: ['string', 'null'] },
            recommendation: { type: ['string', 'null'] },
          },
        },
      },
    },
  },
};

