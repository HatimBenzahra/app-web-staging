import * as fs from 'fs';
import * as path from 'path';
import { parseSalesPlanMarkdown } from './sales-plan.parser';
import { parseProductSheetMarkdown } from './product-sheet.parser';
import { buildSttVocabulary } from './stt-vocabulary';
import { ParsedSalesPlan } from './sales-plan.types';
import { ParsedProductSheet } from './product-sheet.types';

const PLANS_DIR = path.join(__dirname, 'sales-plans');
const SHEETS_DIR = path.join(__dirname, 'product-sheets');

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

/**
 * Le vocabulaire remplace celui codé en dur dans `api_stt.py`, resté à l'ère
 * énergie alors que le plan est passé en Telecom. Construit depuis les
 * référentiels, il ne peut plus diverger.
 */
describe('vocabulaire STT', () => {
  const vocab = () => buildSttVocabulary(readPlan(), readSheets());

  it('porte les noms de marque des fiches actives', () => {
    const v = vocab();
    for (const sheet of readSheets()) {
      expect(v).toContain(sheet.label);
    }
  });

  it('couvre les offres du plan qui n’ont pas de fiche', () => {
    // La Conciergerie est vendue mais n'a aucune fiche : son nom doit quand même
    // être connu de Whisper, sinon le mapping travaille sur un transcript qui l'a
    // perdu.
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

  // Les expectedSignals sont écrits pour le LLM juge : « questions ouvertes »,
  // « laisse parler ». Du français courant, que Whisper transcrit déjà bien — les
  // injecter saturait le plafond et évinçait les vrais noms de marque.
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
