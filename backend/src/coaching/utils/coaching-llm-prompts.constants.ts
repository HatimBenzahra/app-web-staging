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
  transcriptText: string;
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
    'Transcript conversation:',
    input.transcriptText,
    '',
    'Retourne une analyse par étape du plan. Le but est de produire des remarques utiles et des verbatims, pas un score libre.',
  ]
    .filter(Boolean)
    .join('\n');

export const APPLY_SALES_PLAN_JSON_SCHEMA = {
  name: 'coaching_sales_plan_application',
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
                },
              },
            },
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
