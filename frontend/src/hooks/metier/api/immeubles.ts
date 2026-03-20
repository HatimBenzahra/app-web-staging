/**
 * @fileoverview Hooks for Immeuble entity
 */

import { api } from '../../../services/api'
import type {
  Immeuble,
  CreateImmeubleInput,
  UpdateImmeubleInput,
} from '../../../types/api'
import {
  useApiCall,
  useApiMutation,
  UseApiState,
  UseApiListState,
  UseApiActions,
  UseApiMutation,
} from './core'

export function useImmeubles(): UseApiListState<Immeuble> & UseApiActions {
  return useApiCall(() => api.immeubles.getAll(), [], 'immeubles')
}

export function useImmeuble(id: number): UseApiState<Immeuble> & UseApiActions {
  return useApiCall(() => api.immeubles.getById(id), [id], 'immeubles')
}

export function useCreateImmeuble(): UseApiMutation<CreateImmeubleInput, Immeuble> {
  return useApiMutation(api.immeubles.create, 'immeubles')
}

export function useUpdateImmeuble(): UseApiMutation<UpdateImmeubleInput, Immeuble> {
  return useApiMutation(api.immeubles.update, 'immeubles')
}

export function useRemoveImmeuble(): UseApiMutation<number, Immeuble> {
  return useApiMutation(api.immeubles.remove, 'immeubles')
}

export function useAddEtageToImmeuble(): UseApiMutation<number, Immeuble> {
  return useApiMutation(api.immeubles.addEtage, 'immeubles')
}

export function useRemoveEtageFromImmeuble(): UseApiMutation<number, Immeuble> {
  return useApiMutation(api.immeubles.removeEtage, 'immeubles')
}

export function useAddPorteToEtage(): UseApiMutation<
  { immeubleId: number; etage: number },
  Immeuble
> {
  return useApiMutation(
    ({ immeubleId, etage }) => api.immeubles.addPorteToEtage(immeubleId, etage),
    'immeubles'
  )
}

export function useRemovePorteFromEtage(): UseApiMutation<
  { immeubleId: number; etage: number },
  Immeuble
> {
  return useApiMutation(
    ({ immeubleId, etage }) => api.immeubles.removePorteFromEtage(immeubleId, etage),
    'immeubles'
  )
}
