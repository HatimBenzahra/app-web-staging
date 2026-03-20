/**
 * @fileoverview Hooks for Zone entity
 */

import { api } from '../../../services/api'
import type {
  Zone,
  CreateZoneInput,
  UpdateZoneInput,
} from '../../../types/api'
import {
  useApiCall,
  useApiMutation,
  UseApiState,
  UseApiListState,
  UseApiActions,
  UseApiMutation,
} from './core'

export function useZones(): UseApiListState<Zone> & UseApiActions {
  return useApiCall(() => api.zones.getAll(), [], 'zones')
}

export function useZone(id: number): UseApiState<Zone> & UseApiActions {
  return useApiCall(() => api.zones.getById(id), [id], 'zones')
}

export function useCreateZone(): UseApiMutation<CreateZoneInput, Zone> {
  return useApiMutation(api.zones.create, 'zones')
}

export function useUpdateZone(): UseApiMutation<UpdateZoneInput, Zone> {
  return useApiMutation(api.zones.update, 'zones')
}

export function useRemoveZone(): UseApiMutation<number, Zone> {
  return useApiMutation(api.zones.remove, 'zones')
}

export function useAssignZoneToDirecteur(): UseApiMutation<
  { directeurId: number; zoneId: number },
  boolean
> {
  return useApiMutation(
    ({ directeurId, zoneId }) => api.zones.assignToDirecteur(directeurId, zoneId),
    'zones'
  )
}

export function useAssignZoneToManager(): UseApiMutation<
  { managerId: number; zoneId: number },
  boolean
> {
  return useApiMutation(
    ({ managerId, zoneId }) => api.zones.assignToManager(managerId, zoneId),
    'zones'
  )
}

export function useCurrentZoneAssignment(
  userId: number,
  userType: string
): UseApiState<any> & UseApiActions {
  return useApiCall(
    () => api.zones.getCurrentUserAssignment(userId, userType),
    [userId, userType],
    'currentZoneAssignment'
  )
}

export function useAllZoneHistory(): UseApiListState<any> & UseApiActions {
  return useApiCall(() => api.zones.getAllZoneHistory(), [], 'allZoneHistory')
}

export function useAllCurrentAssignments(): UseApiListState<any> & UseApiActions {
  return useApiCall(() => api.zones.getAllCurrentAssignments(), [], 'allCurrentAssignments')
}

export function useZoneCurrentAssignments(zoneId: number): UseApiListState<any> & UseApiActions {
  return useApiCall(
    () => api.zones.getZoneCurrentAssignments(zoneId),
    [zoneId],
    'zoneCurrentAssignments'
  )
}

export function useCurrentUserAssignment(
  userId: number,
  userType: 'COMMERCIAL' | 'MANAGER' | 'DIRECTEUR'
): UseApiState<any> & UseApiActions {
  return useApiCall(
    () => {
      // Skip l'appel API si userId est invalide (null, NaN, ou <= 0)
      if (!userId || isNaN(userId) || userId <= 0) {
        return Promise.resolve(null) as any
      }
      return api.zones.getCurrentUserAssignment(userId, userType)
    },
    [userId, userType],
    `current-zone-assignment-${userId}-${userType}`
  )
}
