/**
 * @fileoverview Hooks for Commercial entity
 */

import { api } from '../../../services/api'
import type {
  Commercial,
  CreateCommercialInput,
  UpdateCommercialInput,
} from '../../../types/api'
import {
  useApiCall,
  useApiMutation,
  UseApiState,
  UseApiListState,
  UseApiActions,
  UseApiMutation,
} from './core'

export function useCommercials(): UseApiListState<Commercial> & UseApiActions {
  return useApiCall(() => api.commercials.getAll(), [], 'commercials')
}

export function useCommercial(id: number): UseApiState<Commercial> & UseApiActions {
  return useApiCall(() => api.commercials.getById(id), [id], 'commercials')
}

/**
 * Hook pour charger un commercial avec toutes ses relations (immeubles, zones, statistics)
 * Optimisé pour les pages de détails - charge plus de données que useCommercial
 */
export function useCommercialFull(id: number): UseApiState<Commercial> & UseApiActions {
  return useApiCall(() => api.commercials.getFullById(id), [id], 'commercials-full')
}

export function useCommercialTeamRanking(commercialId: number): UseApiState<{
  position: number
  total: number
  points: number
  trend?: string | null
  managerNom?: string | null
  managerPrenom?: string | null
  managerEmail?: string | null
  managerNumTel?: string | null
}> &
  UseApiActions {
  return useApiCall(
    () => {
      if (!commercialId || commercialId <= 0) {
        return Promise.resolve(null as any)
      }
      return api.commercials.getTeamRanking(commercialId)
    },
    [commercialId],
    'commercial-team-ranking'
  )
}

export function useCreateCommercial(): UseApiMutation<CreateCommercialInput, Commercial> {
  return useApiMutation(api.commercials.create, 'commercials')
}

export function useUpdateCommercial(): UseApiMutation<UpdateCommercialInput, Commercial> {
  return useApiMutation(api.commercials.update, 'commercials')
}

export function useRemoveCommercial(): UseApiMutation<number, Commercial> {
  return useApiMutation(api.commercials.remove, 'commercials')
}

export function useAssignZone(): UseApiMutation<{ commercialId: number; zoneId: number }, boolean> {
  return useApiMutation(
    ({ commercialId, zoneId }) => api.commercials.assignZone(commercialId, zoneId),
    'commercials'
  )
}

export function useUnassignZone(): UseApiMutation<
  { commercialId: number; zoneId: number },
  boolean
> {
  return useApiMutation(
    ({ commercialId, zoneId }) => api.commercials.unassignZone(commercialId, zoneId),
    'commercials'
  )
}
