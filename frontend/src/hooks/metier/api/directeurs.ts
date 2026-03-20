/**
 * @fileoverview Hooks for Directeur entity
 */

import { api } from '../../../services/api'
import type {
  Directeur,
  CreateDirecteurInput,
  UpdateDirecteurInput,
} from '../../../types/api'
import {
  useApiCall,
  useApiMutation,
  UseApiState,
  UseApiListState,
  UseApiActions,
  UseApiMutation,
} from './core'

export function useDirecteurs(): UseApiListState<Directeur> & UseApiActions {
  return useApiCall(() => api.directeurs.getAll(), [], 'directeurs')
}

export function useDirecteur(id: number): UseApiState<Directeur> & UseApiActions {
  return useApiCall(() => api.directeurs.getById(id), [id], 'directeurs')
}

export function useCreateDirecteur(): UseApiMutation<CreateDirecteurInput, Directeur> {
  return useApiMutation(api.directeurs.create, 'directeurs')
}

export function useUpdateDirecteur(): UseApiMutation<UpdateDirecteurInput, Directeur> {
  return useApiMutation(api.directeurs.update, 'directeurs')
}

export function useRemoveDirecteur(): UseApiMutation<number, Directeur> {
  return useApiMutation(api.directeurs.remove, 'directeurs')
}
