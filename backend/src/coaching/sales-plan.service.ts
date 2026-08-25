import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma.service';
import {
  ParsedSalesPlanFile,
  parseSalesPlanMarkdown,
} from './sales-plan.parser';
import {
  ParsedSalesPlan,
  SalesPlanCriteriaPayload,
} from './sales-plan.types';

type SalesPlanVersionRow = {
  id: number;
  slug: string;
  title: string;
  version: number;
  criteria: unknown;
  rawMarkdown: string;
};

/**
 * Charge les plans de vente markdown (dossier sales-plans/) au démarrage,
 * les versionne en DB (clé = sha256 du contenu) et expose la version active.
 */
@Injectable()
export class SalesPlanService implements OnModuleInit {
  private readonly logger = new Logger(SalesPlanService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.syncPlansFromDisk();
  }

  /** Résout le dossier des .md (dist en prod, src en fallback). */
  private resolvePlansDir(): string | null {
    const candidates = [
      path.join(__dirname, 'sales-plans'),
      // build nest : code compilé sous dist/src/coaching, assets sous dist/coaching
      path.join(__dirname, '..', '..', 'coaching', 'sales-plans'),
      path.join(process.cwd(), 'dist', 'coaching', 'sales-plans'),
      path.join(process.cwd(), 'src', 'coaching', 'sales-plans'),
    ];
    return candidates.find((dir) => fs.existsSync(dir)) ?? null;
  }

  async syncPlansFromDisk(): Promise<void> {
    const dir = this.resolvePlansDir();
    if (!dir) {
      this.logger.warn('Dossier sales-plans introuvable, aucun plan chargé');
      return;
    }
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      try {
        const source = fs.readFileSync(path.join(dir, file), 'utf8');
        const parsed = parseSalesPlanMarkdown(source);
        await this.upsertVersion(parsed);
      } catch (error) {
        this.logger.error(
          `Plan "${file}" ignoré: ${(error as Error).message}`,
        );
      }
    }
  }

  private async upsertVersion(file: ParsedSalesPlanFile): Promise<void> {
    const { plan, rawMarkdown, contentHash } = file;
    const payload: SalesPlanCriteriaPayload = {
      scoringScale: plan.scoringScale,
      quality: plan.quality,
      malus: plan.malus,
      steps: plan.steps,
      context: plan.context,
      language: plan.language,
    };

    const existing = await this.prisma.salesPlanVersion.findUnique({
      where: { contentHash },
    });
    if (existing) {
      await this.activateVersion(existing.id, plan.slug);
      return;
    }

    const last = await this.prisma.salesPlanVersion.findFirst({
      where: { slug: plan.slug },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (last?.version ?? 0) + 1;

    const created = await this.prisma.salesPlanVersion.create({
      data: {
        slug: plan.slug,
        title: plan.title,
        version: nextVersion,
        contentHash,
        criteria: payload as unknown as object,
        rawMarkdown,
        isActive: false,
      },
    });
    await this.activateVersion(created.id, plan.slug);
    this.logger.log(
      `Plan de vente "${plan.slug}" v${nextVersion} enregistré et activé`,
    );
  }

  /** Rend une version active et désactive les autres versions du même slug. */
  private async activateVersion(id: number, slug: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.salesPlanVersion.updateMany({
        where: { slug, isActive: true, NOT: { id } },
        data: { isActive: false },
      }),
      this.prisma.salesPlanVersion.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);
  }

  /** Version active pour un slug donné, ou la plus récente si slug omis. */
  async getActiveVersion(slug?: string) {
    if (slug) {
      return this.prisma.salesPlanVersion.findFirst({
        where: { slug, isActive: true },
      });
    }
    return this.prisma.salesPlanVersion.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Reconstruit le plan structuré à partir d'une ligne DB. */
  toParsedPlan(row: SalesPlanVersionRow): ParsedSalesPlan {
    const c = (row.criteria ?? {}) as SalesPlanCriteriaPayload;
    return {
      slug: row.slug,
      title: row.title,
      scoringScale: c.scoringScale ?? 100,
      quality: c.quality ?? {},
      // Analyses antérieures au malus : barème par défaut, aucune violation à leur appliquer.
      malus: c.malus ?? { grave: 15, modere: 8, maxTotal: 30 },
      steps: c.steps ?? [],
      context: c.context,
      language: c.language,
    };
  }
}
