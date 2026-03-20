import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RankPeriod } from '@prisma/client';

type PointTier = {
  key: string;
  label: string;
  minPoints: number;
  maxPoints: number | null;
};

type ScoreEntry = {
  commercialId: number | null;
  managerId: number | null;
  points: number;
  contratsSignes: number;
};

@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);

  private readonly pointTiers: PointTier[] = [
    { key: 'BRONZE', label: 'Bronze', minPoints: 0, maxPoints: 249 },
    { key: 'SILVER', label: 'Silver', minPoints: 250, maxPoints: 599 },
    { key: 'GOLD', label: 'Gold', minPoints: 600, maxPoints: 1199 },
    { key: 'PLATINUM', label: 'Platinum', minPoints: 1200, maxPoints: 2199 },
    { key: 'DIAMOND', label: 'Diamond', minPoints: 2200, maxPoints: 3499 },
    { key: 'MASTER', label: 'Master', minPoints: 3500, maxPoints: 4999 },
    { key: 'GRANDMASTER', label: 'Grandmaster', minPoints: 5000, maxPoints: 6999 },
    { key: 'LEGEND', label: 'Legend', minPoints: 7000, maxPoints: null },
  ];

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // COMPUTE — Calculer le classement pour une période donnée
  // ============================================================================

  /**
   * Calcule le classement de tous les commerciaux ET managers actifs pour une période.
   *
   * Points = somme des prix (prixBase) des contrats validés sur la période.
   * Contrat à 10€ = 10 points de plus pour le commercial/manager.
   *
   * Le calcul est idempotent: upsert par (commercialId/managerId, period, periodKey).
   */
  async computeRanking(
    period: RankPeriod,
    periodKey: string,
  ): Promise<{ computed: number }> {
    const periodField = this.getPeriodField(period);

    // 1. Récupérer tous les commerciaux avec mapping WinLead+ (ACTIF + CONTRAT_FINIE)
    const commercials = await this.prisma.commercial.findMany({
      where: {
        status: { in: ['ACTIF', 'CONTRAT_FINIE'] },
        winleadPlusId: { not: null },
      },
      select: { id: true },
    });

    // 2. Récupérer tous les managers avec mapping WinLead+ (ACTIF + CONTRAT_FINIE)
    const managers = await this.prisma.manager.findMany({
      where: {
        status: { in: ['ACTIF', 'CONTRAT_FINIE'] },
        winleadPlusId: { not: null },
      },
      select: { id: true },
    });

    // 3. Calculer les scores pour chaque commercial et manager
    const scores: ScoreEntry[] = [];

    for (const commercial of commercials) {
      const { points, contratsSignes } = await this.computeScore(
        'commercialId',
        commercial.id,
        periodField,
        periodKey,
      );
      scores.push({ commercialId: commercial.id, managerId: null, points, contratsSignes });
    }

    for (const manager of managers) {
      const { points, contratsSignes } = await this.computeScore(
        'managerId',
        manager.id,
        periodField,
        periodKey,
      );
      scores.push({ commercialId: null, managerId: manager.id, points, contratsSignes });
    }

    // 4. Trier par points décroissants, puis par contrats signés en cas d'égalité
    scores.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.contratsSignes - a.contratsSignes;
    });

    // 5. Attribuer les rangs (ex aequo supporté)
    let currentRank = 1;
    for (let i = 0; i < scores.length; i++) {
      if (i > 0 && scores[i].points < scores[i - 1].points) {
        currentRank = i + 1;
      }

      const entry = scores[i];
      const pointTier = this.resolvePointTier(entry.points);

      // Récupérer le rang précédent pour le metadata
      const previousSnapshot = await this.findPreviousSnapshot(entry, period, periodKey);
      const previousRank = previousSnapshot?.rank ?? null;
      const delta = previousRank !== null ? previousRank - currentRank : null;

      const snapshotData = {
        period,
        periodKey,
        rank: currentRank,
        points: entry.points,
        contratsSignes: entry.contratsSignes,
        metadata: {
          previousRank,
          delta,
          rankTierKey: pointTier.key,
          rankTierLabel: pointTier.label,
        },
      };

      if (entry.commercialId) {
        await this.prisma.rankSnapshot.upsert({
          where: {
            commercialId_period_periodKey: {
              commercialId: entry.commercialId,
              period,
              periodKey,
            },
          },
          create: { commercialId: entry.commercialId, ...snapshotData },
          update: { ...snapshotData, computedAt: new Date() },
        });
      } else if (entry.managerId) {
        await this.prisma.rankSnapshot.upsert({
          where: {
            managerId_period_periodKey: {
              managerId: entry.managerId,
              period,
              periodKey,
            },
          },
          create: { managerId: entry.managerId, ...snapshotData },
          update: { ...snapshotData, computedAt: new Date() },
        });
      }
    }

    this.logger.log(
      `Classement ${period}/${periodKey}: ${scores.length} participants classés (${commercials.length} commerciaux, ${managers.length} managers)`,
    );
    return { computed: scores.length };
  }

  // ============================================================================
  // READ — Récupérer le classement d'une période
  // ============================================================================

  async getRanking(period: RankPeriod, periodKey: string, includeContratFinie = false) {
    const statusFilter = includeContratFinie
      ? { in: ['ACTIF' as const, 'CONTRAT_FINIE' as const] }
      : { equals: 'ACTIF' as const };

    return this.prisma.rankSnapshot.findMany({
      where: {
        period,
        periodKey,
        OR: [
          { commercial: { winleadPlusId: { not: null }, status: statusFilter } },
          { manager: { winleadPlusId: { not: null }, status: statusFilter } },
        ],
      },
      include: {
        commercial: {
          select: { id: true, nom: true, prenom: true },
        },
        manager: {
          select: { id: true, nom: true, prenom: true },
        },
      },
      orderBy: { rank: 'asc' },
    });
  }

  async getOffreDistribution(periodMonth: string) {
    const contrats = await this.prisma.contratValide.findMany({
      where: { periodMonth },
      select: { offreId: true },
    });

    const countByOffre: Record<number, number> = {};
    for (const c of contrats) {
      if (c.offreId) countByOffre[c.offreId] = (countByOffre[c.offreId] || 0) + 1;
    }

    const offreIds = Object.keys(countByOffre).map(Number);
    if (offreIds.length === 0) return [];

    const offres = await this.prisma.offre.findMany({
      where: { id: { in: offreIds } },
      select: { id: true, nom: true, categorie: true, fournisseur: true, logoUrl: true },
    });

    const offreMap = new Map(offres.map(o => [o.id, o]));

    return offreIds
      .map(id => {
        const offre = offreMap.get(id);
        return {
          offreId: id,
          nom: offre?.nom || 'Inconnue',
          categorie: offre?.categorie || '',
          fournisseur: offre?.fournisseur || '',
          logoUrl: offre?.logoUrl || undefined,
          count: countByOffre[id],
        };
      })
      .sort((a, b) => b.count - a.count);
  }

  async getCommercialRankings(commercialId: number) {
    return this.prisma.rankSnapshot.findMany({
      where: { commercialId },
      orderBy: [{ period: 'asc' }, { computedAt: 'desc' }],
    });
  }

  /** Récupérer le classement d'un manager spécifique sur toutes les périodes */
  async getManagerRankings(managerId: number) {
    return this.prisma.rankSnapshot.findMany({
      where: { managerId },
      orderBy: [{ period: 'asc' }, { computedAt: 'desc' }],
    });
  }

  // ============================================================================
  // HELPERS — Calcul du score
  // ============================================================================

  /**
   * Calcule le score d'un commercial ou manager pour une période.
   *
   * Points = somme des Offre.prixBase des contrats validés sur la période.
   * Contrat à 10€ → 10 points. Contrat sans prix → 0 points.
   * ContratsSignes = nombre de contrats validés sur la période.
   */
  private async computeScore(
    userField: 'commercialId' | 'managerId',
    userId: number,
    periodField: string,
    periodKey: string,
  ): Promise<{ points: number; contratsSignes: number }> {
    const contrats = await this.prisma.contratValide.findMany({
      where: {
        [userField]: userId,
        [periodField]: periodKey,
      },
      include: {
        offre: {
          select: { prixBase: true },
        },
      },
    });

    const points = Math.round(
      contrats.reduce((sum, c) => sum + (c.offre?.prixBase ?? 0), 0),
    );

    return { points, contratsSignes: contrats.length };
  }

  /**
   * Trouve le snapshot précédent pour calculer le delta de rang.
   */
  private async findPreviousSnapshot(
    entry: ScoreEntry,
    period: RankPeriod,
    periodKey: string,
  ) {
    if (entry.commercialId) {
      return this.prisma.rankSnapshot.findUnique({
        where: {
          commercialId_period_periodKey: {
            commercialId: entry.commercialId,
            period,
            periodKey,
          },
        },
        select: { rank: true },
      });
    }
    if (entry.managerId) {
      return this.prisma.rankSnapshot.findUnique({
        where: {
          managerId_period_periodKey: {
            managerId: entry.managerId,
            period,
            periodKey,
          },
        },
        select: { rank: true },
      });
    }
    return null;
  }

  /**
   * Mappe un RankPeriod vers le champ ContratValide correspondant.
   */
  private getPeriodField(period: RankPeriod): string {
    switch (period) {
      case 'DAILY':
        return 'periodDay';
      case 'WEEKLY':
        return 'periodWeek';
      case 'MONTHLY':
        return 'periodMonth';
      case 'QUARTERLY':
        return 'periodQuarter';
      case 'YEARLY':
        return 'periodYear';
      default:
        return 'periodMonth';
    }
  }

  resolvePointTier(points: number): PointTier {
    const safePoints = Math.max(0, points || 0);

    for (const tier of this.pointTiers) {
      if (tier.maxPoints === null && safePoints >= tier.minPoints) {
        return tier;
      }

      if (tier.maxPoints !== null && safePoints >= tier.minPoints && safePoints <= tier.maxPoints) {
        return tier;
      }
    }

    return this.pointTiers[0];
  }
}
