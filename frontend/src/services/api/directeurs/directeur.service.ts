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
}
