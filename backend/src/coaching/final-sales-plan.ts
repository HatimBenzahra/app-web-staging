export const FINAL_SALES_PLAN_VERSION_LABEL = 'finanssor-final-2026-02-context-v2';

export const FINAL_SALES_PLAN_TITLE = 'Plan de vente Finanssor final';

export const FINAL_SALES_PLAN_DESCRIPTION =
  'Plan de vente final Finanssor extrait du PDF: phases porte-a-porte, découverte, offres, souscription, validation et confort après signature.';

export const FINAL_SALES_PLAN_PROMPT = [
  'Tu es un coach de vente porte-a-porte pour le groupe Finanssor.',
  'Analyse uniquement le transcript fourni et le plan de vente actif. N’invente pas de faits absents du transcript.',
  'Commence par lire la scène commerciale globale avant de scorer: phase réelle observée, progression dans le plan, étapes observables, étapes non observables dans ce segment, et étapes attendues mais manquées.',
  'Ne fais pas une recherche de mots-clés isolés. Interprète le sens du transcript et compare-le aux phases, scripts, signaux attendus et signaux négatifs du plan.',
  'Détecte les produits réellement évoqués dans le transcript avec preuves textuelles.',
  'Score toujours les critères universels. Score les critères produit uniquement si le produit correspondant est détecté.',
  'Pour chaque critère applicable, retourne un score de 0 à 100, des preuves courtes du transcript, une justification liée au plan de vente, et des recommandations concrètes.',
  'Chaque critère doit préciser son applicabilité: observable, partially_observable, not_observable ou missed.',
  'Ne pénalise pas une étape not_observable parce que le segment commence après cette phase. Pénalise une étape missed si elle aurait dû apparaître dans la phase observée.',
  'Le backend calcule le score final pondéré. Ne force pas un score global.',
].join('\n');

export const FINAL_SALES_PLAN_PRODUCTS = [
  {
    key: 'plenitude_energy',
    title: 'Plénitude énergie',
    detectionSignals: [
      'électricité',
      'gaz',
      'Plénitude',
      'ENI',
      'compteur',
      'facture énergie',
      'tarification',
    ],
    phaseRefs: ['Phase 4', 'Phase 5'],
  },
  {
    key: 'depanssur',
    title: 'Pack DEPANSSUR',
    detectionSignals: [
      'Dépansur',
      'boitier',
      'box économie',
      'économiseur d’eau',
      'assistance plomberie',
      '9,90',
    ],
    phaseRefs: ['Phase 6'],
  },
  {
    key: 'france_telephone',
    title: 'France Téléphone',
    detectionSignals: [
      'France Téléphone',
      'forfait mobile',
      'SIM',
      '3179',
      'portabilité',
      'box internet',
    ],
    phaseRefs: ['Phase 8'],
  },
  {
    key: 'bleubox',
    title: 'Bleubox',
    detectionSignals: [
      'Bleubox',
      '4G',
      '5G',
      'routeur',
      'Wi-Fi 6',
      'très haut débit',
    ],
    phaseRefs: ['Phase 9'],
  },
  {
    key: 'concierge',
    title: 'Conciergerie Action Prévoyance',
    detectionSignals: [
      'Action Réduction',
      'assistant personnel',
      'conciergerie',
      'réductions',
      '14,90',
    ],
    phaseRefs: ['Phase 10'],
  },
  {
    key: 'mondial_tv',
    title: 'Mondial TV',
    detectionSignals: [
      'Mondial TV',
      '250 chaînes',
      'application',
      'avis client',
      'télécable',
      '9,90',
    ],
    phaseRefs: ['Phase 11'],
  },
  {
    key: 'mutuelle',
    title: 'Mutuelle santé',
    detectionSignals: [
      'mutuelle',
      'Sécurité sociale',
      'carte mutuelle',
      'garanties santé',
      'Neoliane',
      'ECA',
    ],
    phaseRefs: ['Phase 14'],
  },
  {
    key: 'prevoyance',
    title: 'Prévoyance, IJH, capital décès, obsèques',
    detectionSignals: [
      'hospitalisation',
      'indemnité journalière',
      'capital décès',
      'obsèques',
      'protéger vos proches',
    ],
    phaseRefs: ['Phase 15'],
  },
  {
    key: 'habitation',
    title: 'Assurance habitation',
    detectionSignals: [
      'assurance habitation',
      'logement',
      'échéancier',
      'Loi Hamon',
      'dégât des eaux',
      'incendie',
    ],
    phaseRefs: ['Phase 16'],
  },
  {
    key: 'protection_juridique',
    title: 'Protection juridique',
    detectionSignals: [
      'protection juridique',
      'litige',
      'juriste',
      'avocat',
      'artisan',
      'voisin',
      '12,90',
    ],
    phaseRefs: ['Phase 17'],
  },
];

