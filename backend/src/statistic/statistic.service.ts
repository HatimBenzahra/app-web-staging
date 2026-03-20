import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { calculateStatsForStatus } from '../porte/porte-status.constants';
import {
  CreateStatisticInput,
  UpdateStatisticInput,
  ZoneStatistic,
  TimelinePoint,
} from './statistic.dto';

@Injectable()
export class StatisticService {
  constructor(private prisma: PrismaService) {}

  private async assertStatisticAccess(
    statisticId: number,
    userId: number,
    userRole: string,
  ) {
    const statistic = await this.prisma.statistic.findUnique({
      where: { id: statisticId },
      include: {
        commercial: {
          select: { id: true, managerId: true, directeurId: true },
        },
        manager: {
          select: { id: true, directeurId: true },
        },
      },
    });

    if (!statistic) {
      throw new NotFoundException('Statistic not found');
    }

    if (userRole === 'admin') {
      return statistic;
    }

    if (
      userRole === 'commercial' &&
      statistic.commercialId !== userId
    ) {
      throw new ForbiddenException('Access denied');
    }

    if (userRole === 'manager') {
      const ownsStatistic =
        statistic.managerId === userId ||
        statistic.commercial?.managerId === userId;

      if (!ownsStatistic) {
        throw new ForbiddenException('Access denied');
      }
    }

    if (userRole === 'directeur') {
      const ownsStatistic =
        statistic.manager?.directeurId === userId ||
        statistic.commercial?.directeurId === userId;

      if (!ownsStatistic) {
        throw new ForbiddenException('Access denied');
      }
    }

    return statistic;
  }

