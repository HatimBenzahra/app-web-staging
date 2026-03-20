/**
 * @fileoverview Porte related GraphQL mutations
 */

export const CREATE_PORTE = `
  mutation CreatePorte($createPorteInput: CreatePorteInput!) {
    createPorte(createPorteInput: $createPorteInput) {
      id
      numero
      nomPersonnalise
      etage
      immeubleId
      statut
      nbRepassages
      nbContrats
      rdvDate
      rdvTime
      commentaire
      derniereVisite
      createdAt
      updatedAt
    }
  }
`

export const UPDATE_PORTE = `
  mutation UpdatePorte($updatePorteInput: UpdatePorteInput!) {
    updatePorte(updatePorteInput: $updatePorteInput) {
      id
      numero
      nomPersonnalise
      etage
      immeubleId
      statut
      nbRepassages
      nbContrats
      rdvDate
      rdvTime
      commentaire
      derniereVisite
      createdAt
      updatedAt
    }
  }
`

export const REMOVE_PORTE = `
  mutation RemovePorte($id: Int!) {
    removePorte(id: $id) {
      id
      numero
      nomPersonnalise
      etage
      immeubleId
      statut
      nbRepassages
      nbContrats
      rdvDate
      rdvTime
      commentaire
      derniereVisite
      createdAt
      updatedAt
    }
  }
`
