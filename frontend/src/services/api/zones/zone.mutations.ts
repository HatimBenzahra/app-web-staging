/**
 * @fileoverview Zone related GraphQL mutations
 */

export const CREATE_ZONE = `
  mutation CreateZone($createZoneInput: CreateZoneInput!) {
    createZone(createZoneInput: $createZoneInput) {
      id
      nom
      xOrigin
      yOrigin
      rayon
      directeurId
      managerId
      createdAt
      updatedAt
    }
  }
`

export const UPDATE_ZONE = `
  mutation UpdateZone($updateZoneInput: UpdateZoneInput!) {
    updateZone(updateZoneInput: $updateZoneInput) {
      id
      nom
      xOrigin
      yOrigin
      rayon
      directeurId
      managerId
      createdAt
      updatedAt
    }
  }
`

export const REMOVE_ZONE = `
  mutation RemoveZone($id: Int!) {
    removeZone(id: $id) {
      id
      nom
      xOrigin
      yOrigin
      rayon
      createdAt
      updatedAt
    }
  }
`