  private async ensureImmeubleAccess(
    immeubleId: number,
    userId: number,
    userRole: string,
  ) {
    const immeuble = await this.prisma.immeuble.findUnique({
      where: { id: immeubleId },
      include: {
        commercial: {
          select: { id: true, managerId: true, directeurId: true },
        },
        manager: {
          select: { id: true, directeurId: true },
        },
        zone: {
          select: { id: true, managerId: true, directeurId: true },
        },
      },
    });

    if (!immeuble) {
      throw new NotFoundException('Immeuble not found');
    }

    if (userRole === 'admin') {
      return;
    }

    if (userRole === 'commercial' && immeuble.commercialId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (userRole === 'manager') {
      const ownsImmeuble =
        immeuble.managerId === userId ||
        immeuble.commercial?.managerId === userId ||
        immeuble.zone?.managerId === userId;
      if (!ownsImmeuble) {
        throw new ForbiddenException('Access denied');
      }
    }

    if (userRole === 'directeur') {
      const ownsImmeuble =
        immeuble.manager?.directeurId === userId ||
        immeuble.commercial?.directeurId === userId ||
        immeuble.zone?.directeurId === userId;
      if (!ownsImmeuble) {
        throw new ForbiddenException('Access denied');
      }
    }
  }

  async create(data: CreateStatisticInput) {
    return this.prisma.statistic.create({
      data,
      include: {
        commercial: true,
        manager: true,
      },
    });
  }

  async findAll(commercialId?: number, userId?: number, userRole?: string) {
    // Construire les conditions de filtrage
    let whereConditions: any = {};

    // Si commercialId est spécifié, filtrer par commercial
    if (commercialId) {
      whereConditions.commercialId = commercialId;
    }

    // Si userId et userRole sont fournis, appliquer la filtration par rôle
    if (userId && userRole) {
      switch (userRole) {
        case 'admin':
          // Pas de filtrage supplémentaire pour admin
          break;

        case 'directeur':
          // Statistiques des commerciaux ET managers du directeur
          whereConditions.OR = [
            {
              commercial: {
                directeurId: userId,
              },
            },
            {
              manager: {
                directeurId: userId,
              },
            },
          ];
          break;

        case 'manager':
          // Statistiques des commerciaux du manager ET ses propres statistiques
          whereConditions.OR = [
            {
              commercial: {
                managerId: userId,
              },
            },
            {
              managerId: userId,
            },
          ];
          break;

        case 'commercial':
          // Statistiques du commercial lui-même
          whereConditions.commercialId = userId;
          break;

        default:
          return [];
      }
    }

    return this.prisma.statistic.findMany({
      where: whereConditions,
      include: {
        commercial: true,
        manager: true,
      },
    });
  }

  async findOne(id: number, userId: number, userRole: string) {
    await this.assertStatisticAccess(id, userId, userRole);

    return this.prisma.statistic.findUnique({
      where: { id },
      include: {
        commercial: true,
        manager: true,
      },
    });
  }

  async update(
    data: UpdateStatisticInput,
    userId: number,
    userRole: string,
  ) {
    const { id, ...updateData } = data;

    const statistic = await this.assertStatisticAccess(id, userId, userRole);

    if (userRole !== 'admin') {
      if (
        updateData.commercialId &&
        updateData.commercialId !== statistic.commercialId
      ) {
        throw new ForbiddenException('Cannot reassign statistic owner');
      }

      if (
        updateData.managerId &&
        updateData.managerId !== statistic.managerId
      ) {
        throw new ForbiddenException('Cannot reassign statistic owner');
      }
    }

    return this.prisma.statistic.update({
      where: { id },
      data: updateData,
      include: {
        commercial: true,
        manager: true,
      },
    });
  }

  async remove(id: number, userId: number, userRole: string) {
    await this.assertStatisticAccess(id, userId, userRole);

    return this.prisma.statistic.delete({
      where: { id },
      include: {
        commercial: true,
        manager: true,
      },
    });
  }

  async getZoneStatistics(
    userId?: number,
    userRole?: string,
  ): Promise<ZoneStatistic[]> {
    // =====================================================
    // ZoneEnCours + HistoriqueZone
    // =====================================================

    // 1. Récupérer toutes les assignations en cours
    const currentAssignments = await this.prisma.zoneEnCours.findMany({
      include: {
        zone: true,
      },
    });

    // 2. Récupérer tout l'historique des assignations
    const historyAssignments = await this.prisma.historiqueZone.findMany({
      include: {
        zone: true,
      },
    });

    // 3. Créer un Set de toutes les zones qui ont été prospectées
    let allZoneIds = new Set<number>();
    currentAssignments.forEach((a) => allZoneIds.add(a.zoneId));
    historyAssignments.forEach((h) => allZoneIds.add(h.zoneId));

    // 4. Filtrer les zones selon le rôle de l'utilisateur
    if (userId && userRole && userRole !== 'admin') {
      const authorizedZoneIds = new Set<number>();

      switch (userRole) {
        case 'commercial':
          // Un commercial ne voit que les zones où il a été assigné
          currentAssignments
            .filter(
              (a) => a.userId === userId && a.userType === 'COMMERCIAL',
            )
            .forEach((a) => authorizedZoneIds.add(a.zoneId));
          historyAssignments
            .filter(
              (h) => h.userId === userId && h.userType === 'COMMERCIAL',
            )
            .forEach((h) => authorizedZoneIds.add(h.zoneId));
          break;

        case 'manager':
          // Un manager voit les zones où lui ou ses commerciaux ont été assignés
          // Récupérer les IDs des commerciaux du manager
          const managerCommercials = await this.prisma.commercial.findMany({
            where: { managerId: userId },
            select: { id: true },
          });
          const commercialIds = managerCommercials.map((c) => c.id);

          // Zones du manager lui-même
          currentAssignments
            .filter((a) => a.userId === userId && a.userType === 'MANAGER')
            .forEach((a) => authorizedZoneIds.add(a.zoneId));
          historyAssignments
            .filter((h) => h.userId === userId && h.userType === 'MANAGER')
            .forEach((h) => authorizedZoneIds.add(h.zoneId));

          // Zones des commerciaux du manager
          currentAssignments
            .filter(
              (a) =>
                commercialIds.includes(a.userId) &&
                a.userType === 'COMMERCIAL',
            )
            .forEach((a) => authorizedZoneIds.add(a.zoneId));
          historyAssignments
            .filter(
              (h) =>
                commercialIds.includes(h.userId) &&
                h.userType === 'COMMERCIAL',
            )
            .forEach((h) => authorizedZoneIds.add(h.zoneId));
          break;

        case 'directeur':
          // Un directeur voit les zones où lui, ses managers ou ses commerciaux ont été assignés
          // Récupérer les IDs des managers du directeur
          const directeurManagers = await this.prisma.manager.findMany({
            where: { directeurId: userId },
            select: { id: true },
          });
          const managerIds = directeurManagers.map((m) => m.id);

          // Récupérer les IDs des commerciaux du directeur
          const directeurCommercials = await this.prisma.commercial.findMany({
            where: {
              OR: [{ directeurId: userId }, { managerId: { in: managerIds } }],
            },
            select: { id: true },
          });
          const directeurCommercialIds = directeurCommercials.map((c) => c.id);

          // Zones du directeur lui-même
          currentAssignments
            .filter((a) => a.userId === userId && a.userType === 'DIRECTEUR')
            .forEach((a) => authorizedZoneIds.add(a.zoneId));
          historyAssignments
            .filter((h) => h.userId === userId && h.userType === 'DIRECTEUR')
            .forEach((h) => authorizedZoneIds.add(h.zoneId));

          // Zones des managers du directeur
          currentAssignments
            .filter(
              (a) => managerIds.includes(a.userId) && a.userType === 'MANAGER',
            )
            .forEach((a) => authorizedZoneIds.add(a.zoneId));
          historyAssignments
            .filter(
              (h) => managerIds.includes(h.userId) && h.userType === 'MANAGER',
            )
            .forEach((h) => authorizedZoneIds.add(h.zoneId));

          // Zones des commerciaux du directeur
          currentAssignments
            .filter(
              (a) =>
                directeurCommercialIds.includes(a.userId) &&
                a.userType === 'COMMERCIAL',
            )
            .forEach((a) => authorizedZoneIds.add(a.zoneId));
          historyAssignments
            .filter(
              (h) =>
                directeurCommercialIds.includes(h.userId) &&
                h.userType === 'COMMERCIAL',
            )
            .forEach((h) => authorizedZoneIds.add(h.zoneId));
          break;

        default:
          return [];
      }

      // Utiliser uniquement les zones autorisées
      allZoneIds = authorizedZoneIds;
    }

    // 4. Récupérer les détails des zones
    const zones = await this.prisma.zone.findMany({
      where: {
        id: { in: Array.from(allZoneIds) },
      },
    });

    // 5. Calculer les statistiques agrégées pour chaque zone
    const zoneStatistics: ZoneStatistic[] = await Promise.all(
      zones.map(async (zone) => {
        // NOUVELLE LOGIQUE: Compter directement les portes des immeubles dans cette zone
        // Ceci donne les vraies statistiques de la zone, pas les stats agrégées des commerciaux

        // Compter les portes par statut pour cette zone
        const portesGroupedByStatut = await this.prisma.porte.groupBy({
          by: ['statut'],
          where: {
            immeuble: {
              zoneId: zone.id,
            },
          },
          _count: {
            statut: true,
          },
          _sum: {
            nbContrats: true,
          },
        });

        // Calculer les stats à partir des portes
        let totalStats = {
          contratsSignes: 0,
          immeublesVisites: 0,
          rendezVousPris: 0,
          refus: 0,
          immeublesProspectes: 0,
          portesProspectes: 0,
        };

        // Utilisation du helper centralisé pour calculer les stats
        portesGroupedByStatut.forEach((group) => {
          const count = group._count.statut;
          const totalContrats = group._sum.nbContrats || 0;
          const statusStats = calculateStatsForStatus(group.statut, count);

          if (group.statut === 'CONTRAT_SIGNE') {
             totalStats.contratsSignes += totalContrats;
          } else {
             totalStats.contratsSignes += statusStats.contratsSignes;
          }
          
          totalStats.rendezVousPris += statusStats.rendezVousPris;
          totalStats.refus += statusStats.refus;
          totalStats.portesProspectes += statusStats.nbPortesProspectes;
        });

        // Compter les immeubles visités (au moins une porte non NON_VISITE)
        const immeublesVisites = await this.prisma.immeuble.count({
          where: {
            zoneId: zone.id,
            portes: {
              some: {
                statut: {
                  not: 'NON_VISITE',
                },
              },
            },
          },
        });

        totalStats.immeublesVisites = immeublesVisites;
        totalStats.immeublesProspectes = immeublesVisites;

        // Compter le nombre unique de commerciaux et managers assignés à cette zone
        const usersInZone = new Set<number>();

        // Utilisateurs des assignations actuelles
        const zoneCurrentAssignments = currentAssignments.filter(
          (a) => a.zoneId === zone.id,
        );
        zoneCurrentAssignments.forEach((assignment) => {
          usersInZone.add(assignment.userId);
        });

        // Utilisateurs de l'historique
        const zoneHistory = historyAssignments.filter(
          (h) => h.zoneId === zone.id,
        );
        zoneHistory.forEach((history) => {
          usersInZone.add(history.userId);
        });

        // Les totaux finaux
        const totalContratsSignes = totalStats.contratsSignes;
        const totalImmeublesVisites = totalStats.immeublesVisites;
        const totalRendezVousPris = totalStats.rendezVousPris;
        const totalRefus = totalStats.refus;
        const totalImmeublesProspectes = totalStats.immeublesProspectes;
        const totalPortesProspectes = totalStats.portesProspectes;

        // Calculs des taux
        const tauxConversion =
          totalRefus + totalRendezVousPris + totalContratsSignes > 0
            ? (totalContratsSignes /
                (totalRefus + totalRendezVousPris + totalContratsSignes)) *
              100
            : 0;

        const tauxSuccesRdv =
          totalImmeublesVisites > 0
            ? (totalRendezVousPris / totalImmeublesVisites) * 100
            : 0;

        // Performance globale (somme des 2 taux)
        const performanceGlobale = tauxConversion + tauxSuccesRdv;

        return {
          zoneId: zone.id,
          zoneName: zone.nom,
          totalContratsSignes,
          totalImmeublesVisites,
          totalRendezVousPris,
          totalRefus,
          totalImmeublesProspectes,
          totalPortesProspectes,
          tauxConversion: Math.round(tauxConversion * 100) / 100,
          tauxSuccesRdv: Math.round(tauxSuccesRdv * 100) / 100,
          nombreCommerciaux: usersInZone.size,
          performanceGlobale: Math.round(performanceGlobale * 100) / 100,
        };
      }),
    );

    // Trier par performance globale décroissante
    return zoneStatistics.sort(
      (a, b) => b.performanceGlobale - a.performanceGlobale,
    );
  }

  async ensureCanSyncCommercialStats(
    immeubleId: number,
    userId: number,
    userRole: string,
  ) {
    await this.ensureImmeubleAccess(immeubleId, userId, userRole);
  }

  async ensureCanSyncManagerStats(
    managerId: number,
    userId: number,
    userRole: string,
  ) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId },
      select: { id: true, directeurId: true },
    });

    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    if (userRole === 'admin') {
      return;
    }

    if (userRole === 'directeur' && manager.directeurId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (userRole === 'manager' && manager.id !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }

  private async ensureCommercialAccess(
    commercialId: number,
    userId: number,
    userRole: string,
  ) {
    const commercial = await this.prisma.commercial.findUnique({
      where: { id: commercialId },
      select: { id: true, managerId: true, directeurId: true },
    });

    if (!commercial) {
      throw new NotFoundException('Commercial not found');
    }

    if (userRole === 'admin') {
      return;
    }

    if (userRole === 'commercial' && commercial.id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (userRole === 'manager' && commercial.managerId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (userRole === 'directeur' && commercial.directeurId !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }

  async statsTimelineByCommercial(
    commercialId: number,
    userId: number,
    userRole: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TimelinePoint[]> {
    await this.ensureCommercialAccess(commercialId, userId, userRole);

    const validStart =
      startDate && !isNaN(new Date(startDate).getTime())
        ? new Date(startDate)
        : undefined;
    const validEnd =
      endDate && !isNaN(new Date(endDate).getTime())
        ? new Date(endDate)
        : undefined;

    const history = await this.prisma.statusHistorique.findMany({
      where: {
        commercialId,
        ...(validStart || validEnd
          ? {
              createdAt: {
                ...(validStart ? { gte: validStart } : {}),
                ...(validEnd ? { lte: validEnd } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        statut: true,
        createdAt: true,
      },
    });

    const grouped = new Map<string, TimelinePoint>();

    history.forEach((entry) => {
      const dayKey = entry.createdAt.toISOString().slice(0, 10);
      if (!grouped.has(dayKey)) {
        grouped.set(dayKey, {
          date: new Date(dayKey),
          rdvPris: 0,
          portesProspectees: 0,
          contratsSignes: 0,
          refus: 0,
          absents: 0,
          argumentes: 0,
        });
      }

      const stats = calculateStatsForStatus(entry.statut, 1);
      const current = grouped.get(dayKey)!;
      current.rdvPris += stats.rendezVousPris;
      current.portesProspectees += stats.nbPortesProspectes;
      current.contratsSignes += stats.contratsSignes;
      current.refus += stats.refus;
      current.absents += stats.absents;
      current.argumentes += stats.argumentes;
    });

    return Array.from(grouped.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
  }
}
