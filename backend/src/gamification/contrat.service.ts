import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WinleadPlusApiService } from './winleadplus-api.service';

/**
 * Service de synchronisation des contrats validés depuis WinLead+ /api/prospects.
 *
 * Structure API WinLead+ :
 * prospect.commercialId (UUID) → maps to Commercial.winleadPlusId
 * prospect.Souscription[].offreId → maps to Offre.externalId
 * prospect.Souscription[].contrats[].statut === "Validé" → critère
 * prospect.Souscription[].contrats[].dateValidation → pour le calcul de période
 */
@Injectable()
export class ContratService {
  private readonly logger = new Logger(ContratService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly winleadPlusApi: WinleadPlusApiService,
  ) {}

  // ============================================================================
  // SYNCHRO — Extraire et cacher les contrats validés depuis /api/prospects
  // ============================================================================

  async syncContrats(
    token: string,
  ): Promise<{ created: number; updated: number; skipped: number; total: number }> {
    const prospects = await this.winleadPlusApi.getProspects(token);

    // Pré-charger les mappings pour résolution rapide
    const [commercialMap, managerMap, offreMap] = await Promise.all([
      this.buildCommercialMap(),
      this.buildManagerMap(),
      this.buildOffreMap(),
    ]);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let totalContrats = 0;

    for (const prospect of prospects) {
      const souscriptions = prospect.Souscription || [];

      for (const souscription of souscriptions) {
        const contrats = souscription.contrats || [];

        for (const contrat of contrats) {
          totalContrats++;

          // Filtre strict: seuls les contrats "Validé" nous intéressent
          if (contrat.statut !== 'Validé') {
            skipped++;
            continue;
          }

          // commercialId est obligatoire pour la gamification
          if (!prospect.commercialId) {
            skipped++;
            continue;
          }

          // dateValidation est obligatoire pour le calcul de périodes
          if (!contrat.dateValidation) {
            skipped++;
            continue;
          }

          const result = await this.upsertContratValide(
            contrat,
            prospect,
            souscription,
            commercialMap,
            managerMap,
            offreMap,
          );

          if (result === 'created') created++;
          else if (result === 'updated') updated++;
        }
      }
    }

    this.logger.log(
      `Synchro contrats: ${created} créés, ${updated} mis à jour, ${skipped} ignorés (${totalContrats} total)`,
    );

    return { created, updated, skipped, total: totalContrats };
  }

  // ============================================================================
  // READ — Lecture des contrats validés
  // ============================================================================

  /** Contrats validés d'un commercial (par son ID Pro-Win) */
  async getContratsByCommercial(commercialId: number) {
    return this.prisma.contratValide.findMany({
      where: { commercialId },
      include: { offre: true },
      orderBy: { dateValidation: 'desc' },
    });
  }

  /** Contrats validés d'un manager (par son ID Pro-Win) */
  async getContratsByManager(managerId: number) {
    return this.prisma.contratValide.findMany({
      where: { managerId },
      include: { offre: true },
      orderBy: { dateValidation: 'desc' },
    });
  }

  /** Contrats validés d'un commercial par période */
  async getContratsByCommercialAndPeriod(
    commercialId: number,
    periodField: 'periodDay' | 'periodWeek' | 'periodMonth' | 'periodQuarter' | 'periodYear',
    periodValue: string,
  ) {
    return this.prisma.contratValide.findMany({
      where: { commercialId, [periodField]: periodValue },
      include: { offre: true },
      orderBy: { dateValidation: 'desc' },
    });
  }

  // ============================================================================
  // HELPERS — Upsert et résolution des clés
  // ============================================================================

