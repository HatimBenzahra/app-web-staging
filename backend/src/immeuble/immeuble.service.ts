import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateImmeubleInput, UpdateImmeubleInput } from './immeuble.dto';

@Injectable()
export class ImmeubleService {
  constructor(private prisma: PrismaService) {}

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
      return immeuble;
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

    return immeuble;
  }

  async create(data: CreateImmeubleInput) {
    // Si un commercialId ou managerId est fourni, récupérer sa zone assignée
    let zoneId = data.zoneId; // Utiliser la zone fournie explicitement

    if (!zoneId && data.commercialId) {
      // Chercher la zone assignée au commercial via ZoneEnCours
      const zoneEnCours = await this.prisma.zoneEnCours.findUnique({
        where: {
          userId_userType: {
            userId: data.commercialId,
            userType: 'COMMERCIAL',
          },
        },
      });

      if (zoneEnCours) {
        zoneId = zoneEnCours.zoneId;
      }
    }

    if (!zoneId && data.managerId) {
      // Chercher la zone assignée au manager via ZoneEnCours (nouveau système)
      const zoneEnCours = await this.prisma.zoneEnCours.findUnique({
        where: {
          userId_userType: {
            userId: data.managerId,
            userType: 'MANAGER',
          },
        },
      });

      if (zoneEnCours) {
        zoneId = zoneEnCours.zoneId;
      }
    }

    // Créer l'immeuble avec la zone automatiquement assignée
    const immeuble = await this.prisma.immeuble.create({
      data: {
        adresse: data.adresse,
        latitude: data.latitude,
        longitude: data.longitude,
        nbEtages: data.nbEtages,
        nbPortesParEtage: data.nbPortesParEtage,
        ascenseurPresent: data.ascenseurPresent,
        digitalCode: data.digitalCode,
        commercialId: data.commercialId,
        managerId: data.managerId,
        zoneId, // Assigner automatiquement la zone du commercial ou manager
      },
    });

    // Créer automatiquement toutes les portes pour cet immeuble
    const portes: any[] = [];
    for (let etage = 1; etage <= data.nbEtages; etage++) {
      for (let porte = 1; porte <= data.nbPortesParEtage; porte++) {
        portes.push({
          numero: `${etage}${porte.toString().padStart(2, '0')}`,
          etage,
          immeubleId: immeuble.id,
          statut: 'NON_VISITE',
          nbRepassages: 0,
        });
      }
    }

    // Créer toutes les portes en une fois
    if (portes.length > 0) {
      await this.prisma.porte.createMany({
        data: portes,
      });
    }

    return immeuble;
  }

  async findAll(userId?: number, userRole?: string) {
    // Vérifier que les paramètres sont définis (userId peut être 0 pour les admins)
    if (userId === undefined || !userRole) {
      throw new ForbiddenException('UNAUTHORIZED');
    }

    // Filtrage selon le rôle
    const immeubleInclude = {
      include: {
        portes: {
          select: {
            id: true,
            statut: true,
          },
        },
      },
    };

    switch (userRole) {
      case 'admin':
        return this.prisma.immeuble.findMany(immeubleInclude);

      case 'directeur':
        // Immeubles des commerciaux du directeur
        return this.prisma.immeuble.findMany({
          where: {
            commercial: {
              directeurId: userId,
            },
          },
          ...immeubleInclude,
        });

      case 'manager':
        // Immeubles des commerciaux du manager ET ses propres immeubles
        return this.prisma.immeuble.findMany({
          where: {
            OR: [
              {
                commercial: {
                  managerId: userId,
                },
              },
              {
                managerId: userId,
              },
            ],
          },
          ...immeubleInclude,
        });

      case 'commercial':
        // Immeubles du commercial
        return this.prisma.immeuble.findMany({
          where: {
            commercialId: userId,
          },
          ...immeubleInclude,
        });

      default:
        return [];
    }
  }

  async findOne(id: number, userId: number, userRole: string) {
    await this.ensureImmeubleAccess(id, userId, userRole);

    return this.prisma.immeuble.findUnique({
      where: { id },
      include: {
        portes: {
          select: {
            id: true,
            statut: true,
            etage: true,
            numero: true,
            nbRepassages: true,
            rdvDate: true,
            rdvTime: true,
            commentaire: true,
            derniereVisite: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async update(
    data: UpdateImmeubleInput,
    userId: number,
    userRole: string,
  ) {
    const { id, ...updateData } = data;

    await this.ensureImmeubleAccess(id, userId, userRole);

    return this.prisma.immeuble.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: number, userId: number, userRole: string) {
    await this.ensureImmeubleAccess(id, userId, userRole);

    return this.prisma.immeuble.delete({
      where: { id },
    });
  }


  async addPorteToEtage(
    immeubleId: number,
    etage: number,
    userId: number,
    userRole: string,
  ) {
    const immeuble = await this.ensureImmeubleAccess(
      immeubleId,
      userId,
      userRole,
    );

    if (etage < 1 || etage > immeuble.nbEtages) {
      throw new Error('Invalid floor number');
    }

    // Trouver le prochain numéro de porte pour cet étage
    const portesEtage = await this.prisma.porte.findMany({
      where: {
        immeubleId,
        etage,
      },
      orderBy: {
        numero: 'desc',
      },
      take: 1,
    });

    let nouveauNumeroPorte = 1;
    if (portesEtage.length > 0) {
      // Extraire le numéro de porte depuis le format "etageXX"
      const dernierNumero = portesEtage[0].numero;
      const numeroPorte = parseInt(dernierNumero.substring(1));
      nouveauNumeroPorte = numeroPorte + 1;
    } else {
      // Premier ajout de porte à cet étage, utiliser le nombre actuel + 1
      nouveauNumeroPorte = immeuble.nbPortesParEtage + 1;
    }

    // Créer la nouvelle porte
    await this.prisma.porte.create({
      data: {
        numero: `${etage}${nouveauNumeroPorte.toString().padStart(2, '0')}`,
        etage,
        immeubleId,
        statut: 'NON_VISITE',
        nbRepassages: 0,
      },
    });

    return immeuble;
  }

  async removePorteFromEtage(
    immeubleId: number,
    etage: number,
    userId: number,
    userRole: string,
  ) {
    const immeuble = await this.ensureImmeubleAccess(
      immeubleId,
      userId,
      userRole,
    );

    if (etage < 1 || etage > immeuble.nbEtages) {
      throw new Error('Invalid floor number');
    }

    // Trouver la dernière porte de cet étage
    const portesEtage = await this.prisma.porte.findMany({
      where: {
        immeubleId,
        etage,
      },
      orderBy: {
        numero: 'desc',
      },
      take: 1,
    });

    if (portesEtage.length === 0) {
      throw new Error('No doors found on this floor');
    }

    // Vérifier qu'il reste au moins une porte sur l'étage
    const totalPortesEtage = await this.prisma.porte.count({
      where: {
        immeubleId,
        etage,
      },
    });

    if (totalPortesEtage <= 1) {
      throw new Error('Cannot remove the last door from this floor');
    }

    // Supprimer la dernière porte
    await this.prisma.porte.delete({
      where: {
        id: portesEtage[0].id,
      },
    });

    return immeuble;
  }


  async addEtage(
    immeubleId: number,
    userId: number,
    userRole: string,
  ) {
    const immeuble = await this.ensureImmeubleAccess(
      immeubleId,
      userId,
      userRole,
    );

    const nouvelEtage = immeuble.nbEtages + 1;

    // Mettre à jour le nombre d'étages
    const updatedImmeuble = await this.prisma.immeuble.update({
      where: { id: immeubleId },
      data: {
        nbEtages: nouvelEtage,
      },
    });

    // Créer toutes les portes pour le nouvel étage
    const nouvellesPortes: any[] = [];
    for (let porte = 1; porte <= immeuble.nbPortesParEtage; porte++) {
      nouvellesPortes.push({
        numero: `${nouvelEtage}${porte.toString().padStart(2, '0')}`,
        etage: nouvelEtage,
        immeubleId,
        statut: 'NON_VISITE',
        nbRepassages: 0,
      });
    }

    // Créer toutes les nouvelles portes
    if (nouvellesPortes.length > 0) {
      await this.prisma.porte.createMany({
        data: nouvellesPortes,
      });
    }

    return updatedImmeuble;
  }

  async removeEtage(
    immeubleId: number,
    userId: number,
    userRole: string,
  ) {
    const immeuble = await this.ensureImmeubleAccess(
      immeubleId,
      userId,
      userRole,
    );

    if (immeuble.nbEtages <= 1) {
      throw new Error('Cannot remove the last floor');
    }

    const etageASupprimer = immeuble.nbEtages;

    // Supprimer toutes les portes du dernier étage
    await this.prisma.porte.deleteMany({
      where: {
        immeubleId,
        etage: etageASupprimer,
      },
    });

    // Mettre à jour le nombre d'étages
    return this.prisma.immeuble.update({
      where: { id: immeubleId },
      data: {
        nbEtages: immeuble.nbEtages - 1,
      },
    });
  }
}
