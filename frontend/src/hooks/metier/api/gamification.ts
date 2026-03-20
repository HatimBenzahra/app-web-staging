/**
 * @fileoverview Hooks for Gamification entity
 */

import { gamificationApi } from '@/services/api/gamification'
import { useApiCall, useApiMutation } from './core'

// --- Ranking ---
export function useRanking(period: string, periodKey: string, includeContratFinie?: boolean) {
  return useApiCall(() => gamificationApi.getRanking(period, periodKey, includeContratFinie), [period, periodKey, includeContratFinie], 'ranking')
}

export function useCommercialRankings(commercialId: number) {
  return useApiCall(
    () => gamificationApi.getCommercialRankings(commercialId),
    [commercialId],
    'commercialRankings'
  )
}

export function useComputeRanking() {
  return useApiMutation(
    ({ period, periodKey }: { period: string; periodKey: string }) =>
      gamificationApi.computeRanking(period, periodKey),
    'ranking'
  )
}

// --- Offres ---
export function useGamificationOffres(activeOnly?: boolean) {
  return useApiCall(() => gamificationApi.getOffres(activeOnly), [activeOnly], 'gamificationOffres')
}

export function useSyncOffres() {
  return useApiMutation(() => gamificationApi.syncOffres(), 'gamificationOffres')
}

export function useUpdateOffrePoints() {
  return useApiMutation(
    ({ offreId, points }: { offreId: number; points: number }) =>
      gamificationApi.updateOffrePoints(offreId, points),
    'gamificationOffres'
  )
}

export function useUpdateOffreBadgeProductKey() {
  return useApiMutation(
    ({ offreId, badgeProductKey }: { offreId: number; badgeProductKey?: string }) =>
      gamificationApi.updateOffreBadgeProductKey(offreId, badgeProductKey),
    'gamificationOffres'
  )
}

// --- Badges ---
export function useBadgeDefinitions(category?: string, activeOnly?: boolean) {
  return useApiCall(
    () => gamificationApi.getBadgeDefinitions(category, activeOnly),
    [category, activeOnly],
    'badgeDefinitions'
  )
}

export function useCommercialBadges(commercialId: number) {
  return useApiCall(
    () => gamificationApi.getCommercialBadges(commercialId),
    [commercialId],
    'commercialBadges'
  )
}

export function useManagerBadges(managerId: number) {
  return useApiCall(
    () => gamificationApi.getManagerBadges(managerId),
    [managerId],
    'managerBadges'
  )
}

export function useSeedBadges() {
  return useApiMutation(() => gamificationApi.seedBadges(), 'badgeDefinitions')
}

export function useEvaluateBadges() {
  return useApiMutation(() => gamificationApi.evaluateBadges(), 'commercialBadges')
}

export function useEvaluateTrophees() {
  return useApiMutation(
    (quarter: string) => gamificationApi.evaluateTrophees(quarter),
    'commercialBadges'
  )
}

// --- Mapping ---
export function useWinleadPlusUsers() {
  return useApiCall(() => gamificationApi.getWinleadPlusUsers(), [], 'winleadPlusUsers')
}

export function useMappingSuggestions() {
  return useApiCall(() => gamificationApi.getMappingSuggestions(), [], 'mappingSuggestions')
}

export function useConfirmMapping() {
  return useApiMutation(
    (mappings: Array<{ prowinId: number; winleadPlusId: string; type: string }>) =>
      gamificationApi.confirmMapping(mappings),
    'mappingSuggestions'
  )
}

export function useRemoveMapping() {
  return useApiMutation(
    ({ prowinId, type }: { prowinId: number; type: string }) =>
      gamificationApi.removeMapping(prowinId, type),
    'mappingSuggestions'
  )
}

// --- Contrats ---
export function useSyncContrats() {
  return useApiMutation(() => gamificationApi.syncContrats(), 'contrats')
}

export function useContratsByCommercial(commercialId: number) {
  return useApiCall(
    () => gamificationApi.getContratsByCommercial(commercialId),
    [commercialId],
    'contrats'
  )
}

export function useContratsByManager(managerId: number) {
  return useApiCall(
    () => gamificationApi.getContratsByManager(managerId),
    [managerId],
    'contrats'
  )
}

export function useOffreDistribution(periodMonth: string) {
  return useApiCall(
    () => gamificationApi.getOffreDistribution(periodMonth),
    [periodMonth],
    'offreDistribution'
  )
}
