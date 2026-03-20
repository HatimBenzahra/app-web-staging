/**
 * @fileoverview Directeur related GraphQL queries
 */

export const GET_DIRECTEURS = `
  query GetDirecteurs {
    directeurs {
      id
      nom
      prenom
      email
      numTelephone
      adresse
      status
      createdAt
      updatedAt
      statistics {
        id
        directeurId
        contratsSignes
        immeublesVisites
        rendezVousPris
        refus
        nbImmeublesProspectes
        nbPortesProspectes
        createdAt
        updatedAt
      }
    }
  }
`

export const GET_DIRECTEUR = `
  query GetDirecteur($id: Int!) {
    directeur(id: $id) {
      id
      nom
      prenom
      email
      numTelephone
      adresse
      status
      createdAt
      updatedAt
      statistics {
        id
        directeurId
        contratsSignes
        immeublesVisites
        rendezVousPris
        refus
        nbImmeublesProspectes
        nbPortesProspectes
        createdAt
        updatedAt
      }
    }
  }
`
