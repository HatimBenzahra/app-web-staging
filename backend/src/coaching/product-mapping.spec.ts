import * as fs from 'fs';
import * as path from 'path';
import { parseSalesPlanMarkdown } from './sales-plan.parser';
import { parseProductSheetMarkdown } from './product-sheet.parser';
import { repairMappingOutput } from './json-repair';
import { buildMappingUserPrompt } from './product-mapping-prompt';
import { buildUserPrompt, productKeysFromPlan } from './prompt';

const PLANS_DIR = path.join(__dirname, 'sales-plans');
const SHEETS_DIR = path.join(__dirname, 'product-sheets');

const readPlan = () =>
  parseSalesPlanMarkdown(
    fs.readFileSync(path.join(PLANS_DIR, 'finanssor-plan-de-vente.md'), 'utf8'),
  ).plan;

const KEYS = ['depanssur', 'france_telephone', 'bleubox', 'mondial_tv'];

const json = (products: unknown[]) => JSON.stringify({ products });

/**
 * La passe 0 remplace une détection en texte libre, re-normalisée à coups de regex
 * puis comparée en égalité stricte aux clés du plan. C'était la cause de
 * l'instabilité : « Pack Depanssur » ou « france-telephone » ne retombaient pas sur
 * la clé attendue, la passe 2 ne partait pas, et l'étape produit sortait du
 * dénominateur — le tout en silence.
 */
describe('mapping des offres (passe 0)', () => {
  it('retient une clé de la liste fermée', () => {
    const { products, rejected } = repairMappingOutput(
      json([
        {
          key: 'depanssur',
          presentedByCommercial: true,
          evidence: 'je vous propose une assistance dépannage',
        },
      ]),
      KEYS,
    );
    expect(rejected).toEqual([]);
    expect(products).toEqual([
      {
        key: 'depanssur',
        presentedByCommercial: true,
        evidence: 'je vous propose une assistance dépannage',
      },
    ]);
  });

  it('rejette une clé hors liste au lieu de l’approximer', () => {
    const { products, rejected } = repairMappingOutput(
      json([
        { key: 'Pack Depanssur bis', presentedByCommercial: true, evidence: 'x' },
      ]),
      KEYS,
    );
    expect(products).toEqual([]);
    expect(rejected).toEqual(['Pack Depanssur bis']);
  });

  it('rattrape les seules variantes de séparateur et d’accent', () => {
    const { products } = repairMappingOutput(
      json([
        { key: 'france-telephone', presentedByCommercial: true, evidence: 'a' },
        { key: 'Mondial TV', presentedByCommercial: true, evidence: 'b' },
      ]),
      KEYS,
    );
    expect(products.map((p) => p.key)).toEqual([
      'france_telephone',
      'mondial_tv',
    ]);
  });

  // Le faux positif coûte des points : une offre évoquée par le prospect rendrait
  // l'étape applicable, ses critères sortiraient `absent` = 0.
  it('distingue l’offre présentée de l’offre seulement évoquée', () => {
    const { products } = repairMappingOutput(
      json([
        { key: 'bleubox', presentedByCommercial: false, evidence: "j'ai déjà une box" },
      ]),
      KEYS,
    );
    expect(products[0].presentedByCommercial).toBe(false);
  });

  it.each([
    ['true', true],
    ['oui', true],
    ['false', false],
    ['peut-être', false],
    [1, true],
  ])('normalise presentedByCommercial=%p', (raw, expected) => {
    const { products } = repairMappingOutput(
      json([{ key: 'bleubox', presentedByCommercial: raw, evidence: 'a' }]),
      KEYS,
    );
    expect(products[0].presentedByCommercial).toBe(expected);
  });

  it('dédoublonne une offre renvoyée deux fois', () => {
    const { products } = repairMappingOutput(
      json([
        { key: 'bleubox', presentedByCommercial: true, evidence: 'a' },
        { key: 'bleubox', presentedByCommercial: false, evidence: 'b' },
      ]),
      KEYS,
    );
    expect(products).toHaveLength(1);
  });

  it('accepte une réponse vide — le cas le plus fréquent', () => {
    expect(repairMappingOutput(json([]), KEYS).products).toEqual([]);
  });

  it('accepte une fence markdown autour du JSON', () => {
    const { products } = repairMappingOutput(
      '```json\n' + json([{ key: 'depanssur', presentedByCommercial: true, evidence: 'a' }]) + '\n```',
      KEYS,
    );
    expect(products).toHaveLength(1);
  });
});

describe('prompt de mapping', () => {
  const options = [
    { key: 'depanssur', label: 'Pack Depanssur', identifiers: ['assistance dépannage'] },
    { key: 'bleubox', label: 'Bleubox', identifiers: ['box par le réseau mobile'] },
  ];

  it('énumère la liste fermée des clés attendues', () => {
    const prompt = buildMappingUserPrompt(options, 'transcript');
    expect(prompt).toContain('clé "depanssur"');
    expect(prompt).toContain('depanssur | bleubox');
  });

  it('ne fournit ni barème ni critère à juger', () => {
    const prompt = buildMappingUserPrompt(options, 'transcript');
    expect(prompt).not.toMatch(/critère/i);
    expect(prompt).not.toMatch(/atteint|partiel/i);
  });
});

describe('fiches produit — signaux de reconnaissance', () => {
  const files = fs.readdirSync(SHEETS_DIR).filter((f) => f.endsWith('.md'));
  const readSheet = (file: string) =>
    parseProductSheetMarkdown(
      fs.readFileSync(path.join(SHEETS_DIR, file), 'utf8'),
    ).sheet;

  it.each(files)('%s porte des identifiers', (file) => {
    expect(readSheet(file).identifiers.length).toBeGreaterThan(0);
  });

  it('identifiers est optionnel (repli sur facts côté runner)', () => {
    const source = [
      '---',
      'slug: x',
      'label: X',
      'appliesTo: productDetected:x',
      'facts: ["un fait"]',
      '---',
    ].join('\n');
    expect(parseProductSheetMarkdown(source).sheet.identifiers).toEqual([]);
  });
});

describe('passe 1 après mapping', () => {
  it('ne rend que les étapes des offres présentées', () => {
    const plan = readPlan();
    const prompt = buildUserPrompt(plan, 'transcript', ['depanssur']);

    expect(prompt).toContain('Étape "prod_depanssur"');
    for (const key of productKeysFromPlan(plan).filter(
      (k) => k !== 'depanssur',
    )) {
      const step = plan.steps.find(
        (s) => s.appliesWhen === `productDetected:${key}`,
      )!;
      expect(prompt).not.toContain(`Étape "${step.key}"`);
    }
  });

  it('ne demande plus la détection des produits', () => {
    const prompt = buildUserPrompt(readPlan(), 'transcript', []);
    expect(prompt).not.toContain('detectedProducts');
    expect(prompt).not.toContain('PRODUITS DÉTECTABLES');
  });

  it('garde les étapes "always" quand aucune offre n’est présentée', () => {
    const prompt = buildUserPrompt(readPlan(), 'transcript', []);
    expect(prompt).toContain('Étape "accroche"');
  });
});
