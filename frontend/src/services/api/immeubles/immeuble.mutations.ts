/**
 * @fileoverview Immeuble related GraphQL mutations
 */

export const CREATE_IMMEUBLE = `
  mutation CreateImmeuble($createImmeubleInput: CreateImmeubleInput!) {
    createImmeuble(createImmeubleInput: $createImmeubleInput) {
      id
      adresse
      latitude
      longitude
      nbEtages
      nbPortesParEtage
      ascenseurPresent
      digitalCode
      commercialId
      createdAt
      updatedAt
    }
  }
`

export const UPDATE_IMMEUBLE = `
  mutation UpdateImmeuble($updateImmeubleInput: UpdateImmeubleInput!) {
    updateImmeuble(updateImmeubleInput: $updateImmeubleInput) {
      id
      adresse
      nbEtages
      nbPortesParEtage
      ascenseurPresent
      digitalCode
      commercialId
      createdAt
      updatedAt
    }
  }
`

export const REMOVE_IMMEUBLE = `
  mutation RemoveImmeuble($id: Int!) {
    removeImmeuble(id: $id) {
      id
      adresse
      nbEtages
      nbPortesParEtage
      commercialId
      createdAt
      updatedAt
    }
  }
`

export const ADD_ETAGE_TO_IMMEUBLE = `
  mutation AddEtageToImmeuble($id: Int!) {
    addEtageToImmeuble(id: $id) {
      id
      adresse
      nbEtages
      nbPortesParEtage
    }
  }
`

export const REMOVE_ETAGE_FROM_IMMEUBLE = `
  mutation RemoveEtageFromImmeuble($id: Int!) {
    removeEtageFromImmeuble(id: $id) {
      id
      adresse
      nbEtages
      nbPortesParEtage
    }
  }
`

export const ADD_PORTE_TO_ETAGE = `
  mutation AddPorteToEtage($immeubleId: Int!, $etage: Int!) {
    addPorteToEtage(immeubleId: $immeubleId, etage: $etage) {
      id
      adresse
      nbEtages
      nbPortesParEtage
    }
  }
`

export const REMOVE_PORTE_FROM_ETAGE = `
  mutation RemovePorteFromEtage($immeubleId: Int!, $etage: Int!) {
    removePorteFromEtage(immeubleId: $immeubleId, etage: $etage) {
      id
      adresse
      nbEtages
      nbPortesParEtage
    }
  }
`
