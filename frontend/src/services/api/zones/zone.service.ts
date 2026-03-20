/**
 * @fileoverview Zone API Service
 */

import { gql } from '../../core/graphql'
import {
  GET_ZONES,
  GET_ZONE,
  GET_CURRENT_USER_ASSIGNMENT,
  GET_ALL_ZONE_HISTORY,
  GET_ALL_CURRENT_ASSIGNMENTS,
  GET_ZONE_CURRENT_ASSIGNMENTS,
} from './zone.queries'
import {
  CREATE_ZONE,
  UPDATE_ZONE,
  REMOVE_ZONE,
} from './zone.mutations'
import { ASSIGN_ZONE_TO_DIRECTEUR as ASSIGN_TO_DIRECTEUR_MUTATION } from '../directeurs/directeur.mutations'
import { ASSIGN_ZONE_TO_MANAGER as ASSIGN_TO_MANAGER_MUTATION } from '../managers/manager.mutations'

import type {
  Zone,
  QueryZonesResponse,
  QueryZoneResponse,
  CreateZoneVariables,
  MutationCreateZoneResponse,
  UpdateZoneVariables,
  MutationUpdateZoneResponse,
  MutationRemoveZoneResponse,
  GetEntityByIdVariables,
} from './zone.types'

export const zoneApi = {
  async getAll(): Promise<Zone[]> {
    const response = await gql<QueryZonesResponse, {}>(GET_ZONES, {})
    return response.zones
  },

  async getById(id: number): Promise<Zone> {
    const response = await gql<QueryZoneResponse, GetEntityByIdVariables>(GET_ZONE, { id })
    return response.zone
  },

  async create(input: CreateZoneVariables['createZoneInput']): Promise<Zone> {
    const response = await gql<MutationCreateZoneResponse, CreateZoneVariables>(CREATE_ZONE, {
      createZoneInput: input,
    })
    return response.createZone
  },

  async update(input: UpdateZoneVariables['updateZoneInput']): Promise<Zone> {
    const response = await gql<MutationUpdateZoneResponse, UpdateZoneVariables>(UPDATE_ZONE, {
      updateZoneInput: input,
    })
    return response.updateZone
  },

  async remove(id: number): Promise<Zone> {
    const response = await gql<MutationRemoveZoneResponse, GetEntityByIdVariables>(REMOVE_ZONE, {
      id,
    })
    return response.removeZone
  },

  async assignToDirecteur(directeurId: number, zoneId: number): Promise<boolean> {
    const response = await gql<
      { assignZoneToDirecteur: boolean },
      { directeurId: number; zoneId: number }
    >(ASSIGN_TO_DIRECTEUR_MUTATION, { directeurId, zoneId })
    return response.assignZoneToDirecteur
  },

  async assignToManager(managerId: number, zoneId: number): Promise<boolean> {
    const response = await gql<
      { assignZoneToManager: boolean },
      { managerId: number; zoneId: number }
    >(ASSIGN_TO_MANAGER_MUTATION, { managerId, zoneId })
    return response.assignZoneToManager
  },

  async getCurrentUserAssignment(userId: number, userType: string): Promise<any> {
    const response = await gql<any, { userId: number; userType: string }>(
      GET_CURRENT_USER_ASSIGNMENT,
      { userId, userType }
    )
    return response.currentUserAssignment
  },

  async getAllZoneHistory(): Promise<any[]> {
    const response = await gql<any, {}>(GET_ALL_ZONE_HISTORY, {})
    return response.allZoneHistory
  },

  async getAllCurrentAssignments(): Promise<any[]> {
    const response = await gql<any, {}>(GET_ALL_CURRENT_ASSIGNMENTS, {})
    return response.allCurrentAssignments
  },

  async getZoneCurrentAssignments(zoneId: number): Promise<any[]> {
    const response = await gql<any, { zoneId: number }>(GET_ZONE_CURRENT_ASSIGNMENTS, { zoneId })
    return response.zoneCurrentAssignments
  },
}
