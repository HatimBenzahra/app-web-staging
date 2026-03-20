/**
 * @fileoverview Manager related GraphQL mutations
 */

export const CREATE_MANAGER = `
  mutation CreateManager($createManagerInput: CreateManagerInput!) {
    createManager(createManagerInput: $createManagerInput) {
      id
      nom
      prenom
      email
      numTelephone
      directeurId
      status
      createdAt
      updatedAt
    }
  }
`

export const UPDATE_MANAGER = `
  mutation UpdateManager($updateManagerInput: UpdateManagerInput!) {
    updateManager(updateManagerInput: $updateManagerInput) {
      id
      nom
      prenom
      email
      numTelephone
      directeurId
      status
      createdAt
      updatedAt
    }
  }
`

export const REMOVE_MANAGER = `
  mutation RemoveManager($id: Int!) {
    removeManager(id: $id) {
      id
      nom
      prenom
      email
      numTelephone
      directeurId
      status
      createdAt
      updatedAt
    }
  }
`

export const ASSIGN_ZONE_TO_MANAGER = `
  mutation AssignZoneToManager($managerId: Int!, $zoneId: Int!) {
    assignZoneToManager(managerId: $managerId, zoneId: $zoneId)
  }
`
