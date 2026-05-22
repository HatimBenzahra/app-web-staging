import { buildDomainVocabularyPrompt } from './coaching-domain-vocabulary.constants';

export const DETECT_CHUNK_SYSTEM_PROMPT = [
  'Tu analyses un enregistrement audio de prospection commerciale porte-à-porte du groupe Finanssor (énergie/télécoms/assurance/services).',
  "Le transcript t'arrive par chunks séquentiels. Tu maintiens un état entre les chunks pour suivre les conversations ouvertes/fermées.",
  '',
  "STATISTIQUE MÉTIER CLÉ: une session typique de PaP de 20-40 min contient 4-12 conversations distinctes (autant que de portes visitées). Une session de 60 min en contient 8-20. Tu DOIS détecter ces multiples conversations. Si tu ne renvoies qu'1 seule conversation sur > 8 min de transcript, tu te trompes presque certainement.",
  '',
  `Une "conversation prospect" (type "prospect") est un échange à au moins 2 voix entre un commercial démarcheur et un occupant d'un logement (ou de son représentant) parlant des produits Finanssor (Plénitude/OHM Énergie pour électricité+gaz, France Téléphone/Bleubox pour télécom, Pack Depan'ssur, Action Prévoyance, Mondial TV, ECA pour assurances).`,
  '',
  `Phrases d'accroche typiques (signal très fort de "prospect" qui DÉMARRE une nouvelle conversation):`,
  `- "Bonjour Monsieur/Madame, c'est Plénitude / on passe suite à l'avis de passage..."`,
  `- "On est chargé de voir tout le monde dans l'immeuble concernant l'électricité et le gaz / la fibre / les télécoms."`,
  '- "Je passe par rapport aux nouvelles tarifications qui sont revues à la baisse à cause de la concurrence."',
  '- "Je vous propose de baisser vos factures."',
  `- "J'en ai juste pour 2 petites minutes."`,
  `→ Chaque "Bonjour Monsieur/Madame" suivi d'une accroche démarre une NOUVELLE conversation, même si la précédente était sur le même immeuble.`,
  '',
  'SIGNAUX DE FIN DE CONVERSATION (FERME la conv courante et ouvre éventuellement une nouvelle):',
  '- Formules de clôture: "Au revoir", "Bonne journée", "Merci", "Bonne soirée", "Bon courage", "Bon weekend".',
  `- Refus net: "Non merci", "Ça ne m'intéresse pas", "Au revoir, je n'ai pas le temps".`,
  '- Renvoi: "Vous reviendrez plus tard", "Demandez à mon mari/ma femme".',
  '- Transition logistique entre prospects: silence > 20s, bruits de pas/déplacement, "On va voir l\'appartement d\'à côté", "On monte au 3e", "Le suivant", "Allez on y va".',
  `- Échange entre commerciaux ("T'as eu quoi ?", "Lui c'est mort", "On va sonner chez le voisin") = signal très fort de transition entre 2 prospects.`,
  '',
  "RÈGLE STRICTE: NE FUSIONNE JAMAIS 2 prospects différents dans une seule conversation, même si tu n'es pas sûr exactement où la transition a lieu. En cas de doute sur la frontière, coupe plutôt que fusionner.",
  '',
  "Objections typiques (signal de tournant interne à une conv, PAS de fin nécessairement):",
  '- "Vous êtes là pourquoi exactement ?"',
  '- "On reste chez EDF/GDF/Orange."',
  `- "Mon mari/ma femme s'en occupe."`,
  '',
  'Ne PAS classer "prospect" (utiliser "internal" ou "noise"):',
  `- Discussions entre commerciaux ("Tu m'changes ma tablette ?", "T'as les codes ?", "On va au prochain immeuble").`,
  '- Appels téléphoniques internes / debrief manager.',
  '- Monologues commerciaux sans interlocuteur (récap, dictée de notes).',
  '- Bruits, silences, fragments isolés sans contexte.',
  '',
  'Tu réponds UNIQUEMENT en JSON valide sans markdown.',
].join('\n');

export const buildDetectChunkUserPrompt = (
  stateJson: string,
  chunkText: string,
  isLastChunk: boolean,
): string =>
  [
    'État reçu du chunk précédent:',
    stateJson,
    '',
    'Nouveau chunk de transcript (timecodes MM:SS):',
    chunkText,
    '',
    isLastChunk
      ? "C'est le DERNIER chunk: si une conversation est encore ouverte à la fin, ferme-la au dernier timestamp visible et inclus-la dans closed_conversations. Mets conversation_open = false dans state."
      : 'Si une conversation est encore ouverte à la fin du chunk, indique son état (conversation_open, current_start_time, current_summary court < 200 chars) dans state pour le chunk suivant.',
    '',
    'Renvoie UNIQUEMENT un objet JSON de la forme:',
    '{',
    '  "closed_conversations": [',
    '    {',
    '      "startTime": <secondes float>,',
    '      "endTime": <secondes float>,',
    '      "type": "prospect" | "internal" | "noise",',
    '      "reason": "<courte explication FR>"',
    '    }',
    '  ],',
    '  "state": {',
    '    "conversation_open": <bool>,',
    '    "current_start_time": <secondes float ou null>,',
    '    "current_summary": "<résumé < 200 chars de la conv en cours, vide si pas ouverte>"',
    '  }',
    '}',
  ].join('\n');

export const DETECT_CHUNK_JSON_SCHEMA = {
  name: 'conversation_detection',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['closed_conversations', 'state'],
    properties: {
      closed_conversations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['startTime', 'endTime', 'type', 'reason'],
          properties: {
            startTime: { type: 'number' },
            endTime: { type: 'number' },
            type: {
              type: 'string',
              enum: ['prospect', 'internal', 'noise'],
            },
            reason: { type: 'string' },
          },
        },
      },
      state: {
        type: 'object',
        additionalProperties: false,
        required: ['conversation_open', 'current_start_time', 'current_summary'],
        properties: {
          conversation_open: { type: 'boolean' },
          current_start_time: { type: ['number', 'null'] },
          current_summary: { type: 'string' },
        },
      },
    },
  },
};
