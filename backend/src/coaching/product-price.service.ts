import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WinLeadPlusBinding } from './product-sheet.types';

/** Un tarif en vigueur, tel qu'il sera opposé au discours du commercial. */
export interface ProductPrice {
  label: string;
  price: number;
}

/**
 * Résout les tarifs d'un produit depuis la table `Offre` (synchronisée WinLead+).
 *
 * Aucune fiche ne contient de prix en dur : un tarif change, une fiche non. Le
 * rattachement se fait par `winleadplus` — soit des `externalIds` explicites,
 * soit un fournisseur.
 *
 * Pourquoi c'est indispensable au jugement : le plan de vente écrit ses montants
 * en gabarit (« vous passerez à XXXX €/mois »), puisqu'ils dépendent du forfait
 * choisi. Sans les tarifs réels, un modèle confronte un prix annoncé à un texte à
 * trous et conclut à l'écart. Vu en production : « quatorze euros quatre-vingt-dix »
 * signalé comme une erreur, alors que c'est le tarif exact du forfait 100 Go.
 */
@Injectable()
export class ProductPriceService {
  private readonly logger = new Logger(ProductPriceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolve(binding?: WinLeadPlusBinding): Promise<ProductPrice[]> {
    if (!binding) return [];

    const where = binding.externalIds?.length
      ? { externalId: { in: binding.externalIds }, isActive: true }
      : binding.match?.fournisseur
        ? { fournisseur: binding.match.fournisseur, isActive: true }
        : null;

    if (!where) return [];

    const offres = await this.prisma.offre.findMany({
      where,
      select: { nom: true, prixBase: true },
      orderBy: { prixBase: 'asc' },
    });

    const prices = offres
      .filter((o): o is { nom: string; prixBase: number } => o.prixBase != null)
      .map((o) => ({ label: o.nom, price: o.prixBase }));

    if (prices.length === 0) {
      // Sans tarif, la passe 2 ne pourra pas trancher sur un montant. Mieux vaut
      // le dire que de laisser le modèle inventer une référence.
      this.logger.warn(
        `Aucun tarif actif résolu pour ${JSON.stringify(binding)} — les montants ne seront pas jugeables`,
      );
    }
    return prices;
  }
}
