/**
 * Hook personnalisé pour le filtrage automatique des données selon le rôle
 */

import { useMemo } from 'react'
import { useRole } from '@/contexts/userole'
import {
  filterCommercials,
  filterManagers,
  filterDirecteurs,
  filterZones,
  filterImmeubles,
  filterStatistics,
  hasPermission,
  getEntityDescription,
} from './roleFilters'

/**
 * Hook principal pour obtenir des données filtrées selon le rôle
 */
export const useRoleBasedData = (entity, rawData, dependencies = {}) => {
  const { currentRole, currentUserId } = useRole()

  const filteredData = useMemo(() => {
    if (!rawData) return []

    switch (entity) {
      case 'commerciaux':
        return filterCommercials(rawData, dependencies.managers, currentRole, currentUserId)

      case 'managers':
        return filterManagers(rawData, currentRole, currentUserId)

      case 'directeurs':
        return filterDirecteurs(rawData, currentRole, currentUserId)

      case 'zones':
        return filterZones(rawData, dependencies.commercials, currentRole, currentUserId)

      case 'immeubles':
        return filterImmeubles(rawData, dependencies.commercials, currentRole, currentUserId)

      case 'statistics':
        return filterStatistics(rawData, dependencies.commercials, currentRole, currentUserId)

      default:
        return rawData
    }
  }, [rawData, dependencies, currentRole, currentUserId, entity])

  return filteredData
}

/**
 * Hook pour obtenir les permissions de l'utilisateur pour une entité
 */
export const useEntityPermissions = entity => {
  const { currentRole } = useRole()

  return useMemo(
    () => ({
      canView: hasPermission(currentRole, entity, 'view'),
      canAdd: hasPermission(currentRole, entity, 'add'),
      canEdit: hasPermission(currentRole, entity, 'edit'),
      canDelete: hasPermission(currentRole, entity, 'delete'),
    }),
    [currentRole, entity]
  )
}

/**
 * Hook pour obtenir la description dynamique d'une entité
 */
export const useEntityDescription = entity => {
  const { currentRole } = useRole()

  return useMemo(() => getEntityDescription(entity, currentRole), [entity, currentRole])
}

/**
 * Hook combiné pour une page complète avec données, permissions et description
 */
export const useEntityPage = (entity, rawData, dependencies = {}) => {
  const filteredData = useRoleBasedData(entity, rawData, dependencies)
  const permissions = useEntityPermissions(entity)
  const description = useEntityDescription(entity)

  return {
    data: filteredData,
    permissions,
    description,
  }
}
