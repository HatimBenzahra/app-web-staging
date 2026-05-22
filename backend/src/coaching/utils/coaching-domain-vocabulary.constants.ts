export type DomainCorrectionExample = {
  raw: string;
  normalized: string;
  reason: string;
};

export const COACHING_CANONICAL_TERMS = [
  'Finanssor',
  'Pro-Win',
  'Plénitude',
  'ENI',
  'OHM Énergie',
  'EDF',
  'GDF',
  'TotalEnergies',
  'Enedis',
  'GRDF',
  'Depan’ssur',
  'Action Prévoyance',
  'Néoliane',
  'ECA',
  'Bleutel',
  'Bleubox',
  'Mondial TV',
  'Orange',
  'Bouygues',
  'SFR',
  'gaz',
  'électricité',
  'facture',
  'tarification',
  'fournisseur',
  'contrat',
  'simulation',
  'économie',
  'compteur Linky',
  'kilowatt-heure',
  'kWh',
  'PDL',
  'PCE',
  'RIB',
  'IBAN',
  'mandat SEPA',
];

export const COACHING_COMMON_MISHEARINGS: DomainCorrectionExample[] = [
  {
    raw: 'groupe financier',
    normalized: 'groupe Finanssor',
    reason:
      'Dans une ouverture commerciale énergie Finanssor, cette forme est un nom de marque mal transcrit.',
  },
  {
    raw: 'gros financeur',
    normalized: 'groupe Finanssor',
    reason:
      'Confusion phonétique fréquente sur le nom Finanssor dans les audios terrain.',
  },
  {
    raw: 'finansseur',
    normalized: 'Finanssor',
    reason: 'Orthographe canonique de la marque.',
  },
  {
    raw: 'gaz et hélicoptère',
    normalized: 'gaz et électricité',
    reason:
      'Correction métier autorisée seulement si le contexte parle de facture, énergie ou tarification.',
  },
  {
    raw: 'gas et les hélicoptères',
    normalized: 'gaz et électricité',
    reason:
      'Correction métier autorisée seulement si le contexte parle de facture, énergie ou tarification.',
  },
  {
    raw: 'fonds d’avancement',
    normalized: 'fournisseur',
    reason:
      'Correction phonétique métier possible dans une question de contrat/facture.',
  },
];

export const COACHING_CONTEXTUAL_CORRECTIONS: DomainCorrectionExample[] = [
  {
    raw: "Il n'y a pas tout ici, au revoir.",
    normalized: "Il n'y a personne ici, au revoir.",
    reason:
      'Correction phonétique prudente possible dans un contexte porte-à-porte/absence.',
  },
  {
    raw: 'Deux petites minutes.',
    normalized: "J'en ai pour deux petites minutes.",
    reason:
      'Correction seulement si la phrase complète est déjà suggérée par le contexte immédiat.',
  },
];

export const COACHING_FORBIDDEN_REWRITES: DomainCorrectionExample[] = [
  {
    raw: "Il n'y a pas tout ici.",
    normalized: "Je ne suis pas intéressé par votre offre.",
    reason: 'Ajoute une intention commerciale non prononcée.',
  },
  {
    raw: 'Bonjour... électricité... deux minutes.',
    normalized:
      "Bonjour, je suis de Finanssor, avez-vous deux minutes pour parler de vos factures d'électricité ?",
    reason:
      'Transforme des fragments en phrase commerciale complète absente du transcript.',
  },
  {
    raw: 'Je ne sais pas.',
    normalized: "Je suis déjà chez un autre fournisseur et je refuse l'offre.",
    reason: 'Ajoute fournisseur, refus et justification non observés.',
  },
];

export function buildDomainVocabularyPrompt(): string {
  const lines = [
    'VOCABULAIRE MÉTIER CONTRÔLÉ',
    'Ces termes doivent être orthographiés correctement si le contexte les rend clairement présents:',
    COACHING_CANONICAL_TERMS.join(', '),
    '',
    'NORMALISATIONS MÉTIER AUTORISÉES (DOMAIN_VOCABULARY)',
    ...COACHING_COMMON_MISHEARINGS.map(
      (entry) => `- "${entry.raw}" -> "${entry.normalized}" (${entry.reason})`,
    ),
    '',
    'CORRECTIONS PHONÉTIQUES PRUDENTES (PHONETIC_CONTEXTUAL)',
    ...COACHING_CONTEXTUAL_CORRECTIONS.map(
      (entry) => `- "${entry.raw}" -> "${entry.normalized}" (${entry.reason})`,
    ),
    '',
    'REFORMULATIONS INTERDITES',
    ...COACHING_FORBIDDEN_REWRITES.map(
      (entry) => `- "${entry.raw}" X "${entry.normalized}" (${entry.reason})`,
    ),
  ];

  return lines.join('\n');
}
