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

export const REWRITE_SYSTEM_PROMPT =
  'Tu transformes des transcriptions commerciales hachées en dialogues lisibles, pour le groupe Finanssor (prospection porte-à-porte énergie, télécoms, assurance, services). Tu ne changes jamais le sens, tu n’inventes rien, et tu signales les passages incertains. Tu connais le vocabulaire métier et tu rétablis les noms propres mal transcrits par Whisper UNIQUEMENT quand le contexte les rend évidents.';

export const buildRewriteUserPrompt = (preparedTranscript: string): string =>
  [
    'Réécris le transcript ci-dessous en dialogue lisible et fluide.',
    '',
    'Règles strictes:',
    '- Ne change pas le sens, n’ajoute aucune information absente du transcript.',
    '- Regroupe les fragments qui appartiennent à la même phrase ou au même tour de parole.',
    '- Supprime les ellipses répétitives "...", "....", "… … …".',
    '- Si un passage est incompréhensible: écris "[passage inaudible]".',
    '- Structure en tours de parole avec "Commercial :", "Client :" ou "Intervenant :" si le locuteur est incertain.',
    '- Ne mets pas un timestamp à chaque phrase. Tu peux garder un timestamp au début d’un grand bloc seulement si utile.',
    '- Corrige uniquement ponctuation, majuscules, répétitions évidentes et segmentation.',
    '- Retourne uniquement le texte réécrit, sans markdown.',
    '',
    'Vocabulaire métier Finanssor — à orthographier correctement quand le contexte rend la correction évidente:',
    '- Marques énergie: Plénitude (filiale ENI), ENI, OHM Énergie, EDF, GDF, TotalEnergies, Enedis, GRDF.',
    '- Marques télécom: France Téléphone, Bleutel, Bleubox, Mondial TV (Mondial.tv), Télécable, Orange, Bouygues, SFR.',
    '- Autres marques: Depan’ssur (Depanssur), Action Prévoyance, Néoliane, ECA, Finanssor.',
    '- Énergie: kilowatt-heure (kWh), compteur Linky, fournisseur, abonnement, contrat, tarification, facture, tarif bloqué, réduction, souscription, mise en service, PCE (gaz), PDL (électricité).',
    '- Télécom: forfait, carte SIM, eSIM, portabilité, 4G, 5G, Wi-Fi 6, fibre, box internet, débit.',
    '- Administratif: RIB, IBAN, mandat SEPA, sans engagement, délai de rétractation 14 jours, lettre de résiliation, livret A.',
    '',
    'Si tu lis "plénitude" en minuscule dans un contexte fournisseur énergie → écris "Plénitude" (la marque).',
    `Si tu lis "fonds d'avancement" / "changement d'avancement" → c'est probablement "fournisseur" / "changement de fournisseur".`,
    'Si tu lis "kilo" / "kilomètre" dans un contexte facture/tarif → c’est "kilowatt-heure" (kWh).',
    `Si tu lis "fuir tranquille" → c'est "finir tranquille".`,
    `Phrases d'accroche typiques: "Bonjour Monsieur/Madame, c'est [marque]...", "On passe suite à l'avis de passage", "Par rapport aux nouvelles tarifications", "J'en ai juste pour 2 petites minutes".`,
    '',
    'Si tu doutes, ne touche pas. Préserve les hésitations qui éclairent le coaching ("euh", "ben") sauf si purement parasites.',
    '',
    preparedTranscript,
  ].join('\n');

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
