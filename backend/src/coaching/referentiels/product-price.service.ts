import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { WinLeadPlusBinding } from './product-sheet.types';

/** Un tarif en vigueur, tel qu'il sera opposé au discours du commercial. */
export interface ProductPrice {
  label: string;
  price: number;
}

/**
 * Tarifs résolus depuis `Offre` (WinLead+) : un tarif change, une fiche non, et
 * sans eux la passe 2 confronte un prix annoncé au gabarit « XXXX € » du plan.
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
      // Sans tarif, la passe 2 ne peut pas trancher sur un montant.
      this.logger.warn(
        `Aucun tarif actif résolu pour ${JSON.stringify(binding)} — les montants ne seront pas jugeables`,
      );
    }
    return prices;
  }
}
