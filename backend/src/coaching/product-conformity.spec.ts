import * as fs from 'fs';
import * as path from 'path';
import { parseSalesPlanMarkdown } from './sales-plan.parser';
import { parseProductSheetMarkdown } from './product-sheet.parser';
import { ScoringService } from './scoring.service';
import { LlmCoachingOutput, ProductViolation } from './coaching.types';
import { repairConformityOutput } from './json-repair';
import { buildUserPrompt } from './prompt';
import { buildConformityUserPrompt } from './product-conformity-prompt';

const PLANS_DIR = path.join(__dirname, 'sales-plans');
const SHEETS_DIR = path.join(__dirname, 'product-sheets');

const readPlan = () =>
  parseSalesPlanMarkdown(
    fs.readFileSync(path.join(PLANS_DIR, 'finanssor-plan-de-vente.md'), 'utf8'),
  );

describe('plan de vente Telecom', () => {
  it('parse sans erreur', () => {
    expect(() => readPlan()).not.toThrow();
  });

  it('porte un barème de malus', () => {
    const { plan } = readPlan();
    expect(plan.malus.grave).toBeGreaterThan(plan.malus.modere);
    expect(plan.malus.maxTotal).toBeGreaterThanOrEqual(plan.malus.grave);
  });

  it('exclut les critères de conformité du prompt de passe 1', () => {
    const { plan } = readPlan();
    const prompt = buildUserPrompt(plan, 'transcript de test');
    const pass2Keys = plan.steps
      .flatMap((s) => s.criteria)
      .filter((c) => c.requiresProductSheet)
      .map((c) => c.key);
    expect(pass2Keys.length).toBeGreaterThan(0);
    for (const key of pass2Keys) {
      expect(prompt).not.toContain(`critère "${key}"`);
    }
  });

  it('impose l’unicité globale des clés de critères', () => {
    const { plan } = readPlan();
    const keys = plan.steps.flatMap((s) => s.criteria.map((c) => c.key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  // Bug vu en production : `conformite_points_obligatoires` existait dans 4 étapes
  // produit, et le repli d'appariement de ScoringService importait le verdict de
  // france_telephone sur Depanssur, Bleubox et Mondial TV.
  it('refuse une clé de critère réutilisée dans une autre étape', () => {
    const source = [
      '---',
      'slug: test',
      'title: Test',
      'steps:',
      '  - key: etape_a',
      '    label: A',
      '    weight: 10',
      '    criteria:',
      '      - key: partagee',
      '        label: Critère A',
      '  - key: etape_b',
      '    label: B',
      '    weight: 10',
      '    criteria:',
      '      - key: partagee',
      '        label: Critère B',
      '---',
      '',
      '# Corps',
    ].join('\n');
    expect(() => parseSalesPlanMarkdown(source)).toThrow(
      /unique dans tout le plan/,
    );
  });
});

describe('fiches produit', () => {
  const files = fs.readdirSync(SHEETS_DIR).filter((f) => f.endsWith('.md'));
  const readSheet = (file: string) =>
    parseProductSheetMarkdown(
      fs.readFileSync(path.join(SHEETS_DIR, file), 'utf8'),
    ).sheet;

  it('il y a au moins une fiche', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s parse et porte des faits', (file) => {
    const sheet = readSheet(file);
    expect(sheet.facts.length).toBeGreaterThan(0);
    expect(sheet.productKey).not.toContain('productDetected:');
    for (const f of sheet.forbidden) {
      expect(['grave', 'modere']).toContain(f.severity);
    }
  });

  it('chaque fiche cible une étape produit existante du plan', () => {
    const { plan } = readPlan();
    const planProductKeys = plan.steps
      .map((s) => /^productDetected:(.+)$/.exec(s.appliesWhen)?.[1])
      .filter((k): k is string => !!k);

    for (const file of files) {
      expect(planProductKeys).toContain(readSheet(file).productKey);
    }
  });

  // Une fiche décrit un produit, pas une plomberie interne : aucun nom d'outil,
  // de base ni d'API n'a sa place dans un texte que directeurs et managers lisent.
  it.each(files)('%s ne nomme aucun outil interne', (file) => {
    const sheet = readSheet(file);
    const internal = /winlead|\bapi\b|prisma|base de donn/i;
    for (const fact of sheet.facts) expect(fact).not.toMatch(internal);
    for (const f of sheet.forbidden) expect(f.say).not.toMatch(internal);
  });

  it('refuse un appliesTo mal formé', () => {
    const source = [
      '---',
      'slug: x',
      'label: X',
      'appliesTo: depanssur',
      'facts: ["a"]',
      '---',
    ].join('\n');
    expect(() => parseProductSheetMarkdown(source)).toThrow(/productDetected/);
  });

  it('refuse une gravité inconnue', () => {
    const source = [
      '---',
      'slug: x',
      'label: X',
      'appliesTo: productDetected:x',
      'facts: ["a"]',
      'forbidden:',
      '  - { say: "z", severity: catastrophique }',
      '---',
    ].join('\n');
    expect(() => parseProductSheetMarkdown(source)).toThrow(/severity/);
  });
});

describe('prompt de conformité', () => {
  const ctx = {
    productKey: 'depanssur',
    label: 'Pack Depanssur',
    facts: ['une assistance, pas une assurance'],
    prices: [{ label: 'Pack Depanssur', price: 9.9 }],
    forbidden: [
      {
        say: 'présenter Depanssur comme une assurance, ou laisser le client le croire',
        severity: 'grave' as const,
      },
    ],
    criteria: [
      {
        stepKey: 'prod_depanssur',
        criterionKey: 'dep_conformite_points',
        label: 'points obligatoires',
      },
    ],
  };

  // Le prompt porte les DEUX référentiels : sans l'argumentaire du plan, le
  // modèle ne peut pas produire `planSays`, et toute violation est rejetée.
  it('porte la fiche ET l’argumentaire du plan', () => {
    const prompt = buildConformityUserPrompt(
      [{ ...ctx, pitchText: 'Depanssur vous assiste en cas de panne.' }],
      'transcript',
    );
    expect(prompt).toContain('PRODUIT — Pack Depanssur');
    expect(prompt).toContain('une assistance, pas une assurance');
    expect(prompt).toContain('PLAN DE VENTE');
    expect(prompt).toContain('Depanssur vous assiste en cas de panne.');
  });

  // Le plan écrit ses montants en gabarit (« XXXX €/mois »). Sans la grille
  // tarifaire, un prix annoncé est confronté à un texte à trous et tout montant
  // devient un écart — vu en production sur « quatorze euros quatre-vingt-dix »,
  // qui est pourtant le tarif exact du catalogue.
  it('porte la grille tarifaire et interdit d’opposer le gabarit', () => {
    const prompt = buildConformityUserPrompt([ctx], 'transcript');
    expect(prompt).toContain('TARIFS EN VIGUEUR');
    expect(prompt).toContain('9,90 € / mois');
    expect(prompt).toMatch(/gabarit/);
  });

  it('n’affiche pas de bloc tarifaire quand aucun prix n’est résolu', () => {
    const prompt = buildConformityUserPrompt([{ ...ctx, prices: [] }], 'transcript');
    expect(prompt).not.toContain('TARIFS EN VIGUEUR');
  });

  it('exige les trois citations', () => {
    const prompt = buildConformityUserPrompt([ctx], 'transcript');
    expect(prompt).toContain('planSays');
    expect(prompt).toContain('sheetSays');
    expect(prompt).toContain('quote');
  });

  // Une étiquette « → grave » collée à la phrase était recopiée telle quelle, et
  // le modèle appariait par ressemblance de mots. Vu en production : « vous serez
  // chez Orange avec le réseau Orange » sanctionné comme « vous aurez la priorité
  // réseau comme Orange ».
  // Rendues en liste plate avec leur gravité, ces phrases servaient de détecteur
  // de mots-clés : « vous serez chez Orange avec le réseau Orange » sanctionné
  // parce qu'il ressemblait à « vous aurez la priorité réseau comme Orange ».
  // Un commercial ne prononce jamais ces formulations telles quelles.
  it('présente les affirmations interdites comme des EXEMPLES d’idées', () => {
    const prompt = buildConformityUserPrompt([ctx], 'transcript');
    expect(prompt).toContain('présenter Depanssur comme une assurance');
    expect(prompt).toMatch(/IDÉES QUE CE PRODUIT NE PEUT PAS PORTER/);
    expect(prompt).toMatch(/pas des formules à retrouver/);
    // ni gravité accolée, ni injonction à retrouver la formule
    expect(prompt).not.toMatch(/»\s*→\s*(grave|modere)/);
  });

  it('ne nomme aucune source technique', () => {
    const prompt = buildConformityUserPrompt([ctx], 'transcript');
    expect(prompt).not.toMatch(/winlead/i);
  });
});

describe('malus de conformité', () => {
  const scoring = new ScoringService();

  const llm = (): LlmCoachingOutput => ({
    criteria: [],
    summary: '',
    strengths: [],
    improvements: [],
    recommendations: [],
    confidence: null,
    diagnosticScore: null,
  });

  const violation = (over: Partial<ProductViolation> = {}): ProductViolation => ({
    productSlug: 'depanssur',
    severity: 'grave',
    quote: 'vous êtes couvert à 100 %',
    sheetSays: 'une assistance, pas une assurance',
    planSays: 'Depanssur est une assistance en cas de panne du logement',
    ...over,
  });

  const score = (violations?: ProductViolation[]) => {
    const { plan } = readPlan();
    return {
      plan,
      result: scoring.computeScore(plan, llm(), {
        contractSigned: false,
        detectedProducts: ['depanssur'],
        violations,
      }),
    };
  };

  // Le garde-fou décisif : sans citation du plan, l'écart ne coûte rien. Un
  // commercial qui récite son argumentaire est insanctionnable par construction.
  it('ignore une violation sans citation du plan de vente', () => {
    const { result } = score([violation({ planSays: '' })]);
    expect(result.malus).toBe(0);
    expect(result.violations).toHaveLength(0);
    expect(result.score).toBe(result.scoreBeforeMalus);
  });

  it.each(['n/a', 'aucune', '—'])(
    'ignore un planSays marqueur d’absence (%s)',
    (marker) => {
      const { result } = score([violation({ planSays: marker })]);
      expect(result.malus).toBe(0);
    },
  );

  // Une ligne de plan à trous ne contredit aucun chiffre : elle n'en porte aucun.
  it('ignore une violation dont le plan cité est un gabarit', () => {
    const { result } = score([
      violation({ planSays: 'Désormais, vous passerez à XXXX €/mois' }),
    ]);
    expect(result.malus).toBe(0);
    expect(result.violations).toHaveLength(0);
  });

  it('ne retire rien sans violation', () => {
    const { result } = score();
    expect(result.malus).toBe(0);
    expect(result.score).toBe(result.scoreBeforeMalus);
  });

  it('retire le barème "grave" pour un écart grave', () => {
    const { plan, result } = score([violation()]);
    expect(result.malus).toBe(plan.malus.grave);
    expect(result.violations).toHaveLength(1);
  });

  it('retire le barème "modere" pour un écart modéré', () => {
    const { plan, result } = score([violation({ severity: 'modere' })]);
    expect(result.malus).toBe(plan.malus.modere);
  });

  it('rejette un écart sans citation du commercial', () => {
    expect(score([violation({ quote: '   ' })]).result.malus).toBe(0);
  });

  it('rejette un écart qui ne cite pas la fiche', () => {
    expect(score([violation({ sheetSays: '' })]).result.malus).toBe(0);
  });

  // Le modèle remplit parfois un champ de citation avec un marqueur d'absence
  // plutôt que de ne pas émettre l'écart : ça doit compter comme une citation
  // manquante, pas comme une citation.
  it.each(['n/a', 'N/A', 'aucun', 'Non applicable', '-', '  néant  ', '?', 'NC'])(
    'rejette un écart dont la citation de la fiche vaut %p',
    (sheetSays) => {
      const { result } = score([violation({ sheetSays })]);
      expect(result.malus).toBe(0);
      expect(result.violations).toHaveLength(0);
    },
  );

  it('plafonne le malus cumulé', () => {
    const { plan, result } = score(Array.from({ length: 10 }, () => violation()));
    expect(result.malus).toBe(plan.malus.maxTotal);
  });

  it('ne descend jamais sous zéro', () => {
    const { result } = score(Array.from({ length: 10 }, () => violation()));
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

describe('repairConformityOutput', () => {
  it('accepte une fence markdown et des clés alias', () => {
    const raw = [
      '```json',
      JSON.stringify({
        criteria: [
          { step: 'prod_depanssur', key: 'c1', status: 'ok', evidence: ['x'] },
        ],
        violations: [
          {
            produit: 'Depanssur',
            gravite: 'critique',
            citation: 'tout est remboursé',
            fiche: 'pas de remboursement automatique',
          },
        ],
      }),
      '```',
    ].join('\n');

    const out = repairConformityOutput(raw);
    expect(out.criteria[0].status).toBe('atteint');
    expect(out.violations[0].productSlug).toBe('depanssur');
    expect(out.violations[0].severity).toBe('grave');
    expect(out.violations[0].sheetSays).toBe('pas de remboursement automatique');
  });

  it('retombe sur "modere" pour une gravité inconnue', () => {
    const out = repairConformityOutput(
      JSON.stringify({
        violations: [{ productSlug: 'x', severity: 'apocalyptique' }],
      }),
    );
    expect(out.violations[0].severity).toBe('modere');
  });

  it('tolère un tableau de violations absent', () => {
    const out = repairConformityOutput(JSON.stringify({ criteria: [] }));
    expect(out.violations).toEqual([]);
  });
});
