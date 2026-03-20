/**
 * @fileoverview React Query hooks for API data fetching
 * Hooks optimisés avec React Query pour éviter les refetch complets
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useErrorToast } from '@/hooks/utils/ui/use-error-toast'
import type {
  Manager,
  Commercial,
  UpdateManagerInput,
  UpdateCommercialInput,
} from '@/types/api'

// =============================================================================
// Query Keys - Clés de cache pour React Query
// =============================================================================

const queryKeys = {
  directeurs: () => ['api', 'directeurs'] as const,
  managers: () => ['api', 'managers'] as const,
  commercials: () => ['api', 'commercials'] as const,
}

// =============================================================================
// Directeur Hooks
// =============================================================================

export function useDirecteursQuery() {
  return useQuery({
    queryKey: queryKeys.directeurs(),
    queryFn: () => api.directeurs.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// =============================================================================
// Manager Hooks
// =============================================================================

export function useManagersQuery() {
  return useQuery({
    queryKey: queryKeys.managers(),
    queryFn: () => api.managers.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useUpdateManagerMutation() {
  const queryClient = useQueryClient()
  const { showError } = useErrorToast()

  return useMutation({
    mutationFn: (input: UpdateManagerInput) => api.managers.update(input),
    onMutate: async variables => {
      // Annuler les refetch en cours
      await queryClient.cancelQueries({ queryKey: queryKeys.managers() })

      // Snapshot de l'état actuel pour rollback
      const previousManagers = queryClient.getQueriesData({ queryKey: queryKeys.managers() })

      // Mise à jour optimiste - met à jour le cache immédiatement
      queryClient.setQueriesData<Manager[]>({ queryKey: queryKeys.managers() }, old => {
        if (!old) return old
        return old.map(manager => {
          if (manager.id === variables.id) {
            // Fusionner les données en s'assurant que les types correspondent
            return {
              ...manager,
              ...variables,
              // Normaliser numTelephone en string si c'est un number
              numTelephone: variables.numTelephone
                ? String(variables.numTelephone)
                : manager.numTelephone,
            } as Manager
          }
          return manager
        })
      })

      // Retourner le contexte pour rollback en cas d'erreur
      return { previousManagers }
    },
    onError: (error, variables, context) => {
      // Rollback en cas d'erreur
      if (context?.previousManagers) {
        context.previousManagers.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      showError(error, 'useUpdateManagerMutation')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.managers() })
    },
  })
}

// =============================================================================
// Commercial Hooks
// =============================================================================

export function useCommercialsQuery() {
  return useQuery({
    queryKey: queryKeys.commercials(),
    queryFn: () => api.commercials.getAll(),
    staleTime: 3 * 60 * 1000, // 3 minutes - plus volatile
  })
}

export function useUpdateCommercialMutation() {
  const queryClient = useQueryClient()
  const { showError } = useErrorToast()

  return useMutation({
    mutationFn: (input: UpdateCommercialInput) => api.commercials.update(input),
    onMutate: async variables => {
      // Annuler les refetch en cours
      await queryClient.cancelQueries({ queryKey: queryKeys.commercials() })

      // Snapshot de l'état actuel pour rollback
      const previousCommercials = queryClient.getQueriesData({ queryKey: queryKeys.commercials() })

      // Mise à jour optimiste - met à jour le cache immédiatement
      queryClient.setQueriesData<Commercial[]>({ queryKey: queryKeys.commercials() }, old => {
        if (!old) return old
        return old.map(commercial => {
          if (commercial.id === variables.id) {
            // Fusionner les données en s'assurant que les types correspondent
            return {
              ...commercial,
              ...variables,
            } as Commercial
          }
          return commercial
        })
      })

      // Retourner le contexte pour rollback en cas d'erreur
      return { previousCommercials }
    },
    onError: (error, variables, context) => {
      // Rollback en cas d'erreur
      if (context?.previousCommercials) {
        context.previousCommercials.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      showError(error, 'useUpdateCommercialMutation')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commercials() })
    },
  })
}
