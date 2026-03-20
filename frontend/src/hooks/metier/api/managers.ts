/**
 * @fileoverview Hooks for Manager entity
 */

import { api } from '../../../services/api'
import type {
  Manager,
  CreateManagerInput,
  UpdateManagerInput,
} from '../../../types/api'
import {
  useApiCall,
  useApiMutation,
  UseApiState,
  UseApiListState,
  UseApiActions,
  UseApiMutation,
} from './core'

export function useManagers(): UseApiListState<Manager> & UseApiActions {
  return useApiCall(() => api.managers.getAll(), [], 'managers')
}

export function useManager(id: number): UseApiState<Manager> & UseApiActions {
  return useApiCall(() => api.managers.getById(id), [id], 'managers')
}

export function useManagerPersonal(id: number): UseApiState<Manager> & UseApiActions {
  return useApiCall(() => api.managers.getPersonalById(id), [id], 'managers-personal')
}

export function useManagerFull(id: number): UseApiState<Manager> & UseApiActions {
  return useApiCall(() => api.managers.getFullById(id), [id], 'managers-full')
}

export function useCreateManager(): UseApiMutation<CreateManagerInput, Manager> {
  return useApiMutation(api.managers.create, 'managers')
}

export function useUpdateManager(): UseApiMutation<UpdateManagerInput, Manager> {
  return useApiMutation(api.managers.update, 'managers')
}

export function useRemoveManager(): UseApiMutation<number, Manager> {
  return useApiMutation(api.managers.remove, 'managers')
}
