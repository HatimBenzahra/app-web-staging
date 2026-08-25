import * as fs from 'fs';
import * as path from 'path';
import { parseSalesPlanMarkdown } from '../referentiels/sales-plan.parser';
import { parseProductSheetMarkdown } from '../referentiels/product-sheet.parser';
import { buildSttVocabulary } from '../analyse-porte/etape-1-transcription/stt-vocabulary';
import { ParsedSalesPlan } from '../referentiels/sales-plan.types';
import { ParsedProductSheet } from '../referentiels/product-sheet.types';

const PLANS_DIR = path.join(__dirname, '..', 'referentiels', 'sales-plans');
const SHEETS_DIR = path.join(__dirname, '..', 'referentiels', 'product-sheets');

const readPlan = (): ParsedSalesPlan =>
  parseSalesPlanMarkdown(
    fs.readFileSync(path.join(PLANS_DIR, 'finanssor-plan-de-vente.md'), 'utf8'),
  ).plan;

const readSheets = (): ParsedProductSheet[] =>
  fs
    .readdirSync(SHEETS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map(
      (f) =>
        parseProductSheetMarkdown(
          fs.readFileSync(path.join(SHEETS_DIR, f), 'utf8'),
        ).sheet,
    );

/** Construit depuis les référentiels, le vocabulaire ne peut plus diverger du plan. */
describe('vocabulaire STT', () => {
  const vocab = () => buildSttVocabulary(readPlan(), readSheets());

  it('porte les noms de marque des fiches actives', () => {
    const v = vocab();
    for (const sheet of readSheets()) {
      expect(v).toContain(sheet.label);
    }
  });

  it('couvre les offres du plan qui n’ont pas de fiche', () => {
    // Vendue sans fiche : son nom doit quand même être connu de Whisper.
    expect(vocab()).toContain('Conciergerie Action Prévoyance');
  });

  it('retire le préfixe éditorial des étapes produit', () => {
    expect(vocab()).not.toMatch(/Produit\s*:/);
  });

  it('reprend les sigles et chiffres-clés des fiches (3179, RIO…)', () => {
    const v = vocab();
    expect(v).toContain('3179');
    expect(v).toContain('RIO');
    expect(v).toContain('eSIM');
  });

  it('porte les termes transverses du plan (marque ombrelle)', () => {
    expect(vocab()).toContain('Finanssor');
  });

  // Du français courant écrit pour le juge : il saturait le plafond du prompt.
  it('n’injecte pas les signaux du plan destinés au juge', () => {
    const v = vocab().toLowerCase();
    for (const signal of ['questions ouvertes', 'laisse parler', 'par mois']) {
      expect(v).not.toContain(signal);
    }
  });

  it('ne contient plus le vocabulaire énergie codé en dur', () => {
    const v = vocab().toLowerCase();
    for (const dead of ['linky', 'kilowatt', 'plenitude']) {
      expect(v).not.toContain(dead);
    }
  });

  it('écarte les phrases entières (risque d’hallucination)', () => {
    const terms = vocab().split(' : ')[1]?.replace(/\.$/, '').split(', ') ?? [];
    expect(terms.length).toBeGreaterThan(0);
    for (const t of terms) expect(t.length).toBeLessThanOrEqual(40);
  });

  it('reste sous le plafond de longueur', () => {
    expect(vocab().length).toBeLessThan(1000);
  });

  it('ne répète aucun terme, casse et accents ignorés', () => {
    const terms = vocab().split(' : ')[1]?.replace(/\.$/, '').split(', ') ?? [];
    const keys = terms.map((t) =>
      t
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('renvoie une chaîne vide quand les référentiels ne donnent rien', () => {
    const empty: ParsedSalesPlan = {
      slug: 'x',
      title: 'X',
      scoringScale: 100,
      quality: {},
      malus: { grave: 0, modere: 0, maxTotal: 0 },
      steps: [],
    };
    expect(buildSttVocabulary(empty, [])).toBe('');
  });
});
