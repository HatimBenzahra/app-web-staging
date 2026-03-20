/**
 * @fileoverview Commercial API Service
 */

import { gql } from '../../core/graphql'
import {
  GET_COMMERCIALS,
  GET_COMMERCIAL,
  GET_COMMERCIAL_FULL,
  GET_COMMERCIAL_TEAM_RANKING,
} from './commercial.queries'
import {
  CREATE_COMMERCIAL,
  UPDATE_COMMERCIAL,
  REMOVE_COMMERCIAL,
  ASSIGN_ZONE_TO_COMMERCIAL,
  UNASSIGN_ZONE_FROM_COMMERCIAL,
} from './commercial.mutations'
import type {
  Commercial,
  QueryCommercialsResponse,
  QueryCommercialResponse,
  CreateCommercialVariables,
  MutationCreateCommercialResponse,
  UpdateCommercialVariables,
  MutationUpdateCommercialResponse,
  GetEntityByIdVariables,
  MutationRemoveCommercialResponse,
  AssignZoneVariables,
  MutationAssignZoneResponse,
  UnassignZoneVariables,
  MutationUnassignZoneResponse,
} from './commercial.types'

export const commercialApi = {
  async getAll(): Promise<Commercial[]> {
    const response = await gql<QueryCommercialsResponse, {}>(GET_COMMERCIALS, {})
    return response.commercials
  },

  async getById(id: number): Promise<Commercial> {
    const response = await gql<QueryCommercialResponse, GetEntityByIdVariables>(GET_COMMERCIAL, {
      id,
    })
    return response.commercial
  },

  /**
   * Charge un commercial avec toutes ses relations (immeubles, zones, statistics)
   * Utilisé pour la page de détails
   */
  async getFullById(id: number): Promise<Commercial> {
    const response = await gql<QueryCommercialResponse, GetEntityByIdVariables>(
      GET_COMMERCIAL_FULL,
      { id }
    )
    return response.commercial
  },

  async create(input: CreateCommercialVariables['createCommercialInput']): Promise<Commercial> {
    const response = await gql<MutationCreateCommercialResponse, CreateCommercialVariables>(
      CREATE_COMMERCIAL,
      { createCommercialInput: input }
    )
    return response.createCommercial
  },

  async update(input: UpdateCommercialVariables['updateCommercialInput']): Promise<Commercial> {
    const response = await gql<MutationUpdateCommercialResponse, UpdateCommercialVariables>(
      UPDATE_COMMERCIAL,
      { updateCommercialInput: input }
    )
    return response.updateCommercial
  },

  async remove(id: number): Promise<Commercial> {
    const response = await gql<MutationRemoveCommercialResponse, GetEntityByIdVariables>(
      REMOVE_COMMERCIAL,
      { id }
    )
    return response.removeCommercial
  },

  async getTeamRanking(commercialId: number): Promise<{
    position: number
    total: number
    points: number
    trend?: string | null
    managerNom?: string | null
    managerPrenom?: string | null
    managerEmail?: string | null
    managerNumTel?: string | null
  }> {
    const response = await gql<
      {
        commercialTeamRanking: {
          position: number
          total: number
          points: number
          trend?: string | null
          managerNom?: string | null
          managerPrenom?: string | null
          managerEmail?: string | null
          managerNumTel?: string | null
        }
      },
      { commercialId: number }
    >(GET_COMMERCIAL_TEAM_RANKING, { commercialId })
    return response.commercialTeamRanking
  },

  async assignZone(commercialId: number, zoneId: number): Promise<boolean> {
    const response = await gql<MutationAssignZoneResponse, AssignZoneVariables>(
      ASSIGN_ZONE_TO_COMMERCIAL,
      { commercialId, zoneId }
    )
    return response.assignZoneToCommercial
  },

  async unassignZone(commercialId: number, zoneId: number): Promise<boolean> {
    const response = await gql<MutationUnassignZoneResponse, UnassignZoneVariables>(
      UNASSIGN_ZONE_FROM_COMMERCIAL,
      { commercialId, zoneId }
    )
    return response.unassignZoneFromCommercial
  },
}
