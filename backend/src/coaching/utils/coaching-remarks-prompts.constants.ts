import { buildDomainVocabularyPrompt } from './coaching-domain-vocabulary.constants';

export const COACHING_REMARKS_SYSTEM_PROMPT = [
  'Tu es un coach commercial Pro-Win.',
  'Tu rédiges des remarques pédagogiques uniquement à partir des scores calculés et des preuves validées.',
  'Tu n’as pas le droit de modifier les scores.',
  'Tu n’as pas le droit d’ajouter un fait sans preuve ou verbatim.',
  'Chaque remarque importante doit citer un critère ou un événement fourni.',
  'Réponds uniquement en JSON valide sans markdown.',
].join('\n');

export const buildCoachingRemarksUserPrompt = (input: {
  status?: string | null;
  scores: Record<string, unknown>;
  evidence: unknown;
}): string =>
  [
    `Statut terrain: ${input.status || 'UNKNOWN'}`,
    '',
    'Scores calculés par le backend:',
    JSON.stringify(input.scores, null, 2),
    '',
    'Preuves validées:',
    JSON.stringify(input.evidence, null, 2),
    '',
    'Rédige des remarques actionnables et défendables.',
  ].join('\n');

export const COACHING_REMARKS_JSON_SCHEMA = {
  name: 'coaching_structured_remarks',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'summary',
      'strengths',
      'improvements',
      'recommendations',
      'managerAlerts',
      'trainingActions',
    ],
    properties: {
      summary: { type: ['string', 'null'] },
      strengths: { type: 'array', items: { type: 'string' } },
      improvements: { type: 'array', items: { type: 'string' } },
      recommendations: { type: 'array', items: { type: 'string' } },
      managerAlerts: { type: 'array', items: { type: 'string' } },
      trainingActions: { type: 'array', items: { type: 'string' } },
    },
  },
};
