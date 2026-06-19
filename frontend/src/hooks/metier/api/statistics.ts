/**
 * @fileoverview Hooks for Statistic entity
 */

import { api } from '../../../services/api'
import type {
  Statistic,
  TimelinePoint,
  OwnerActivityStatistic,
  ZoneStatistic,
  TeamLastStatusActivity,
  CreateStatisticInput,
  UpdateStatisticInput,
} from '../../../types/api'
import {
  useApiCall,
  useApiMutation,
  UseApiState,
  UseApiListState,
  UseApiActions,
  UseApiMutation,
} from './core'

export function useStatistics(): UseApiListState<Statistic> & UseApiActions {
  return useApiCall(() => api.statistics.getAll(undefined), [], 'statistics')
}

export function useStatisticsByCommercial(
  commercialId: number
): UseApiListState<Statistic> & UseApiActions {
  return useApiCall(() => api.statistics.getAll(commercialId), [commercialId], 'statistics')
}

export function useStatisticsByZone(zoneId: number): UseApiListState<Statistic> & UseApiActions {
  const result = useApiCall(() => api.statistics.getAll(undefined), [], 'statistics')

  // Filtrer les statistiques par zoneId côté client
  const filteredData = result.data?.filter(stat => stat.zoneId === zoneId) || []

  return {
    ...result,
    data: filteredData,
  }
}

export function useZoneStatistics(): UseApiListState<ZoneStatistic> & UseApiActions {
  return useApiCall(() => api.statistics.getZoneStatistics(), [], 'zoneStatistics')
}

export function useTeamLastStatusActivities(): UseApiListState<TeamLastStatusActivity> &
  UseApiActions {
  return useApiCall(
    () => api.statistics.getTeamLastStatusActivities(),
    [],
    'teamLastStatusActivities'
  )
}

export function useStatsTimeline(filters = {}): UseApiListState<TimelinePoint> & UseApiActions {
  const key = JSON.stringify(filters)
  return useApiCall(() => api.statistics.getStatsTimeline(filters), [key], 'statsTimeline')
}

export function useStatsActivityByOwner(
  filters = {}
): UseApiListState<OwnerActivityStatistic> & UseApiActions {
  const key = JSON.stringify(filters)
  return useApiCall(
    () => api.statistics.getStatsActivityByOwner(filters),
    [key],
    'statsActivityByOwner'
  )
}

export function useStatistic(id: number): UseApiState<Statistic> & UseApiActions {
  return useApiCall(() => api.statistics.getById(id), [id], 'statistics')
}

export function useCreateStatistic(): UseApiMutation<CreateStatisticInput, Statistic> {
  return useApiMutation(api.statistics.create, 'statistics')
}

export function useUpdateStatistic(): UseApiMutation<UpdateStatisticInput, Statistic> {
  return useApiMutation(api.statistics.update, 'statistics')
}

export function useRemoveStatistic(): UseApiMutation<number, Statistic> {
  return useApiMutation(api.statistics.remove, 'statistics')
}
