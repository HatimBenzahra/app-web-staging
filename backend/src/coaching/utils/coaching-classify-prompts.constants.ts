import { buildDomainVocabularyPrompt } from './coaching-domain-vocabulary.constants';

export const CLASSIFY_SYSTEM_PROMPT =
  "Tu classifies des conversations de prospection porte-à-porte Finanssor. Tu identifies le type de conversation et les phases du plan de vente qui sont applicables. ATTENTION: tu reçois plusieurs fenêtres réparties sur la durée de la conversation (début/quart/mi-parcours/trois-quart/fin) — examine CHAQUE fenêtre car la conversation peut traverser plusieurs phases (énergie au début, télécom au milieu, signature/RIB à la fin). En cas de doute, INCLURE la phase (biais conservateur). Réponds UNIQUEMENT en JSON valide sans markdown.";

export const buildClassifyUserPrompt = (
  stepsList: string,
  snippet: string,
): string =>
  [
    'Phases du plan de vente disponibles:',
    stepsList,
    '',
    'Conversation à classifier (extraits répartis sur la durée totale):',
    snippet,
    '',
    'IMPORTANT — points à vérifier dans CHAQUE fenêtre:',
    '- Y a-t-il un pitch ÉNERGIE (Plénitude/EDF/GDF/kWh/Linky/PCE/PDL) ? → phases énergie applicables',
    '- Y a-t-il un pitch TÉLÉCOM (France Téléphone/Bleubox/fibre/box/Orange/Bouygues) ? → phases télécom applicables',
    '- Y a-t-il un pitch ASSURANCE (Néoliane/Action Prévoyance/ECA/assurance vie/mutuelle) ? → phases assurance applicables',
    "- Y a-t-il un pitch SERVICES (Depan'ssur/Mondial TV/conciergerie) ? → phases services applicables",
    '- Y a-t-il collecte de DONNÉES PERSONNELLES (date de naissance, mail, RIB, adresse) ? → phase RIB/signature applicable',
    '- Le ton passe-t-il de vouvoiement à tutoiement ? → climat de confiance applicable',
    '',
    'Identifie le type DOMINANT et les ordres des phases applicables.',
    'En cas de doute, INCLURE la phase (mieux vaut sur-évaluer que rater une phase pertinente).',
    "Si plusieurs thématiques sont présentes (énergie + télécom + assurance), type = 'MIXED' et inclure toutes les phases couvertes.",
  ].join('\n');

export const CLASSIFY_JSON_SCHEMA = {
  name: 'conv_classify',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['ENERGY', 'TELECOM', 'INSURANCE', 'MIXED', 'REFUSED', 'OTHER'],
      },
      applicableStepOrders: {
        type: 'array',
        items: { type: 'integer' },
      },
      reason: { type: 'string' },
    },
    required: ['type', 'applicableStepOrders', 'reason'],
    additionalProperties: false,
  },
};
