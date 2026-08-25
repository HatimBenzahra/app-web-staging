/**
 * Passe 0 : une seule question, et une clé choisie dans une liste FERMÉE que le
 * backend valide — c'est ce qui rend la détection des offres reproductible.
 */

/** Une offre proposable, telle que présentée au modèle. */
export interface MappingProductOption {
  /** Clé du plan, seule valeur acceptée en retour. */
  key: string;
  label: string;
  /** Ce qui permet de reconnaître l'offre à l'oreille, pas ce qu'elle vaut. */
  identifiers: string[];
}

/** Ce que la passe 0 retient d'une offre. */
export interface MappedProduct {
  key: string;
  /** Une offre évoquée par le prospect reste à false : elle ne rend pas l'étape applicable. */
  presentedByCommercial: boolean;
  /** Citation verbatim qui justifie la détection. */
  evidence: string;
}

export function buildMappingSystemPrompt(): string {
  return [
    "Tu identifies les offres commerciales abordées dans un échange de prospection porte-à-porte.",
    '',
    "On te donne la liste FERMÉE des offres possibles, puis la transcription de l'échange.",
    '',
    'Règles :',
    "- Ne renvoie QUE des clés de la liste. Jamais un nom commercial, jamais une clé inventée.",
    "- Une offre absente de l'échange ne doit pas figurer dans ta réponse.",
    "- \"presentedByCommercial\": true seulement si le COMMERCIAL a présenté ou proposé l'offre.",
    "  Si c'est le prospect qui évoque son équipement actuel (« j'ai déjà une box », « je suis chez tel opérateur »), c'est false.",
    "- \"evidence\" est une citation exacte du transcript. Sans citation, ne renvoie pas l'offre.",
    "- La transcription est automatique : les noms de marque sont souvent déformés. Fie-toi à ce qui est décrit (le service, l'équipement, le geste commercial), pas à l'orthographe du nom.",
    "- Plusieurs offres peuvent être présentées dans le même échange. Aucune, aussi — c'est fréquent et normal.",
    '',
    'Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans fence markdown.',
  ].join('\n');
}

function renderOption(option: MappingProductOption): string {
  const lines = [`- clé "${option.key}" — ${option.label}`];
  for (const id of option.identifiers) lines.push(`    reconnaissable à : ${id}`);
  return lines.join('\n');
}

export function buildMappingUserPrompt(
  options: MappingProductOption[],
  transcript: string,
): string {
  const schema = {
    products: [
      {
        key: `une clé parmi : ${options.map((o) => o.key).join(' | ')}`,
        presentedByCommercial: 'true | false',
        evidence: 'citation exacte du transcript',
      },
    ],
  };

  return [
    `# OFFRES POSSIBLES (liste fermée)\n${options.map(renderOption).join('\n')}`,
    `# TRANSCRIPTION DE L'ÉCHANGE\n"""\n${transcript}\n"""`,
    `# FORMAT DE SORTIE ATTENDU (JSON strict, mêmes clés)\n${JSON.stringify(
      schema,
      null,
      2,
    )}`,
    'Si aucune offre n\'est abordée, renvoie {"products": []}.',
  ].join('\n\n');
}
