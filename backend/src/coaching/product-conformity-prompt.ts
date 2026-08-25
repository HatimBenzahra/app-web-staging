import { ForbiddenClaim } from './product-sheet.types';

/**
 * Contexte d'un produit réellement abordé dans l'échange : sa fiche, et les
 * critères de conformité à juger. Rien d'autre — la passe 2 évalue ce que le
 * commercial a dit du produit face à ce que la fiche décrit.
 */
export interface ConformityProductContext {
  productKey: string;
  label: string;
  /** Ce que la fiche produit décrit. */
  facts: string[];
  /** Affirmations sensibles à surveiller (aide au jugement, pas déclencheur). */
  forbidden: ForbiddenClaim[];
  /** Les critères `requiresProductSheet` de l'étape produit. */
  criteria: Array<{
    stepKey: string;
    criterionKey: string;
    label: string;
    evidenceRequired?: boolean;
  }>;
}

export function buildConformitySystemPrompt(): string {
  return [
    'Tu es un formateur produit qui évalue un échange de prospection porte-à-porte.',
    "On te donne la fiche du produit réellement abordé, puis la transcription de l'échange.",
    '',
    'Ta question : ce que le commercial a dit de ce produit est-il conforme à la fiche ?',
    '',
    'Règles :',
    "- Juge sur ce qui a été RÉELLEMENT dit. N'invente jamais une citation.",
    '- Une affirmation qui contredit la fiche est un écart. Cite la phrase du commercial et la ligne de la fiche.',
    "- Le SILENCE n'est pas un écart : une information non donnée, un caveat non prononcé, ce n'est pas une contradiction.",
    "- Si le commercial dit juste ailleurs dans l'échange, considère qu'il s'est corrigé : ce n'est pas un écart.",
    "- Ne signale que ce qui compte pour le client : ce qui le trompe sur la nature du produit, sur ce qui est couvert, ou sur ce à quoi il s'engage.",
    '',
    'Deux gravités :',
    '- "grave"  : affirmation juridiquement fausse, ou engagement que le produit ne peut pas tenir',
    "- \"modere\" : erreur de fait ou de périmètre qui trompe le client sans l'engager à tort",
    '',
    'Juge aussi les critères de conformité listés, avec status ∈ {atteint, partiel, absent, non_applicable} et des preuves verbatim.',
    'Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans fence markdown.',
    'Rédige en français. Nomme le produit et son offre — jamais un outil, une base ni une source technique.',
  ].join('\n');
}

function renderProduct(ctx: ConformityProductContext): string {
  const lines: string[] = [];
  lines.push(`## FICHE PRODUIT — ${ctx.label}  (clé : "${ctx.productKey}")`);

  lines.push('', 'Ce que la fiche décrit :');
  for (const f of ctx.facts) lines.push(`- ${f}`);

  if (ctx.forbidden.length) {
    lines.push('', 'Affirmations sensibles à surveiller (gravité indicative) :');
    for (const f of ctx.forbidden) {
      lines.push(`- « ${f.say} » → ${f.severity}`);
    }
  }

  lines.push('', 'Critères à juger pour ce produit :');
  for (const c of ctx.criteria) {
    lines.push(`- critère "${c.criterionKey}" (étape "${c.stepKey}") : ${c.label}`);
    if (c.evidenceRequired) {
      lines.push('    (preuve obligatoire : cite une phrase du transcript)');
    }
  }
  return lines.join('\n');
}

export function buildConformityUserPrompt(
  products: ConformityProductContext[],
  transcript: string,
): string {
  const schema = {
    criteria: [
      {
        stepKey: "string (clé de l'étape)",
        criterionKey: 'string (clé du critère)',
        status: 'atteint | partiel | absent | non_applicable',
        evidence: ['citation exacte du transcript'],
        comment: 'courte justification en français',
      },
    ],
    violations: [
      {
        productSlug: 'string (clé du produit concerné)',
        severity: 'grave | modere',
        quote: 'citation exacte de ce que le commercial a dit',
        sheetSays: 'la ligne de la fiche produit que ça contredit',
        why: 'une phrase, en français : en quoi ça trompe le client',
      },
    ],
  };

  return [
    products.map(renderProduct).join('\n\n---\n\n'),
    `# TRANSCRIPTION DE L'ÉCHANGE\n"""\n${transcript}\n"""`,
    `# FORMAT DE SORTIE ATTENDU (JSON strict, mêmes clés)\n${JSON.stringify(
      schema,
      null,
      2,
    )}`,
    'Renvoie une entrée dans "criteria" pour CHAQUE critère listé. "violations" peut être un tableau vide — c\'est le cas le plus fréquent, et c\'est une bonne nouvelle.',
  ].join('\n\n');
}
