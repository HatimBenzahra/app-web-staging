/**
 * @fileoverview Immeuble related GraphQL queries
 */

export const GET_IMMEUBLES = `
  query GetImmeubles {
    immeubles {
      id
      adresse
      latitude
      longitude
      nbEtages
      nbPortesParEtage
      ascenseurPresent
      digitalCode
      commercialId
      managerId
      portes {
        id
        statut
      }
      createdAt
      updatedAt
    }
  }
`

export const GET_IMMEUBLE = `
  query GetImmeuble($id: Int!) {
    immeuble(id: $id) {
      id
      adresse
      latitude
      longitude
      nbEtages
      nbPortesParEtage
      ascenseurPresent
      digitalCode
      commercialId
      managerId
      createdAt
      updatedAt
    }
  }
`
