/**
 * @fileoverview Manager API Service
 */

import { gql } from '../../core/graphql'
import {
  GET_MANAGERS,
  GET_MANAGER,
  GET_MANAGER_PERSONAL,
  GET_MANAGER_FULL,
} from './manager.queries'
import {
  CREATE_MANAGER,
  UPDATE_MANAGER,
  REMOVE_MANAGER,
  ASSIGN_ZONE_TO_MANAGER,
} from './manager.mutations'
import type {
  Manager,
  QueryManagersResponse,
  QueryManagersVariables,
  QueryManagerResponse,
  GetEntityByIdVariables,
  QueryManagerPersonalResponse,
  QueryManagerFullResponse,
  CreateManagerVariables,
  MutationCreateManagerResponse,
  UpdateManagerVariables,
  MutationUpdateManagerResponse,
  MutationRemoveManagerResponse,
} from './manager.types'

export const managerApi = {
  async getAll(): Promise<Manager[]> {
    const response = await gql<QueryManagersResponse, QueryManagersVariables>(GET_MANAGERS, {})
    return response.managers
  },

  async getById(id: number): Promise<Manager> {
    const response = await gql<QueryManagerResponse, GetEntityByIdVariables>(GET_MANAGER, { id })
    return response.manager
  },

  async getPersonalById(id: number): Promise<Manager> {
    const response = await gql<QueryManagerPersonalResponse, GetEntityByIdVariables>(
      GET_MANAGER_PERSONAL,
      {
        id,
      }
    )
    if (!response.managerPersonal) {
      throw new Error('Manager introuvable')
    }
    return response.managerPersonal
  },

  async getFullById(id: number): Promise<Manager> {
    const response = await gql<QueryManagerFullResponse, GetEntityByIdVariables>(GET_MANAGER_FULL, {
      id,
    })
    if (!response.managerFull) {
      throw new Error('Manager introuvable')
    }
    return response.managerFull
  },

  async create(input: CreateManagerVariables['createManagerInput']): Promise<Manager> {
    const response = await gql<MutationCreateManagerResponse, CreateManagerVariables>(
      CREATE_MANAGER,
      { createManagerInput: input }
    )
    return response.createManager
  },

  async update(input: UpdateManagerVariables['updateManagerInput']): Promise<Manager> {
    const response = await gql<MutationUpdateManagerResponse, UpdateManagerVariables>(
      UPDATE_MANAGER,
      { updateManagerInput: input }
    )
    return response.updateManager
  },

  async remove(id: number): Promise<Manager> {
    const response = await gql<MutationRemoveManagerResponse, GetEntityByIdVariables>(
      REMOVE_MANAGER,
      { id }
    )
    return response.removeManager
  },

  async assignZone(managerId: number, zoneId: number): Promise<boolean> {
    const response = await gql<
      { assignZoneToManager: boolean },
      { managerId: number; zoneId: number }
    >(ASSIGN_ZONE_TO_MANAGER, { managerId, zoneId })
    return response.assignZoneToManager
  },
}
