import * as crypto from 'crypto';
import matter from 'gray-matter';
import {
  ForbiddenClaim,
  ParsedProductSheet,
  ParsedProductSheetFile,
  ViolationSeverity,
  WinLeadPlusBinding,
} from './product-sheet.types';
import { StepApplicability } from './sales-plan.types';

export class ProductSheetParseError extends Error {}

const SEVERITIES: ViolationSeverity[] = ['grave', 'modere'];

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ProductSheetParseError(`Champ "${field}" manquant ou invalide`);
  }
  return value.trim();
}

function parseAppliesTo(raw: unknown, slug: string): StepApplicability {
  const value = asString(raw, `fiche ${slug}.appliesTo`);
  if (!value.startsWith('productDetected:')) {
    throw new ProductSheetParseError(
      `Fiche ${slug} : appliesTo doit être de la forme "productDetected:<slug>"`,
    );
  }
  if (value.slice('productDetected:'.length).trim().length === 0) {
    throw new ProductSheetParseError(
      `Fiche ${slug} : appliesTo ne porte aucun slug produit`,
    );
  }
  return value as StepApplicability;
}

function parseFacts(raw: unknown, slug: string): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ProductSheetParseError(
      `Fiche ${slug} : au moins un fait (facts) est requis`,
    );
  }
  const facts = raw
    .map((f) => (typeof f === 'string' ? f.trim() : ''))
    .filter((f) => f.length > 0);
  if (facts.length === 0) {
    throw new ProductSheetParseError(`Fiche ${slug} : facts ne contient aucun texte`);
  }
  return facts;
}

/**
 * Signaux de reconnaissance de l'offre (passe 0). Optionnel : sans eux, la passe 0
 * retombe sur les premiers `facts`, ce qui marche mais discrimine moins bien.
 */
function parseIdentifiers(raw: unknown, slug: string): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new ProductSheetParseError(
      `Fiche ${slug} : identifiers doit être une liste`,
    );
  }
  return raw
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v.length > 0);
}

function parseForbidden(raw: unknown, slug: string): ForbiddenClaim[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new ProductSheetParseError(`Fiche ${slug} : forbidden doit être une liste`);
  }
  return raw.map((entry: any, i) => {
    const say = asString(entry?.say, `fiche ${slug}.forbidden[${i}].say`);
    const severity = entry?.severity;
    if (!SEVERITIES.includes(severity)) {
      throw new ProductSheetParseError(
        `Fiche ${slug} : forbidden[${i}].severity doit valoir ${SEVERITIES.join(' ou ')}`,
      );
    }
    return { say, severity: severity as ViolationSeverity };
  });
}

function parseWinLeadPlus(
  raw: any,
  slug: string,
): WinLeadPlusBinding | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const externalIds = Array.isArray(raw.externalIds)
    ? raw.externalIds.filter(
        (id: unknown): id is number =>
          typeof id === 'number' && Number.isFinite(id),
      )
    : undefined;

  const fournisseur =
    typeof raw?.match?.fournisseur === 'string' &&
    raw.match.fournisseur.trim().length > 0
      ? raw.match.fournisseur.trim()
      : undefined;

  if (!externalIds?.length && !fournisseur) {
    throw new ProductSheetParseError(
      `Fiche ${slug} : winleadplus doit porter externalIds ou match.fournisseur`,
    );
  }

  return {
    externalIds: externalIds?.length ? externalIds : undefined,
    match: fournisseur ? { fournisseur } : undefined,
  };
}

/**
 * Parse une fiche produit : frontmatter YAML (vérité machine) + corps (fiche
 * lisible pour l'onglet Produits, non injectée au LLM).
 */
export function parseProductSheetMarkdown(
  source: string,
): ParsedProductSheetFile {
  const parsed = matter(source);
  const data = parsed.data ?? {};

  const slug = asString(data.slug, 'slug');
  const label = asString(data.label, `fiche ${slug}.label`);
  const appliesTo = parseAppliesTo(data.appliesTo, slug);

  const sheet: ParsedProductSheet = {
    slug,
    label,
    appliesTo,
    productKey: appliesTo.slice('productDetected:'.length),
    facts: parseFacts(data.facts, slug),
    identifiers: parseIdentifiers(data.identifiers, slug),
    forbidden: parseForbidden(data.forbidden, slug),
    winleadplus: parseWinLeadPlus(data.winleadplus, slug),
  };

  const contentHash = crypto
    .createHash('sha256')
    .update(source, 'utf8')
    .digest('hex');

  return { sheet, rawMarkdown: source, contentHash };
}