  private async upsertContratValide(
    contrat: any,
    prospect: any,
    souscription: any,
    commercialMap: Map<string, number>,
    managerMap: Map<string, number>,
    offreMap: Map<number, number>,
  ): Promise<'created' | 'updated'> {
    const dateValidation = new Date(contrat.dateValidation);
    const periods = this.computePeriodKeys(dateValidation);

    const commercialId = commercialMap.get(prospect.commercialId) ?? null;
    const managerId = managerMap.get(prospect.commercialId) ?? null;
    const offreExternalId = souscription.offreId ?? null;
    const offreId = offreExternalId ? (offreMap.get(offreExternalId) ?? null) : null;

    const existing = await this.prisma.contratValide.findUnique({
      where: { externalContratId: contrat.id },
      select: { id: true },
    });

    const data = {
      externalProspectId: prospect.idProspect ?? prospect.id,
      commercialWinleadPlusId: prospect.commercialId,
      commercialId,
      managerId,
      offreExternalId,
      offreId,
      dateValidation,
      dateSignature: contrat.dateSignature ? new Date(contrat.dateSignature) : null,
      periodDay: periods.day,
      periodWeek: periods.week,
      periodMonth: periods.month,
      periodQuarter: periods.quarter,
      periodYear: periods.year,
      metadata: {
        prospectStatut: prospect.statutProspect,
        offreNom: souscription.offre?.nom,
        offreCategorie: souscription.offre?.categorie,
        offreFournisseur: souscription.offre?.fournisseur,
      },
      syncedAt: new Date(),
    };

    if (existing) {
      await this.prisma.contratValide.update({
        where: { externalContratId: contrat.id },
        data,
      });
      return 'updated';
    }

    await this.prisma.contratValide.create({
      data: {
        externalContratId: contrat.id,
        ...data,
      },
    });
    return 'created';
  }

  /**
   * Construit un Map<winleadPlusId, commercialId> pour résolution rapide.
   * Seuls les commerciaux ayant un mapping WinLead+ sont inclus.
   */
  private async buildCommercialMap(): Promise<Map<string, number>> {
    const commercials = await this.prisma.commercial.findMany({
      where: { winleadPlusId: { not: null } },
      select: { id: true, winleadPlusId: true },
    });

    const map = new Map<string, number>();
    for (const c of commercials) {
      if (c.winleadPlusId) {
        map.set(c.winleadPlusId, c.id);
      }
    }
    return map;
  }

  /**
   * Construit un Map<winleadPlusId, managerId> pour résolution rapide.
   * Seuls les managers ayant un mapping WinLead+ sont inclus.
   */
  private async buildManagerMap(): Promise<Map<string, number>> {
    const managers = await this.prisma.manager.findMany({
      where: { winleadPlusId: { not: null } },
      select: { id: true, winleadPlusId: true },
    });

    const map = new Map<string, number>();
    for (const m of managers) {
      if (m.winleadPlusId) {
        map.set(m.winleadPlusId, m.id);
      }
    }
    return map;
  }

  /**
   * Construit un Map<externalId, offreId> pour résolution rapide.
   */
  private async buildOffreMap(): Promise<Map<number, number>> {
    const offres = await this.prisma.offre.findMany({
      select: { id: true, externalId: true },
    });

    const map = new Map<number, number>();
    for (const o of offres) {
      map.set(o.externalId, o.id);
    }
    return map;
  }

  /**
   * Calcule les clés de période à partir d'une date de validation.
   * Format ISO pour cohérence avec les autres tables gamification.
   */
  private computePeriodKeys(date: Date): {
    day: string;
    week: string;
    month: string;
    quarter: string;
    year: string;
  } {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    return {
      day: `${y}-${m}-${d}`,
      week: `${y}-W${this.getISOWeek(date)}`,
      month: `${y}-${m}`,
      quarter: `${y}-Q${Math.ceil((date.getMonth() + 1) / 3)}`,
      year: `${y}`,
    };
  }

  /**
   * Retourne le numéro de semaine ISO 8601 (lundi = début de semaine).
   */
  private getISOWeek(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return String(weekNo).padStart(2, '0');
  }
}
