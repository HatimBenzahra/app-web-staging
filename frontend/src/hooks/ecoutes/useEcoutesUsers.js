import { useMemo } from 'react'
import { useCommercials, useManagers } from '@/services'

/**
 * Hook personnalisé pour gérer les utilisateurs (commerciaux et managers)
 * dans les pages d'écoutes
 * C concernant la page d'ecoute live
 */
export function useEcoutesUsers() {
  const {
    data: commercials,
    loading: commercialsLoading,
    error: commercialsError,
    refetch: refetchCommercials,
  } = useCommercials()

  const {
    data: managers,
    loading: managersLoading,
    error: managersError,
    refetch: refetchManagers,
  } = useManagers()

  // Combiner commerciaux et managers avec type
  const allUsers = useMemo(() => {
    const commercialUsers = (commercials || []).map(user => ({ ...user, userType: 'commercial' }))
    const managerUsers = (managers || []).map(user => ({ ...user, userType: 'manager' }))
    return [...commercialUsers, ...managerUsers]
  }, [commercials, managers])

  const loading = commercialsLoading || managersLoading
  const error = commercialsError || managersError

  const refetch = () => {
    refetchCommercials()
    refetchManagers()
  }

  return {
    allUsers,
    loading,
    error,
    refetch,
  }
}
