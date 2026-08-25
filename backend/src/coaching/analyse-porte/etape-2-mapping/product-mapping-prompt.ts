/**
 * Passe 0 — mapping des offres.
 *
 * Une seule question posée au LLM : parmi cette liste fermée d'offres, lesquelles
 * apparaissent dans l'échange, et laquelle a été RÉELLEMENT présentée par le
 * commercial ?
 *
 * C'est le correctif de fond de l'instabilité observée : la détection était
 * auparavant une sous-tâche du prompt de jugement (29 critères + rédaction), et
 * renvoyait du texte libre re-normalisé à coups de regex avant comparaison stricte
 * aux clés du plan. Ici le modèle choisit une clé DANS la liste qu'on lui donne, et
 * le backend rejette tout ce qui n'y est pas.
 */

/** Une offre proposable, telle que présentée au modèle. */
export interface MappingProductOption {
  /** La clé du plan (`productDetected:<key>`) — la seule valeur acceptée en retour. */
  key: string;
  label: string;
  /** Ce qui permet de reconnaître l'offre à l'oreille, pas ce qu'elle vaut. */
  identifiers: string[];
}

/** Ce que la passe 0 retient d'une offre. */
export interface MappedProduct {
  key: string;
  /**
   * true = le COMMERCIAL a présenté l'offre. Une offre seulement mentionnée par le
   * prospect (« j'ai déjà une box ») reste à false : elle ne rend pas l'étape
   * applicable, sinon ses critères sortiraient `absent` = 0 et feraient baisser le
   * score à tort.
   */
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
