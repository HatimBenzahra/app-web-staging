import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { calculateStatsForStatus } from '../porte/porte-status.constants';
import { CreateZoneInput, UpdateZoneInput, UserType } from './zone.dto';

@Injectable()
export class ZoneService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calcule les statistiques d'un utilisateur pour une zone pendant une période donnée
   */
  // Dans backend/src/zone/zone.service.ts, remplacer la fonction calculateUserStatsForZone

  private async calculateUserStatsForZone(
    userId: number,
    userType: UserType,
    zoneId: number,
    startDate: Date,
    endDate: Date,
  ) {
    //on calcule directement depuis les portes des immeubles de la zone
    let portesWhere: any = {
      immeuble: {
        zoneId: zoneId,
      },
      updatedAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    switch (userType) {
      case UserType.COMMERCIAL:
        portesWhere.immeuble.commercialId = userId;
        break;

      case UserType.MANAGER:
        // Portes des immeubles du manager OU de ses commerciaux
        portesWhere.immeuble.OR = [
          { managerId: userId },
          {
            commercial: {
              managerId: userId,
            },
          },
        ];
        break;

      case UserType.DIRECTEUR:
        // Portes des immeubles sous la responsabilité du directeur
        portesWhere.immeuble.OR = [
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
    }

    // Grouper les portes par statut
    const portesGrouped = await this.prisma.porte.groupBy({
      by: ['statut'],
      where: portesWhere,
      _count: {
        statut: true,
      },
    });

    // Calculer les immeubles visités
    const immeublesVisites = await this.prisma.immeuble.count({
      where: {
        zoneId: zoneId,
        ...(userType === UserType.COMMERCIAL
          ? { commercialId: userId }
          : userType === UserType.MANAGER
            ? {
                OR: [
                  { managerId: userId },
                  { commercial: { managerId: userId } },
                ],
              }
            : {
                OR: [
                  { commercial: { directeurId: userId } },
                  { manager: { directeurId: userId } },
                ],
              }),
        updatedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Calculer les totaux à partir des portes
    const stats = {
      totalContratsSignes: 0,
      totalImmeublesVisites: immeublesVisites,
      totalRendezVousPris: 0,
      totalRefus: 0,
      totalImmeublesProspectes: immeublesVisites,
      totalPortesProspectes: 0,
    };

    // Utilisation du helper centralisé pour calculer les stats
    portesGrouped.forEach((group) => {
      const count = group._count.statut;
      const statusStats = calculateStatsForStatus(group.statut, count);

      stats.totalContratsSignes += statusStats.contratsSignes;
      stats.totalRendezVousPris += statusStats.rendezVousPris;
      stats.totalRefus += statusStats.refus;
      stats.totalPortesProspectes += statusStats.nbPortesProspectes;
    });

    return stats;
  }

  /**
   * Récupère tous les commerciaux sous un manager
   */
  private async getCommercialsUnderManager(
    managerId: number,
    tx?: any,
  ): Promise<number[]> {
    const prisma = tx || this.prisma;
    const commercials = await prisma.commercial.findMany({
      where: { managerId },
      select: { id: true },
    });
    return commercials.map((c) => c.id);
  }

  /**
   * Récupère tous les managers et commerciaux sous un directeur
   */
  private async getTeamUnderDirector(
    directeurId: number,
    tx?: any,
  ): Promise<{ managers: number[]; commercials: number[] }> {
    const prisma = tx || this.prisma;

    // Récupérer tous les managers du directeur
    const managers = await prisma.manager.findMany({
      where: { directeurId },
      select: { id: true },
    });
    const managerIds = managers.map((m) => m.id);

    // Récupérer tous les commerciaux directement sous le directeur
    const directCommercials = await prisma.commercial.findMany({
      where: { directeurId },
      select: { id: true },
    });

    // Récupérer tous les commerciaux sous les managers de ce directeur
    const managersCommercials = await prisma.commercial.findMany({
      where: { managerId: { in: managerIds } },
      select: { id: true },
    });

    // Combiner tous les commerciaux (éviter les doublons avec Set)
    const allCommercialIds = new Set([
      ...directCommercials.map((c) => c.id),
      ...managersCommercials.map((c) => c.id),
    ]);

    return {
      managers: managerIds,
      commercials: Array.from(allCommercialIds),
    };
  }

  /**
   * Assigne un utilisateur à une zone (fonction interne, sans cascade)
   */
  private async assignSingleUserToZone(
    zoneId: number,
    userId: number,
    userType: UserType,
    tx: any,
  ) {
    // 1. Récupérer l'assignation en cours de cet utilisateur (s'il en a une)
    const currentAssignment = await tx.zoneEnCours.findUnique({
      where: {
        userId_userType: {
          userId,
          userType,
        },
      },
    });

    // 2. Si une assignation existe, la déplacer vers l'historique
    if (currentAssignment) {
      // Calculer les stats pour la période d'assignation
      const stats = await this.calculateUserStatsForZone(
        userId,
        userType,
        currentAssignment.zoneId,
        currentAssignment.assignedAt,
        new Date(),
      );

      // Créer l'entrée historique
      await tx.historiqueZone.create({
        data: {
          zoneId: currentAssignment.zoneId,
          userId,
          userType,
          assignedAt: currentAssignment.assignedAt,
          unassignedAt: new Date(),
          ...stats,
        },
      });

      // Supprimer l'assignation en cours
      await tx.zoneEnCours.delete({
        where: { id: currentAssignment.id },
      });
    }

    // 3. Créer la nouvelle assignation en cours
    const newAssignment = await tx.zoneEnCours.create({
      data: {
        zoneId,
        userId,
        userType,
      },
      include: {
        zone: true,
      },
    });

    return newAssignment;
  }

  /**
   * Fonction unifiée pour assigner une zone à un utilisateur (commercial, manager ou directeur)
   * Gère automatiquement l'historique des assignations et l'assignation en cascade
   *
   * CASCADE:
   * - Manager → assigne automatiquement tous ses commerciaux
   * - Directeur → assigne automatiquement tous ses managers ET commerciaux
   */
  async assignZoneToUser(
    zoneId: number,
    userId: number,
    userType: UserType,
    requestUserId?: number,
    requestUserRole?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Vérifier que la zone existe
      const zone = await tx.zone.findUnique({ where: { id: zoneId } });
      if (!zone) {
        throw new NotFoundException('Zone not found');
      }

      // 2. Authorization check (if auth params provided)
      if (requestUserId && requestUserRole && requestUserRole !== 'admin') {
        if (
          requestUserRole === 'directeur' &&
          zone.directeurId !== requestUserId
        ) {
          throw new ForbiddenException('Can only assign zones you own');
        }
        if (requestUserRole === 'manager' && zone.managerId !== requestUserId) {
          throw new ForbiddenException('Can only assign zones you own');
        }
      }

      // 3. Assigner l'utilisateur principal
      const mainAssignment = await this.assignSingleUserToZone(
        zoneId,
        userId,
        userType,
        tx,
      );

      // 4. CASCADE: Assigner les subordonnés selon le type d'utilisateur
      if (userType === UserType.MANAGER) {
        // Récupérer tous les commerciaux du manager
        const commercialIds = await this.getCommercialsUnderManager(userId, tx);

        // Assigner chaque commercial à la même zone
        for (const commercialId of commercialIds) {
          await this.assignSingleUserToZone(
            zoneId,
            commercialId,
            UserType.COMMERCIAL,
            tx,
          );
        }
      } else if (userType === UserType.DIRECTEUR) {
        // Récupérer tous les managers et commerciaux du directeur
        const team = await this.getTeamUnderDirector(userId, tx);

        // Assigner tous les managers
        for (const managerId of team.managers) {
          await this.assignSingleUserToZone(
            zoneId,
            managerId,
            UserType.MANAGER,
            tx,
          );
        }

        // Assigner tous les commerciaux
        for (const commercialId of team.commercials) {
          await this.assignSingleUserToZone(
            zoneId,
            commercialId,
            UserType.COMMERCIAL,
            tx,
          );
        }
      }

      return mainAssignment;
    });
  }

  async create(data: CreateZoneInput) {
    return this.prisma.zone.create({
      data,
    });
  }

  async findAll(userId?: number, userRole?: string) {
    // Vérifier que les paramètres sont définis (userId peut être 0 pour les admins)
    if (userId === undefined || !userRole) {
      throw new ForbiddenException('UNAUTHORIZED');
    }

    // Filtrage selon le rôle
    switch (userRole) {
      case 'admin':
        return this.prisma.zone.findMany({
          include: {
            immeubles: true,
          },
        });

      case 'directeur':
        // Zones assignées au directeur
        return this.prisma.zone.findMany({
          where: {
            directeurId: userId,
          },
          include: {
            immeubles: true,
          },
        });

      case 'manager':
        // Zones assignées au manager
        return this.prisma.zone.findMany({
          where: {
            managerId: userId,
          },
          include: {
            immeubles: true,
          },
        });

      case 'commercial':
        // Zones assignées au commercial via ZoneEnCours
        const zoneEnCours = await this.prisma.zoneEnCours.findUnique({
          where: {
            userId_userType: {
              userId,
              userType: UserType.COMMERCIAL,
            },
          },
          select: {
            zoneId: true,
          },
        });

        if (!zoneEnCours) {
          return [];
        }

        return this.prisma.zone.findMany({
          where: {
            id: zoneEnCours.zoneId,
          },
          include: {
            immeubles: true,
          },
        });

      default:
        return [];
    }
  }

  async findOne(id: number, userId: number, userRole: string) {
    // Admin can access all zones
    if (userRole === 'admin') {
      return this.prisma.zone.findUnique({
        where: { id },
        include: {
          immeubles: true,
        },
      });
    }

    // Get the zone
    const zone = await this.prisma.zone.findUnique({
      where: { id },
      include: {
        immeubles: true,
      },
    });

    if (!zone) {
      throw new NotFoundException('Zone not found');
    }

    // Directeur can only access their own zones
    if (userRole === 'directeur' && zone.directeurId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Manager can only access their own zones
    if (userRole === 'manager' && zone.managerId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Commercial can only access zones they are assigned to
    if (userRole === 'commercial') {
      const assignment = await this.prisma.zoneEnCours.findUnique({
        where: {
          userId_userType: {
            userId,
            userType: UserType.COMMERCIAL,
          },
          zoneId: id,
        },
      });

      if (!assignment) {
        throw new ForbiddenException('Access denied');
      }
    }

    return zone;
  }

  async assignToCommercial(
    zoneId: number,
    commercialId: number,
    userId: number,
    userRole: string,
  ) {
    // Validate authorization before assignment
    await this.validateZoneAssignmentAuth(zoneId, userId, userRole, 'manager');
    // Utiliser la nouvelle fonction unifiée
    return this.assignZoneToUser(zoneId, commercialId, UserType.COMMERCIAL);
  }

  async assignToDirecteur(
    zoneId: number,
    directeurId: number,
    userId: number,
    userRole: string,
  ) {
    // Only admin can assign to directeur
    if (userRole !== 'admin') {
      throw new ForbiddenException('Only admin can assign zones to directeurs');
    }
    // Utiliser la nouvelle fonction unifiée
    return this.assignZoneToUser(zoneId, directeurId, UserType.DIRECTEUR);
  }

  async assignToManager(
    zoneId: number,
    managerId: number,
    userId: number,
    userRole: string,
  ) {
    // Only admin and directeur can assign to manager
    await this.validateZoneAssignmentAuth(
      zoneId,
      userId,
      userRole,
      'directeur',
    );
    // Utiliser la nouvelle fonction unifiée
    return this.assignZoneToUser(zoneId, managerId, UserType.MANAGER);
  }

  private async validateZoneAssignmentAuth(
    zoneId: number,
    userId: number,
    userRole: string,
    minRole: 'admin' | 'directeur' | 'manager',
  ) {
    // Admin can always assign
    if (userRole === 'admin') return;

    // Get the zone
    const zone = await this.prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) {
      throw new NotFoundException('Zone not found');
    }

    // Check based on minimum required role
    if (minRole === 'directeur') {
      if (userRole !== 'admin' && userRole !== 'directeur') {
        throw new ForbiddenException('Access denied');
      }
      if (userRole === 'directeur' && zone.directeurId !== userId) {
        throw new ForbiddenException('Can only assign zones you own');
      }
    } else if (minRole === 'manager') {
      if (!['admin', 'directeur', 'manager'].includes(userRole)) {
        throw new ForbiddenException('Access denied');
      }
      if (userRole === 'directeur' && zone.directeurId !== userId) {
        throw new ForbiddenException('Can only assign zones you own');
      }
      if (userRole === 'manager' && zone.managerId !== userId) {
        throw new ForbiddenException('Can only assign zones you own');
      }
    }
  }

  /**
   * Désassigne un utilisateur de sa zone actuelle
   * Met l'assignation dans l'historique avec les stats calculées
   */
  async unassignUser(
    userId: number,
    userType: UserType,
    requestUserId: number,
    requestUserRole: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Récupérer l'assignation en cours
      const currentAssignment = await tx.zoneEnCours.findUnique({
        where: {
          userId_userType: {
            userId,
            userType,
          },
        },
      });

      if (!currentAssignment) {
        throw new NotFoundException(
          'No active zone assignment found for this user',
        );
      }

      // Authorization check
      if (requestUserRole !== 'admin') {
        const zone = await tx.zone.findUnique({
          where: { id: currentAssignment.zoneId },
        });
        if (!zone) {
          throw new NotFoundException('Zone not found');
        }

        if (
          requestUserRole === 'directeur' &&
          zone.directeurId !== requestUserId
        ) {
          throw new ForbiddenException('Can only unassign from zones you own');
        }
        if (requestUserRole === 'manager' && zone.managerId !== requestUserId) {
          throw new ForbiddenException('Can only unassign from zones you own');
        }
      }

      // Calculer les stats pour la période d'assignation
      const stats = await this.calculateUserStatsForZone(
        userId,
        userType,
        currentAssignment.zoneId,
        currentAssignment.assignedAt,
        new Date(),
      );

      // Créer l'entrée historique
      await tx.historiqueZone.create({
        data: {
          zoneId: currentAssignment.zoneId,
          userId,
          userType,
          assignedAt: currentAssignment.assignedAt,
          unassignedAt: new Date(),
          ...stats,
        },
      });

      // Supprimer l'assignation en cours
      await tx.zoneEnCours.delete({
        where: { id: currentAssignment.id },
      });

      return {
        success: true,
        message: 'User unassigned from zone successfully',
      };
    });
  }

  async unassignFromCommercial(
    zoneId: number,
    commercialId: number,
    requestUserId: number,
    requestUserRole: string,
  ) {
    // Utiliser la nouvelle fonction de désassignation
    return this.unassignUser(
      commercialId,
      UserType.COMMERCIAL,
      requestUserId,
      requestUserRole,
    );
  }

  /**
   * Récupère l'assignation en cours d'un utilisateur
   */
  async getCurrentAssignment(
    userId: number,
    userType: UserType,
    requestUserId: number,
    requestUserRole: string,
  ) {
    // Authorization: users can only query their own assignment or their subordinates'
    if (requestUserRole !== 'admin') {
      if (requestUserRole === 'commercial' && userId !== requestUserId) {
        throw new ForbiddenException('Can only view your own assignment');
      }

      // Manager can view their commercials' assignments
      if (requestUserRole === 'manager' && userType === UserType.COMMERCIAL) {
        const commercial = await this.prisma.commercial.findUnique({
          where: { id: userId },
          select: { managerId: true },
        });
        if (commercial?.managerId !== requestUserId) {
          throw new ForbiddenException(
            'Can only view your commercials assignments',
          );
        }
      } else if (requestUserRole === 'manager' && userId !== requestUserId) {
        throw new ForbiddenException('Access denied');
      }

      // Directeur can view their managers' and commercials' assignments
      if (requestUserRole === 'directeur') {
        if (userType === UserType.MANAGER) {
          const manager = await this.prisma.manager.findUnique({
            where: { id: userId },
            select: { directeurId: true },
          });
          if (manager?.directeurId !== requestUserId) {
            throw new ForbiddenException(
              'Can only view your managers assignments',
            );
          }
        } else if (userType === UserType.COMMERCIAL) {
          const commercial = await this.prisma.commercial.findUnique({
            where: { id: userId },
            select: { directeurId: true },
          });
          if (commercial?.directeurId !== requestUserId) {
            throw new ForbiddenException(
              'Can only view your commercials assignments',
            );
          }
        } else if (userId !== requestUserId) {
          throw new ForbiddenException('Access denied');
        }
      }
    }

    return this.prisma.zoneEnCours.findUnique({
      where: {
        userId_userType: {
          userId,
          userType,
        },
      },
      include: {
        zone: true,
      },
    });
  }

  /**
   * Récupère l'historique des assignations d'un utilisateur
   */
  async getUserZoneHistory(
    userId: number,
    userType: UserType,
    requestUserId: number,
    requestUserRole: string,
  ) {
    // Same authorization logic as getCurrentAssignment
    if (requestUserRole !== 'admin') {
      if (requestUserRole === 'commercial' && userId !== requestUserId) {
        throw new ForbiddenException('Can only view your own history');
      }

      if (requestUserRole === 'manager' && userType === UserType.COMMERCIAL) {
        const commercial = await this.prisma.commercial.findUnique({
          where: { id: userId },
          select: { managerId: true },
        });
        if (commercial?.managerId !== requestUserId) {
          throw new ForbiddenException(
            'Can only view your commercials history',
          );
        }
      } else if (requestUserRole === 'manager' && userId !== requestUserId) {
        throw new ForbiddenException('Access denied');
      }

      if (requestUserRole === 'directeur') {
        if (userType === UserType.MANAGER) {
          const manager = await this.prisma.manager.findUnique({
            where: { id: userId },
            select: { directeurId: true },
          });
          if (manager?.directeurId !== requestUserId) {
            throw new ForbiddenException('Can only view your managers history');
          }
        } else if (userType === UserType.COMMERCIAL) {
          const commercial = await this.prisma.commercial.findUnique({
            where: { id: userId },
            select: { directeurId: true },
          });
          if (commercial?.directeurId !== requestUserId) {
            throw new ForbiddenException(
              'Can only view your commercials history',
            );
          }
        } else if (userId !== requestUserId) {
          throw new ForbiddenException('Access denied');
        }
      }
    }

    return this.prisma.historiqueZone.findMany({
      where: {
        userId,
        userType,
      },
      include: {
        zone: true,
      },
      orderBy: {
        unassignedAt: 'desc',
      },
    });
  }

  /**
   * Récupère l'historique des assignations d'une zone
   */
  async getZoneHistory(zoneId: number) {
    return this.prisma.historiqueZone.findMany({
      where: {
        zoneId,
      },
      orderBy: {
        unassignedAt: 'desc',
      },
    });
  }

  /**
   * Récupère tous les utilisateurs actuellement assignés à une zone
   */
  async getZoneCurrentAssignments(
    zoneId: number,
    userId: number,
    userRole: string,
  ) {
    // Authorization: verify access to zone
    if (userRole !== 'admin') {
      const zone = await this.prisma.zone.findUnique({ where: { id: zoneId } });
      if (!zone) {
        throw new NotFoundException('Zone not found');
      }

      if (userRole === 'directeur' && zone.directeurId !== userId) {
        throw new ForbiddenException(
          'Can only view assignments for your zones',
        );
      }
      if (userRole === 'manager' && zone.managerId !== userId) {
        throw new ForbiddenException(
          'Can only view assignments for your zones',
        );
      }
    }

    return this.prisma.zoneEnCours.findMany({
      where: {
        zoneId,
      },
      include: {
        zone: true,
      },
    });
  }

  /**
   * Récupère TOUT l'historique des assignations de zones
   * Avec filtrage selon le rôle de l'utilisateur
   */
  async getAllZoneHistory(userId?: number, userRole?: string) {
    if (userId === undefined || !userRole) {
      throw new ForbiddenException('UNAUTHORIZED');
    }

    // Filtrage selon le rôle
    switch (userRole) {
      case 'admin':
        return this.prisma.historiqueZone.findMany({
          include: {
            zone: true,
          },
          orderBy: {
            unassignedAt: 'desc',
          },
        });

      case 'directeur':
        // Historique des zones du directeur
        return this.prisma.historiqueZone.findMany({
          where: {
            zone: {
              directeurId: userId,
            },
          },
          include: {
            zone: true,
          },
          orderBy: {
            unassignedAt: 'desc',
          },
        });

      case 'manager':
        // Historique des zones du manager
        return this.prisma.historiqueZone.findMany({
          where: {
            zone: {
              managerId: userId,
            },
          },
          include: {
            zone: true,
          },
          orderBy: {
            unassignedAt: 'desc',
          },
        });

      case 'commercial':
        // Historique des zones du commercial uniquement
        return this.prisma.historiqueZone.findMany({
          where: {
            userId: userId,
            userType: UserType.COMMERCIAL,
          },
          include: {
            zone: true,
          },
          orderBy: {
            unassignedAt: 'desc',
          },
        });

      default:
        return [];
    }
  }

  /**
   * Récupère TOUTES les assignations en cours
   * Avec filtrage selon le rôle de l'utilisateur
   */
  async getAllCurrentAssignments(userId?: number, userRole?: string) {
    if (userId === undefined || !userRole) {
      throw new ForbiddenException('UNAUTHORIZED');
    }

    // Filtrage selon le rôle
    switch (userRole) {
      case 'admin':
        return this.prisma.zoneEnCours.findMany({
          include: {
            zone: true,
          },
          orderBy: {
            assignedAt: 'desc',
          },
        });

      case 'directeur':
        // Assignations des zones du directeur
        return this.prisma.zoneEnCours.findMany({
          where: {
            zone: {
              directeurId: userId,
            },
          },
          include: {
            zone: true,
          },
          orderBy: {
            assignedAt: 'desc',
          },
        });

      case 'manager':
        // Assignations des zones du manager
        return this.prisma.zoneEnCours.findMany({
          where: {
            zone: {
              managerId: userId,
            },
          },
          include: {
            zone: true,
          },
          orderBy: {
            assignedAt: 'desc',
          },
        });

      case 'commercial':
        // Assignations des zones du commercial uniquement
        return this.prisma.zoneEnCours.findMany({
          where: {
            userId: userId,
            userType: UserType.COMMERCIAL,
          },
          include: {
            zone: true,
          },
          orderBy: {
            assignedAt: 'desc',
          },
        });

      default:
        return [];
    }
  }

  async update(data: UpdateZoneInput) {
    const { id, ...updateData } = data;
    return this.prisma.zone.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: number) {
    // Use a transaction to ensure all deletions succeed or fail together
    return this.prisma.$transaction(async (prisma) => {
      // Delete all statistics related to this zone
      await prisma.statistic.deleteMany({
        where: { zoneId: id },
      });

      // Note: ZoneEnCours and HistoriqueZone are deleted automatically
      // via cascade delete (onDelete: Cascade in schema)

      // Finally, delete the zone itself
      return prisma.zone.delete({
        where: { id },
      });
    });
  }
}
