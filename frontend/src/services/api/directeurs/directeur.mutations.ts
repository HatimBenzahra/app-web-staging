/**
 * @fileoverview Directeur related GraphQL mutations
 */

export const CREATE_DIRECTEUR = `
  mutation CreateDirecteur($createDirecteurInput: CreateDirecteurInput!) {
    createDirecteur(createDirecteurInput: $createDirecteurInput) {
      id
      nom
      prenom
      email
      numTelephone
      adresse
      status
      createdAt
      updatedAt
    }
  }
`

export const UPDATE_DIRECTEUR = `
  mutation UpdateDirecteur($updateDirecteurInput: UpdateDirecteurInput!) {
    updateDirecteur(updateDirecteurInput: $updateDirecteurInput) {
      id
      nom
      prenom
      email
      numTelephone
      adresse
      status
      createdAt
      updatedAt
    }
  }
`

export const REMOVE_DIRECTEUR = `
  mutation RemoveDirecteur($id: Int!) {
    removeDirecteur(id: $id) {
      id
      nom
      prenom
      email
      numTelephone
      adresse
      status
      createdAt
      updatedAt
    }
  }
`

export const ASSIGN_ZONE_TO_DIRECTEUR = `
  mutation AssignZoneToDirecteur($directeurId: Int!, $zoneId: Int!) {
    assignZoneToDirecteur(directeurId: $directeurId, zoneId: $zoneId)
  }
`
