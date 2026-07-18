import { Prisma } from '@prisma/client';
import { UserStatus } from './user-status.enum';

/**
 * Prédicat Prisma pour ne conserver que les immeubles "production" (non-test).
 *
 * Un immeuble n'est visible que s'il a un propriétaire (commercial OU manager)
 * dont le statut n'est PAS `UTILISATEUR_TEST`. Une relation to-one nulle ne
 * matche jamais un filtre de relation : si `commercialId` ET `managerId` sont
 * tous les deux `null`, aucune branche du `OR` ne matche => l'immeuble est
 * exclu, conformément au comportement attendu.
 *
 * Réutilise exactement le même marqueur que
 * `StatisticService.productionUserWhere()` (statistic.service.ts).
 */
export const prodImmeubleWhere: Prisma.ImmeubleWhereInput = {
  OR: [
    { commercial: { status: { not: UserStatus.UTILISATEUR_TEST } } },
    { manager: { status: { not: UserStatus.UTILISATEUR_TEST } } },
  ],
};
