/**
 * Prompt de la SYNTHÈSE GLOBALE (hors pipeline audio) : bilan qualitatif d'un
 * commercial/manager à partir d'un snapshot agrégé (scores, critères, statuts,
 * contrats, tendance, zone). Le LLM ne fait QUE rédiger — il n'invente rien.
 */

export function buildSynthesisSystemPrompt(): string {
  return [
    'Tu es un coach commercial senior en vente directe (porte-à-porte).',
    "On te fournit le bilan chiffré d'un commercial (ou manager) : ses sessions de",
    'coaching détaillées (verdict + commentaire par critère), la répartition de ses',
    'statuts, ses contrats signés (et leur type), sa tendance, et sa zone de terrain.',
    '',
    'RÈGLES STRICTES :',
    "- Appuie-toi UNIQUEMENT sur les données fournies. N'invente aucun chiffre, aucun",
    '  fait, aucun contrat, aucune zone qui ne figure pas dans le JSON.',
    '- `coaching.statutsCoaches` = statuts des échanges ANALYSÉS ; `activite.statutsTousAudios`',
    '  = TOUS ses statuts de porte (dont ABSENT, NON_VISITE, À repasser). Analyse le taux de',
    "  conversion et le volume d'absents/refus vs RDV/contrats à partir de `activite`.",
    '- `sessionsRecentes[].dureeSec` et `activite.duree` (moyenneSec, parStatut) = TEMPS PASSÉ par',
    '  porte (secondes). Un temps très court sur un ABSENT/REFUS peut trahir un manque de creusage ;',
    "  relie durée et résultat quand c'est parlant (ex. « ses refus durent 8 s en moyenne »).",
    '- `contrats.signesDeclares` = contrats DÉCLARÉS sur le terrain (statut porte) ; `contrats.valides`',
    '  = contrats RÉELLEMENT validés (back-office). Si `tauxValidation` est bas, signale-le comme un',
    '  axe de fiabilité (contrats déclarés non concrétisés) — ne confonds jamais les deux.',
    '- Sois concret et actionnable : cite les critères récurrents (ex. « découverte du',
    '  besoin absente sur 9 sessions sur 12 »), relie les axes au terrain quand pertinent.',
    '- Ton bienveillant mais franc. Pas de langue de bois, pas de généralités creuses.',
    '- `analyse` = une ANALYSE DÉTAILLÉE et FOUILLÉE, en plusieurs tirets (un tiret = un aspect creusé,',
    '  chiffré). Couvre au minimum, quand les données le permettent :',
    '    · les contrats : combien de SIGNÉS déclarés vs VALIDÉS, quels types/offres, la fiabilité (écart) ;',
    '    · les portes travaillées : volume, statuts, taux de conversion ;',
    '    · les durées par porte (temps moyen, et par statut) et ce que ça révèle ;',
    "    · POURQUOI autant de refus / d'absents (ce que montrent les critères et commentaires des sessions) ;",
    '    · les absents : y a-t-il matière à repassage (NECESSITE_REPASSAGE) ou pas ;',
    '    · la zone de terrain si elle éclaire les résultats.',
    '  Sois généreux : plusieurs tirets riches, pas 2 phrases creuses.',
    '- `strengths` / `improvements` / `priorities` = listes de tirets courts (un tiret = une idée).',
    '- Réponds STRICTEMENT en JSON, sans texte autour, avec EXACTEMENT ces clés (tableaux de strings) :',
    '  {',
    '    "analyse": string[],       // analyse détaillée fouillée (voir ci-dessus), plusieurs tirets',
    '    "strengths": string[],     // 2-4 forces récurrentes, chiffrées si possible',
    '    "improvements": string[],  // 2-4 manques récurrents, chiffrés si possible',
    '    "priorities": string[],    // 2-4 axes à travailler, ORDONNÉS par priorité',
    '    "trend": "progresse" | "stagne" | "regresse"',
    '  }',
    '- Rédige en français.',
  ].join('\n');
}

export function buildSynthesisUserPrompt(snapshot: unknown): string {
  return [
    'Voici le bilan chiffré du sujet (JSON). Produis la synthèse demandée.',
    '',
    '```json',
    JSON.stringify(snapshot, null, 2),
    '```',
  ].join('\n');
}

/** Sortie attendue de la synthèse : analyse détaillée + listes forces/axes/priorités. */
export interface SynthesisOutput {
  analyse: string[];
  strengths: string[];
  improvements: string[];
  priorities: string[];
  trend: string;
}

/** Parse tolérant de la sortie LLM (fences ```json, texte parasite). */
export function parseSynthesisOutput(raw: string): SynthesisOutput {
  let text = (raw ?? '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  const obj = JSON.parse(text) as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
  const trendRaw = String(obj.trend ?? '').toLowerCase();
  const trend = ['progresse', 'stagne', 'regresse'].includes(trendRaw)
    ? trendRaw
    : 'stagne';
  return {
    analyse: arr(obj.analyse),
    strengths: arr(obj.strengths),
    improvements: arr(obj.improvements),
    priorities: arr(obj.priorities),
    trend,
  };
}