export const FINAL_SALES_PLAN_CRITERIA = [
  {
    key: 'door_approach',
    title: 'Passage à la porte et accroche',
    weight: 15,
    phaseRefs: ['Phase 2'],
    expectedSignals: [
      'Badge visible, posture souriante, dynamique et directive',
      'Phrase d’accroche claire: avis de passage, voir tout le monde dans l’immeuble, électricité/gaz, deux minutes',
      'Ne commence pas une argumentation complète sur le pas de porte',
      'Important : Cherche à entrer ou à obtenir un moment de rencontre',
    ],
    negativeSignals: [
      'Accroche confuse ou trop vague',
      'Demande sensible trop rapide sans cadrage',
      'Abandon immédiat après une objection réflexe',
    ],
  },
  {
    key: 'trust_and_dialogue',
    title: 'Climat de confiance et dialogue',
    weight: 12,
    phaseRefs: ['Phase 3'],
    expectedSignals: [
      'Valorise le prospect et montre un intérêt sincère',
      'Pose des questions ouvertes',
      'Écoute davantage qu’il ne parle',
      'Complimente avec justesse sans flatterie excessive',
    ],
    negativeSignals: [
      'Monologue commercial',
      'Aucune adaptation à la situation du prospect',
      'Ton froid, pressant ou désorganisé',
    ],
  },
  {
    key: 'needs_discovery',
    title: 'Découverte et qualification des besoins',
    weight: 16,
    phaseRefs: ['Phase 4', 'Phase 8', 'Phase 14.1'],
    expectedSignals: [
      'Identifie fournisseur/opérateur/assureur actuel selon le contexte',
      'Demande prix, consommation, ancienneté, engagement, satisfaction et problèmes rencontrés',
      'Utilise les réponses pour argumenter ensuite',
      'Réalise ou prépare une estimation sur tablette quand le plan le demande',
    ],
    negativeSignals: [
      'Argumente avant de découvrir',
      'Questions intrusives sans justification',
      'Ne vérifie pas la situation contractuelle ou budgétaire',
    ],
  },
  {
    key: 'offer_argumentation',
    title: 'Argumentation de l’offre adaptée',
    weight: 18,
    phaseRefs: ['Phases 5 à 17'],
    expectedSignals: [
      'Présente le produit détecté avec ses bénéfices principaux',
      'Explique conservation des services, absence de coupure ou simplicité de mise en place quand applicable',
      'Met en avant l’économie, la sécurité, le confort ou le besoin SONCAS dominant',
      'Relie la proposition à la situation découverte chez le prospect',
    ],
    negativeSignals: [
      'Pitch générique non relié au besoin',
      'Promesse non étayée par le plan',
      'Confusion entre produits ou tarifs',
    ],
  },
  {
    key: 'objection_handling',
    title: 'Gestion des objections et reprise de contrôle',
    weight: 13,
    phaseRefs: ['Phase 2', 'Les 8 pas', 'SONCAS'],
    expectedSignals: [
      'Absorbe l’objection en reformulant ou en allant dans le sens du client',
      'Répond puis reprend le contrôle par questions fermées',
      'Reste poli, maître de lui-même et persévérant',
      'Utilise le levier SONCAS pertinent',
    ],
    negativeSignals: [
      'Confrontation ou insistance excessive',
      'Ne répond pas à l’objection',
      'Perd le contrôle de l’échange',
    ],
  },
  {
    key: 'closing_and_subscription',
    title: 'Clôture, souscription et RIB',
    weight: 12,
    phaseRefs: ['Phase 7', 'Phase 12', 'Phases produit'],
    expectedSignals: [
      'Propose une action immédiate claire',
      'Demande le RIB de façon naturelle et affirmative quand nécessaire',
      'Remplit le bulletin avec attention',
      'Prend les informations nécessaires avec clarté',
    ],
    negativeSignals: [
      'Pas de prochaine étape claire',
      'Demande RIB brutale ou mal justifiée',
      'Oublie les informations nécessaires à la souscription',
    ],
  },
  {
    key: 'compliance_and_validation',
    title: 'Conformité, résiliation, validation et relecture',
    weight: 9,
    phaseRefs: ['Phase 14.3', 'Phase 14.4', 'Phase 16.1', 'Phase 18'],
    expectedSignals: [
      'Respecte date d’effet, rétractation, résiliation et lois applicables quand le sujet apparaît',
      'Relit chaque information avec le client avant signature',
      'Explique absence de démarche client quand le plan le prévoit',
      'Vérifie exactitude des données: nom, IBAN, adresse, offre, options et tarifs',
    ],
    negativeSignals: [
      'Omet les délais ou conditions de résiliation',
      'Ne sécurise pas la validation tablette',
      'Risque de défaut de conseil',
    ],
  },
  {
    key: 'post_signature_comfort',
    title: 'Confort de vente après signature',
    weight: 5,
    phaseRefs: ['Phase 19'],
    expectedSignals: [
      'Reste avec le client après signature pour créer un lien durable',
      'Réduit les risques de rétractation',
      'Finalise une expérience d’achat positive',
    ],
    negativeSignals: [
      'Part précipitamment après signature',
      'Ne rassure pas le client après l’engagement',
    ],
  },
  ...FINAL_SALES_PLAN_PRODUCTS.map((product) => ({
    key: `product_${product.key}`,
    title: `Produit détecté: ${product.title}`,
    weight: 10,
    productKeys: [product.key],
    appliesWhen: { detectedProductsAny: [product.key] },
    phaseRefs: product.phaseRefs,
    expectedSignals: [
      `Le produit ${product.title} est détecté par des éléments explicites du transcript`,
      'Les bénéfices, conditions et action immédiate sont expliqués conformément au plan',
      'La proposition est reliée à la situation du prospect',
    ],
    negativeSignals: [
      `Le produit ${product.title} est mentionné sans bénéfice clair`,
      'Confusion sur les conditions, tarifs, engagement ou mise en service',
    ],
  })),
];
