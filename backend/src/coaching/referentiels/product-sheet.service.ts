import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma.service';
import { parseProductSheetMarkdown } from './product-sheet.parser';
import {
  ForbiddenClaim,
  ParsedProductSheet,
  ParsedProductSheetFile,
  WinLeadPlusBinding,
} from './product-sheet.types';
import { StepApplicability } from './sales-plan.types';

type ProductSheetVersionRow = {
  id: number;
  slug: string;
  label: string;
  productKey: string;
  facts: unknown;
  identifiers: unknown;
  sttTerms: unknown;
  forbidden: unknown;
  winleadplus: unknown;
};

/** Fiche active + l'id de version utilisé, pour la traçabilité de l'analyse. */
export interface ActiveProductSheet {
  versionId: number;
  sheet: ParsedProductSheet;
}

/**
 * De quoi nommer et reconnaître une offre, jamais de quoi la juger : c'est la
 * seule chose qu'on charge pour TOUTES les offres, avant de savoir ce qui a été abordé.
 */
export interface ProductSheetDescriptor {
  productKey: string;
  label: string;
  identifiers: string[];
  sttTerms: string[];
}

/** Charge les fiches au boot et les versionne par sha256, comme SalesPlanService. */
@Injectable()
export class ProductSheetService implements OnModuleInit {
  private readonly logger = new Logger(ProductSheetService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.syncSheetsFromDisk();
  }

  /** Résout le dossier des .md (dist en prod, src en fallback). */
  /** Sans ce dossier le module démarre sans aucune fiche, avec un simple warn. */
  private resolveSheetsDir(): string | null {
    const rel = path.join('coaching', 'referentiels', 'product-sheets');
    const candidates = [
      path.join(__dirname, 'product-sheets'),
      // build nest : code compilé sous dist/src/coaching, assets sous dist/coaching
      path.join(__dirname, '..', '..', '..', rel),
      path.join(process.cwd(), 'dist', rel),
      path.join(process.cwd(), 'src', rel),
    ];
    return candidates.find((dir) => fs.existsSync(dir)) ?? null;
  }

  async syncSheetsFromDisk(): Promise<void> {
    const dir = this.resolveSheetsDir();
    if (!dir) {
      this.logger.warn(
        'Dossier product-sheets introuvable, aucune fiche produit chargée',
      );
      return;
    }
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      try {
        const source = fs.readFileSync(path.join(dir, file), 'utf8');
        await this.upsertVersion(parseProductSheetMarkdown(source));
      } catch (error) {
        this.logger.error(`Fiche "${file}" ignorée: ${(error as Error).message}`);
      }
    }
  }

  private async upsertVersion(file: ParsedProductSheetFile): Promise<void> {
    const { sheet, rawMarkdown, contentHash } = file;

    const existing = await this.prisma.productSheetVersion.findUnique({
      where: { contentHash },
    });
    if (existing) {
      await this.activateVersion(existing.id, sheet.slug);
      return;
    }

    const last = await this.prisma.productSheetVersion.findFirst({
      where: { slug: sheet.slug },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (last?.version ?? 0) + 1;

    const created = await this.prisma.productSheetVersion.create({
      data: {
        slug: sheet.slug,
        label: sheet.label,
        productKey: sheet.productKey,
        version: nextVersion,
        contentHash,
        facts: sheet.facts,
        identifiers: sheet.identifiers,
        sttTerms: sheet.sttTerms,
        forbidden: sheet.forbidden as unknown as object,
        winleadplus: (sheet.winleadplus ?? null) as unknown as object,
        rawMarkdown,
        isActive: false,
      },
    });
    await this.activateVersion(created.id, sheet.slug);
    this.logger.log(
      `Fiche produit "${sheet.slug}" v${nextVersion} enregistrée et activée`,
    );
  }

  /** Rend une version active et désactive les autres versions du même slug. */
  private async activateVersion(id: number, slug: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.productSheetVersion.updateMany({
        where: { slug, isActive: true, NOT: { id } },
        data: { isActive: false },
      }),
      this.prisma.productSheetVersion.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);
  }

  /** Un produit sans fiche est absent du résultat : la passe 2 ne l'invente pas. */
  async getActiveSheetsFor(
    productKeys: string[],
  ): Promise<ActiveProductSheet[]> {
    if (productKeys.length === 0) return [];
    const rows = await this.prisma.productSheetVersion.findMany({
      where: { productKey: { in: productKeys }, isActive: true },
    });
    return rows.map((row) => ({
      versionId: row.id,
      sheet: this.toParsedSheet(row),
    }));
  }

  /** Sans `facts` ni `forbidden` : nommer une offre ne donne pas le droit de la juger. */
  async getActiveDescriptors(
    productKeys: string[],
  ): Promise<ProductSheetDescriptor[]> {
    if (productKeys.length === 0) return [];
    const rows = await this.prisma.productSheetVersion.findMany({
      where: { productKey: { in: productKeys }, isActive: true },
      select: {
        productKey: true,
        label: true,
        identifiers: true,
        sttTerms: true,
      },
    });
    return rows.map((row) => ({
      productKey: row.productKey,
      label: row.label,
      identifiers: Array.isArray(row.identifiers)
        ? (row.identifiers as string[])
        : [],
      sttTerms: Array.isArray(row.sttTerms) ? (row.sttTerms as string[]) : [],
    }));
  }

  /** Toutes les fiches actives — alimente l'onglet Produits en lecture seule. */
  async listActiveSheets() {
    return this.prisma.productSheetVersion.findMany({
      where: { isActive: true },
      orderBy: { label: 'asc' },
    });
  }

  /** Reconstruit la fiche structurée à partir d'une ligne DB. */
  toParsedSheet(row: ProductSheetVersionRow): ParsedProductSheet {
    return {
      slug: row.slug,
      label: row.label,
      appliesTo: `productDetected:${row.productKey}` as StepApplicability,
      productKey: row.productKey,
      facts: Array.isArray(row.facts) ? (row.facts as string[]) : [],
      identifiers: Array.isArray(row.identifiers)
        ? (row.identifiers as string[])
        : [],
      sttTerms: Array.isArray(row.sttTerms) ? (row.sttTerms as string[]) : [],
      forbidden: Array.isArray(row.forbidden)
        ? (row.forbidden as ForbiddenClaim[])
        : [],
      winleadplus: (row.winleadplus as WinLeadPlusBinding | null) ?? undefined,
    };
  }
}
