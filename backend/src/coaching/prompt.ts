import { ParsedSalesPlan } from './sales-plan.types';

/** Liste des slugs de produits détectables (dérivée des étapes productDetected:*). */
export function productKeysFromPlan(plan: ParsedSalesPlan): string[] {
  const keys = new Set<string>();
  for (const step of plan.steps) {
    const match = /^productDetected:(.+)$/.exec(step.appliesWhen);
    if (match) keys.add(match[1]);
  }
  return [...keys];
}

/**
 * Sérialise le barème pour la passe 1. Trois filtres :
 *  - les critères `requiresProductSheet` sont exclus (jugés en passe 2, qui a la fiche) ;
 *  - les étapes produit non retenues par la passe 0 (mapping) sont retirées, au lieu
 *    d'être envoyées avec un « évaluée uniquement si … » que le modèle devait
 *    arbitrer lui-même : prompt plus court, moins de critères à émettre, moins de
 *    risque de sortie tronquée ;
 *  - une étape dont il ne reste aucun critère n'est pas rendue.
 *
 * Les étapes retirées restent émises en `non_applicable` par ScoringService, qui
 * parcourt le plan complet — elles ne disparaissent donc pas de la checklist.
 */
function renderPlanForPrompt(
  plan: ParsedSalesPlan,
  presentedProducts: string[],
): string {
  const lines: string[] = [];
  for (const step of plan.steps) {
    const product = /^productDetected:(.+)$/.exec(step.appliesWhen);
    if (product && !presentedProducts.includes(product[1])) continue;

    const criteria = step.criteria.filter((c) => !c.requiresProductSheet);
    if (criteria.length === 0) continue;
    const applic =
      step.appliesWhen === 'always' || product
        ? ''
        : ` (évaluée uniquement si : ${step.appliesWhen})`;
    lines.push(`### Étape "${step.key}" — ${step.label}${applic}`);
    for (const c of criteria) {
      lines.push(`- critère "${c.key}" : ${c.label}`);
      // Des EXEMPLES, jamais une liste à cocher. Rendus en « signaux positifs »,
      // ils transformaient le jugement en recherche de mots-clés : un commercial
      // qui dit la même chose autrement était noté absent. Les comportements
      // (« questions ouvertes », « monologue ») ont été remontés dans le libellé
      // du critère, là où ils se jugent.
      if (c.expectedSignals?.length) {
        lines.push(
          `    à quoi ça ressemble, ses mots peuvent différer : ${c.expectedSignals.join(' | ')}`,
        );
      }
      if (c.evidenceRequired) {
        lines.push(`    (preuve obligatoire : cite une phrase du transcript)`);
      }
    }
  }
  return lines.join('\n');
}

export function buildSystemPrompt(): string {
  return [
    "Tu es un évaluateur de coaching commercial pour de la prospection porte-à-porte.",
    "On te donne le référentiel d'un plan de vente (étapes + critères) et la transcription d'un échange entre un commercial et un prospect (1 audio = 1 porte).",
    'Ton rôle : juger CHAQUE critère du plan et justifier avec des PREUVES (citations verbatim tirées du transcript).',
    'Règles strictes :',
    "- Ne juge que sur ce qui est réellement dans le transcript. N'invente jamais de preuve.",
    "- Pour chaque critère, status ∈ {atteint, partiel, absent, non_applicable}.",
    "- \"non_applicable\" seulement si le critère ne pouvait pas s'appliquer à cet échange (ex : produit non abordé, contrat non signé).",
    "- Le champ evidence contient des citations courtes exactes du transcript (ou vide si status=absent/non_applicable).",
    '- Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans fence markdown.',
    '- Rédige résumé, forces, axes et recommandations en français, de façon concrète et actionnable.',
  ].join('\n');
}

/**
 * Prompt de la passe 1. `presentedProducts` vient de la passe 0 : ce sont les
 * offres réellement présentées par le commercial, donc les seules étapes produit
 * à faire juger ici.
 */
export function buildUserPrompt(
  plan: ParsedSalesPlan,
  transcript: string,
  presentedProducts: string[] = [],
): string {
  const schema = {
    criteria: [
      {
        stepKey: 'string (clé de l\'étape)',
        criterionKey: 'string (clé du critère)',
        status: 'atteint | partiel | absent | non_applicable',
        evidence: ['citation exacte du transcript'],
        comment: 'courte justification en français',
      },
    ],
    summary: 'résumé de l\'échange en 2-3 phrases',
    strengths: ['point fort 1', 'point fort 2'],
    improvements: ['axe d\'amélioration 1'],
    recommendations: ['action concrète recommandée 1'],
    confidence: 'nombre 0-100 (ta confiance dans cette évaluation)',
    diagnosticScore: 'nombre 0-100 (ton estimation globale, indicative)',
  };

  return [
    `# CONTEXTE\n${plan.context ?? ''}`,
    `# PLAN DE VENTE (${plan.title})\n${renderPlanForPrompt(plan, presentedProducts)}`,
    `# TRANSCRIPTION DE L'ÉCHANGE\n"""\n${transcript}\n"""`,
    `# FORMAT DE SORTIE ATTENDU (JSON strict, mêmes clés)\n${JSON.stringify(
      schema,
      null,
      2,
    )}`,
    'Renvoie un objet JSON avec une entrée dans "criteria" pour CHAQUE critère listé ci-dessus (utilise non_applicable si besoin).',
  ].join('\n\n');
}
