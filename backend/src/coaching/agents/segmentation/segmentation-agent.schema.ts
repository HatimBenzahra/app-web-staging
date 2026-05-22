import type { CoachingAgentJsonSchema } from '../shared/coaching-agent.types';

export const SEGMENTATION_AGENT_JSON_SCHEMA: CoachingAgentJsonSchema = {
  name: 'coaching_segmentation_agent',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['blocks', 'uncertainties'],
    properties: {
      blocks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'id',
            'startTime',
            'endTime',
            'type',
            'confidence',
            'shouldClean',
            'reason',
          ],
          properties: {
            id: { type: 'string' },
            startTime: { type: 'number' },
            endTime: { type: 'number' },
            type: {
              type: 'string',
              enum: [
                'PROSPECT_INTERACTION',
                'INTERNAL_DISCUSSION',
                'NOISE',
                'INAUDIBLE',
                'UNCERTAIN',
              ],
            },
            confidence: { type: 'number' },
            shouldClean: { type: 'boolean' },
            reason: { type: ['string', 'null'] },
          },
        },
      },
      uncertainties: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
};
