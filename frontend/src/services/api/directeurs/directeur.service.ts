/**
 * @fileoverview Directeur API Service
 */

import { gql } from '../../core/graphql'
import {
  GET_DIRECTEURS,
  GET_DIRECTEUR,
} from './directeur.queries'
import {
  CREATE_DIRECTEUR,
  UPDATE_DIRECTEUR,
  REMOVE_DIRECTEUR,
  ASSIGN_ZONE_TO_DIRECTEUR,
} from './directeur.mutations'
import type {
  Directeur,
  QueryDirecteursResponse,
  QueryDirecteursVariables,
  QueryDirecteurResponse,
  GetEntityByIdVariables,
  CreateDirecteurVariables,
  MutationCreateDirecteurResponse,
  UpdateDirecteurVariables,
  MutationUpdateDirecteurResponse,
  MutationRemoveDirecteurResponse,
} from './directeur.types'

export const directeurApi = {
  async getAll(): Promise<Directeur[]> {
    const response = await gql<QueryDirecteursResponse, QueryDirecteursVariables>(
      GET_DIRECTEURS,
      {}
    )
    return response.directeurs
  },

  async getById(id: number): Promise<Directeur> {
    const response = await gql<QueryDirecteurResponse, GetEntityByIdVariables>(GET_DIRECTEUR, {
      id,
    })
    return response.directeur
  },

  async create(input: CreateDirecteurVariables['createDirecteurInput']): Promise<Directeur> {
    const response = await gql<MutationCreateDirecteurResponse, CreateDirecteurVariables>(
      CREATE_DIRECTEUR,
      { createDirecteurInput: input }
    )
    return response.createDirecteur
  },

  async update(input: UpdateDirecteurVariables['updateDirecteurInput']): Promise<Directeur> {
    const response = await gql<MutationUpdateDirecteurResponse, UpdateDirecteurVariables>(
      UPDATE_DIRECTEUR,
      { updateDirecteurInput: input }
    )
    return response.updateDirecteur
  },

  async remove(id: number): Promise<Directeur> {
    const response = await gql<MutationRemoveDirecteurResponse, GetEntityByIdVariables>(
      REMOVE_DIRECTEUR,
      { id }
    )
    return response.removeDirecteur
  },

  async assignZone(directeurId: number, zoneId: number): Promise<boolean> {
    const response = await gql<
      { assignZoneToDirecteur: boolean },
      { directeurId: number; zoneId: number }
    >(ASSIGN_ZONE_TO_DIRECTEUR, { directeurId, zoneId })
    return response.assignZoneToDirecteur
  },
}
