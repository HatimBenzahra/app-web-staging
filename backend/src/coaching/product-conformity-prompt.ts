import { ForbiddenClaim } from './product-sheet.types';
import { ProductPrice } from './product-price.service';

/**
 * Contexte d'un produit réellement présenté : ses DEUX référentiels, et les
 * critères de conformité à juger.
 *
 * La règle du module : une affirmation n'est un écart que si elle contredit la
 * fiche produit **et** l'argumentaire du plan de vente. Un commercial qui récite
 * son plan n'est jamais sanctionné — si le plan s'écarte de la fiche, ça se règle
 * entre référentiels, pas sur son dos.
 */
export interface ConformityProductContext {
  productKey: string;
  label: string;
  /** Ce que la fiche produit décrit. */
  facts: string[];
  /** Affirmations connues pour être fausses. Aide au jugement, pas déclencheur. */
  forbidden: ForbiddenClaim[];
  /** Ce que le plan de vente autorise à dire (second référentiel). */
  pitchText?: string;
  /**
   * Tarifs en vigueur, résolus depuis WinLead+. Le plan écrit ses montants en
   * gabarit (« XXXX €/mois ») : sans cette grille, un prix annoncé est confronté
   * à un texte à trous, et tout montant devient un écart.
   */
  prices: ProductPrice[];
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
    "On te donne, pour le produit abordé, ce que la FICHE décrit et ce que le PLAN DE VENTE autorise à dire, puis la transcription de l'échange.",
    '',
    "Ta question : le commercial a-t-il affirmé quelque chose de FAUX sur ce produit ?",
    '',
    "Pas « est-ce imprécis », pas « est-ce incomplet » : est-ce FAUX. La charge de la preuve est sur l'accusation.",
    '',
    "N'est PAS un écart :",
    "- une approximation ou un raccourci commercial dont le fond reste vrai,",
    "- une information non donnée, un caveat non prononcé — le silence n'est jamais un écart,",
    '- une formulation vague que le client ne peut pas interpréter à son détriment,',
    "- une affirmation que le PLAN DE VENTE autorise : si le commercial récite son plan, il n'y a pas d'écart, même si le plan dit les choses autrement que la fiche,",
    "- une affirmation corrigée ailleurs dans l'échange,",
    "- nommer l'opérateur ou le réseau utilisé (« vous serez chez X », « vous passez sur le réseau de X ») quand c'est bien ce réseau qui est utilisé : c'est un raccourci de langage courant, le client n'y perd rien,",
    "- décrire un partenaire, une marque ou un réseau par son nom usuel plutôt que par sa forme juridique exacte.",
    '',
    "EST un écart : une affirmation que le client croira, qui est fausse, et qui le trompe sur la nature du produit, sur ce qui est couvert, ou sur ce à quoi il s'engage.",
    '',
    'Pour chaque écart, TROIS citations sont obligatoires :',
    '- "quote"     : la phrase exacte du commercial,',
    '- "sheetSays" : la ligne de la fiche que ça contredit,',
    '- "planSays"  : la ligne du plan de vente que ça contredit AUSSI.',
    "Si tu ne peux pas produire les trois, alors ce n'est pas un écart : ne le signale pas.",
    '',
    'Deux gravités, que tu détermines toi-même. En cas de doute, prends la plus faible :',
    "- \"grave\"  : le client s'engage sur la foi d'une affirmation juridiquement fausse, ou d'une promesse que le produit ne peut pas tenir (une couverture qui n'existe pas, un remboursement inventé, une absence de frais fausse). C'est rare.",
    "- \"modere\" : une erreur de fait ou de périmètre. Un chiffre inexact, un nom mal employé, une caractéristique mal décrite. C'est le cas le plus courant quand il y a un écart.",
    "Une imprécision de vocabulaire ou de dénomination n'est JAMAIS \"grave\".",
    '',
    'Juge aussi les critères de conformité listés, avec status ∈ {atteint, partiel, absent, non_applicable} et des preuves verbatim.',
    'Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans fence markdown.',
    'Rédige en français. Nomme le produit et son offre — jamais un outil, une base ni une source technique.',
  ].join('\n');
}

function renderProduct(ctx: ConformityProductContext): string {
  const lines: string[] = [];
  lines.push(`## PRODUIT — ${ctx.label}  (clé : "${ctx.productKey}")`);

  lines.push('', 'Ce que la FICHE décrit :');
  for (const f of ctx.facts) lines.push(`- ${f}`);

  if (ctx.pitchText) {
    lines.push(
      '',
      "Ce que le PLAN DE VENTE autorise à dire (second référentiel — tout ce qui figure ici est permis) :",
      '"""',
      ctx.pitchText,
      '"""',
    );
  }

  if (ctx.prices.length) {
    lines.push('', 'TARIFS EN VIGUEUR (source unique de vérité sur les prix) :');
    for (const p of ctx.prices) {
      lines.push(`- ${p.label} : ${p.price.toFixed(2).replace('.', ',')} € / mois`);
    }
    lines.push(
      "Un montant annoncé qui correspond à cette grille n'est JAMAIS un écart.",
      "Le plan de vente écrit ses montants « XXXX € » : c'est un gabarit, jamais un tarif. Ne t'en sers jamais pour contredire un prix.",
    );
  }

  if (ctx.forbidden.length) {
    // Présentées comme des EXEMPLES d'idées interdites, jamais comme des phrases à
    // retrouver. Rendues en liste plate avec leur gravité, le modèle appariait mot
    // à mot : « vous serez chez Orange avec le réseau Orange » sanctionné parce
    // qu'il ressemblait à « vous aurez la priorité réseau comme Orange ». Un
    // commercial ne prononce jamais ces formulations telles quelles — ce qui
    // compte, c'est l'idée qu'il fait passer.
    lines.push(
      '',
      'IDÉES QUE CE PRODUIT NE PEUT PAS PORTER :',
    );
    for (const f of ctx.forbidden) lines.push(`- ${f.say}`);
    lines.push(
      "Ce sont des idées, pas des formules à retrouver. Le commercial les fera passer avec SES mots — demande-toi ce que le client a compris, pas quels mots ont été employés.",
      "À l'inverse, une phrase dont la forme évoque une de ces idées sans la porter n'est pas un écart.",
    );
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
        planSays: 'la ligne du plan de vente que ça contredit aussi',
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
