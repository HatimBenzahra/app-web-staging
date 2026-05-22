import { buildDomainVocabularyPrompt } from './coaching-domain-vocabulary.constants';

export const EVIDENCE_EXTRACTION_SYSTEM_PROMPT = [
  'Tu es un auditeur de preuves pour le coaching commercial Pro-Win.',
  'Tu ne donnes JAMAIS de score libre.',
  'Ton rôle est uniquement d’identifier des preuves observables dans le transcript.',
  '',
  'Règles strictes:',
  '- Un critère trouvé doit avoir un verbatim exact ou quasi exact du transcript.',
  '- Sans verbatim, found=false et quality=MISSING.',
  '- Ne déduis pas une action si elle n’est pas observable.',
  '- Les timestamps doivent correspondre au passage cité si disponibles.',
  '- Si le transcript est incomplet, signale l’incertitude au lieu d’inventer.',
  '- Réponds uniquement en JSON valide sans markdown.',
].join('\n');

export const buildEvidenceExtractionUserPrompt = (input: {
  transcriptText: string;
  status?: string | null;
  segmentMetadata: Record<string, unknown>;
  criteria: Array<{
    stepOrder: number;
    stepTitle: string;
    key: string;
    label: string;
    description?: string | null;
    weight: number;
    required: boolean;
    expectedEvidence?: string | null;
    negativeSignals?: string | null;
  }>;
}): string =>
  [
    `Statut terrain: ${input.status || 'UNKNOWN'}`,
    `Métadonnées segment: ${JSON.stringify(input.segmentMetadata)}`,
    '',
    'Scorecard applicable:',
    JSON.stringify(
      input.criteria.map((criterion) => ({
        stepOrder: criterion.stepOrder,
        stepTitle: criterion.stepTitle,
        criterionKey: criterion.key,
        label: criterion.label,
        description: criterion.description,
        required: criterion.required,
        expectedEvidence: criterion.expectedEvidence,
        negativeSignals: criterion.negativeSignals,
      })),
      null,
      2,
    ),
    '',
    'Transcript:',
    input.transcriptText,
    '',
    'Retourne les preuves pour chaque critère applicable. Ne note pas la conversation.',
  ].join('\n');

export const EVIDENCE_EXTRACTION_JSON_SCHEMA = {
  name: 'coaching_evidence_extraction',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['segmentQuality', 'criteriaEvidence', 'keyEvents', 'uncertainties'],
    properties: {
      segmentQuality: {
        type: 'object',
        additionalProperties: false,
        required: ['evaluable', 'reason', 'confidence'],
        properties: {
          evaluable: { type: 'boolean' },
          reason: { type: ['string', 'null'] },
          confidence: { type: ['number', 'null'] },
        },
      },
      criteriaEvidence: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'stepOrder',
            'criterionKey',
            'found',
            'quality',
            'confidence',
            'verbatim',
            'startTime',
            'endTime',
            'reason',
          ],
          properties: {
            stepOrder: { type: 'integer' },
            criterionKey: { type: 'string' },
            found: { type: 'boolean' },
            quality: {
              type: 'string',
              enum: ['MISSING', 'WEAK', 'PARTIAL', 'COMPLETE'],
            },
            confidence: { type: 'number' },
            verbatim: { type: ['string', 'null'] },
            startTime: { type: ['number', 'null'] },
            endTime: { type: ['number', 'null'] },
            reason: { type: ['string', 'null'] },
          },
        },
      },
      keyEvents: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'title', 'summary', 'verbatim', 'startTime', 'endTime', 'importance'],
          properties: {
            type: { type: 'string' },
            title: { type: ['string', 'null'] },
            summary: { type: ['string', 'null'] },
            verbatim: { type: ['string', 'null'] },
            startTime: { type: ['number', 'null'] },
            endTime: { type: ['number', 'null'] },
            importance: { type: ['integer', 'null'] },
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
