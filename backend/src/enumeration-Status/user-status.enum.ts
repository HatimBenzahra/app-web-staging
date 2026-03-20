import { registerEnumType } from '@nestjs/graphql'

export enum UserStatus {
  ACTIF = 'ACTIF',
  CONTRAT_FINIE = 'CONTRAT_FINIE',
  UTILISATEUR_TEST = 'UTILISATEUR_TEST',
}

registerEnumType(UserStatus, {
  name: 'UserStatus',
  description: 'Statut d’un utilisateur (commercial, manager ou directeur)',
})
