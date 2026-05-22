import { buildDomainVocabularyPrompt } from './coaching-domain-vocabulary.constants';

export const EVIDENCE_PROMPT_VERSION = 'evidence-v1';
export const PLAN_APPLICATION_PROMPT_VERSION = 'plan-application-v1';
export const REMARKS_PROMPT_VERSION = 'remarks-v1';
export const SCORING_SCHEMA_VERSION = 'prowin-evidence-v1';

export const APPLY_SALES_PLAN_SYSTEM_PROMPT = [
  'Tu es un coach commercial Pro-Win.',
  'Ton rôle est d’appliquer le plan de vente à une transcription de conversation terrain.',
  'Tu ne donnes pas de score global libre: le backend calculera les notes.',
  '',
  'Méthode:',
  '- Analyse chaque étape du plan de vente indépendamment.',
  '- Pour chaque étape, indique si elle est observée dans le transcript.',
  '- Cite des verbatims exacts ou quasi exacts pour justifier une étape observée.',
  '- Donne une qualité: MISSING, WEAK, PARTIAL ou COMPLETE.',
  '- Donne des remarques de coaching concrètes: points forts, manques, conseil actionnable.',
  '- Si une étape n’est pas observable, n’invente pas: observed=false, quality=MISSING.',
  '- Les timestamps sont optionnels; mets null si tu n’es pas sûr.',
  '- Réponds uniquement en JSON valide sans markdown.',
].join('\n');

export const buildApplySalesPlanUserPrompt = (input: {
  dialogueText: string;
  rawTranscriptText?: string | null;
  status?: string | null;
  segmentMetadata: Record<string, unknown>;
  salesPlan: {
    label?: string | null;
    promptInstructions?: string | null;
    steps: Array<{
      ordre: number;
      titre: string;
      description?: string | null;
      expectedSignals?: string | null;
      poids: number;
    }>;
  };
}): string =>
  [
    `Statut terrain: ${input.status || 'UNKNOWN'}`,
    `Métadonnées segment: ${JSON.stringify(input.segmentMetadata)}`,
    '',
    `Plan de vente: ${input.salesPlan.label || 'Sans libellé'}`,
    input.salesPlan.promptInstructions
      ? `Instructions plan: ${input.salesPlan.promptInstructions}`
      : '',
    '',
    'Étapes du plan à appliquer:',
    JSON.stringify(
      input.salesPlan.steps.map((step) => ({
        ordre: step.ordre,
        titre: step.titre,
        description: step.description,
        expectedSignals: step.expectedSignals,
        poids: step.poids,
      })),
      null,
      2,
    ),
    '',
    'Dialogue reconstruit validé (source principale):',
    input.dialogueText,
    '',
    input.rawTranscriptText
      ? `Transcript brut horodaté (backup, à utiliser seulement pour vérifier les preuves):\n${input.rawTranscriptText}`
      : '',
    '',
    'Retourne une analyse par étape du plan. Le but est de produire des remarques utiles et des verbatims, pas un score libre.',
    'Ne score que les tours prospect/commercial scorables. Ignore les lignes marquées [exclu scoring].',
    'Si une étape est impossible à vérifier à cause du transcript, indique quality=MISSING, scoreable=false et missingBecause=TRANSCRIPT_UNCLEAR.',
  ]
    .filter(Boolean)
    .join('\n');

export const APPLY_SALES_PLAN_JSON_SCHEMA = {
  name: 'coaching_sales_plan_application',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'conversationSummary',
      'steps',
      'keyMoments',
      'strengths',
      'improvements',
      'recommendations',
      'uncertainties',
    ],
    properties: {
      conversationSummary: { type: ['string', 'null'] },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'stepOrder',
            'stepTitle',
            'observed',
            'quality',
            'confidence',
            'evidence',
            'evidenceCompleteness',
            'missingBecause',
            'scoreable',
            'whatWentWell',
            'whatIsMissing',
            'coachingAdvice',
            'reasoning',
          ],
          properties: {
            stepOrder: { type: 'integer' },
            stepTitle: { type: ['string', 'null'] },
            observed: { type: 'boolean' },
            quality: {
              type: 'string',
              enum: ['MISSING', 'WEAK', 'PARTIAL', 'COMPLETE'],
            },
            confidence: { type: 'number' },
            evidence: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['verbatim', 'startTime', 'endTime', 'reason'],
                properties: {
                  verbatim: { type: 'string' },
                  startTime: { type: ['number', 'null'] },
                  endTime: { type: ['number', 'null'] },
                  reason: { type: ['string', 'null'] },
                  sourceTurnIds: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
            },
            evidenceCompleteness: {
              type: 'string',
              enum: ['FULL', 'PARTIAL', 'UNCERTAIN', 'NONE'],
            },
            missingBecause: {
              type: ['string', 'null'],
              enum: [
                'NOT_OBSERVED',
                'TRANSCRIPT_UNCLEAR',
                'NOT_APPLICABLE',
                null,
              ],
            },
            scoreable: { type: 'boolean' },
            whatWentWell: { type: 'array', items: { type: 'string' } },
            whatIsMissing: { type: 'array', items: { type: 'string' } },
            coachingAdvice: { type: 'array', items: { type: 'string' } },
            reasoning: { type: ['string', 'null'] },
          },
        },
      },
      keyMoments: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'type',
            'title',
            'summary',
            'verbatim',
            'startTime',
            'endTime',
            'importance',
          ],
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
      strengths: { type: 'array', items: { type: 'string' } },
      improvements: { type: 'array', items: { type: 'string' } },
      recommendations: { type: 'array', items: { type: 'string' } },
      uncertainties: { type: 'array', items: { type: 'string' } },
    },
  },
};
