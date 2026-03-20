/**
 * @fileoverview Immeuble API Service
 */

import { gql } from '../../core/graphql'
import {
  GET_IMMEUBLES,
  GET_IMMEUBLE,
} from './immeuble.queries'
import {
  CREATE_IMMEUBLE,
  UPDATE_IMMEUBLE,
  REMOVE_IMMEUBLE,
  ADD_ETAGE_TO_IMMEUBLE,
  REMOVE_ETAGE_FROM_IMMEUBLE,
  ADD_PORTE_TO_ETAGE,
  REMOVE_PORTE_FROM_ETAGE,
} from './immeuble.mutations'
import type {
  Immeuble,
  QueryImmeublesResponse,
  QueryImmeubleResponse,
  CreateImmeubleVariables,
  MutationCreateImmeubleResponse,
  UpdateImmeubleVariables,
  MutationUpdateImmeubleResponse,
  MutationRemoveImmeubleResponse,
  GetEntityByIdVariables,
} from './immeuble.types'

export const immeubleApi = {
  async getAll(): Promise<Immeuble[]> {
    const response = await gql<QueryImmeublesResponse, {}>(GET_IMMEUBLES, {})
    return response.immeubles
  },

  async getById(id: number): Promise<Immeuble> {
    const response = await gql<QueryImmeubleResponse, GetEntityByIdVariables>(GET_IMMEUBLE, { id })
    return response.immeuble
  },

  async create(input: CreateImmeubleVariables['createImmeubleInput']): Promise<Immeuble> {
    const response = await gql<MutationCreateImmeubleResponse, CreateImmeubleVariables>(
      CREATE_IMMEUBLE,
      { createImmeubleInput: input }
    )
    return response.createImmeuble
  },

  async update(input: UpdateImmeubleVariables['updateImmeubleInput']): Promise<Immeuble> {
    const response = await gql<MutationUpdateImmeubleResponse, UpdateImmeubleVariables>(
      UPDATE_IMMEUBLE,
      { updateImmeubleInput: input }
    )
    return response.updateImmeuble
  },

  async remove(id: number): Promise<Immeuble> {
    const response = await gql<MutationRemoveImmeubleResponse, GetEntityByIdVariables>(
      REMOVE_IMMEUBLE,
      { id }
    )
    return response.removeImmeuble
  },

  async addEtage(id: number): Promise<Immeuble> {
    const response = await gql<{ addEtageToImmeuble: Immeuble }, GetEntityByIdVariables>(
      ADD_ETAGE_TO_IMMEUBLE,
      { id }
    )
    return response.addEtageToImmeuble
  },

  async removeEtage(id: number): Promise<Immeuble> {
    const response = await gql<{ removeEtageFromImmeuble: Immeuble }, GetEntityByIdVariables>(
      REMOVE_ETAGE_FROM_IMMEUBLE,
      { id }
    )
    return response.removeEtageFromImmeuble
  },

  async addPorteToEtage(immeubleId: number, etage: number): Promise<Immeuble> {
    const response = await gql<
      { addPorteToEtage: Immeuble },
      { immeubleId: number; etage: number }
    >(ADD_PORTE_TO_ETAGE, { immeubleId, etage })
    return response.addPorteToEtage
  },

  async removePorteFromEtage(immeubleId: number, etage: number): Promise<Immeuble> {
    const response = await gql<
      { removePorteFromEtage: Immeuble },
      { immeubleId: number; etage: number }
    >(REMOVE_PORTE_FROM_ETAGE, { immeubleId, etage })
    return response.removePorteFromEtage
  },
}
