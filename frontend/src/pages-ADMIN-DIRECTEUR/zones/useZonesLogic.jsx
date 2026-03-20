import { useState, useMemo } from 'react'
import { useErrorToast } from '@/hooks/utils/ui/use-error-toast'
import {
  useZones,
  useCreateZone,
  useUpdateZone,
  useRemoveZone,
  useDirecteurs,
  useManagers,
  useCommercials,
  useAssignZone,
  useAssignZoneToDirecteur,
  useAssignZoneToManager,
  useAllCurrentAssignments,
} from '@/services'
import { useEntityPermissions, useEntityDescription } from '@/hooks/metier/permissions/useRoleBasedData'
import { useRole } from '@/contexts/userole'
import { fetchLocationName } from './zones-utils'
import { ROLES } from '@/hooks/metier/permissions/roleFilters'
import {
  parseAssignedUserIds,
  removeRedundantAssignments,
  getAssignedUserIdsFromZone,
} from './zones-utils'

/**
 * Hook to get assignable users based on permissions and role
 */
export const useAssignableUsers = (permissions, currentUserId, currentRole, directeurs, managers, commercials) => {
  return useMemo(() => {
    if (!permissions.canAdd && !permissions.canEdit) {
      return []
    }

    const userIdInt = parseInt(currentUserId, 10)
    const safeUserId = Number.isNaN(userIdInt) ? null : userIdInt

    const formatUsers = (collection, role) =>
      (collection || []).map(item => ({
        id: item.id,
        name: `${item.prenom} ${item.nom}`,
        role,
        managerId: item.managerId,
        directeurId: item.directeurId,
      }))

    switch (currentRole) {
      case ROLES.ADMIN:
        return [
          ...formatUsers(directeurs, 'directeur'),
          ...formatUsers(managers, 'manager'),
          ...formatUsers(commercials, 'commercial'),
        ]

      case ROLES.DIRECTEUR: {
        const scopedDirecteur = directeurs?.find(d => d.id === safeUserId)
        const directeurOption = scopedDirecteur
          ? [
              {
                id: scopedDirecteur.id,
                name: `${scopedDirecteur.prenom} ${scopedDirecteur.nom}`,
                role: 'directeur',
              },
            ]
          : []

        return [
          ...directeurOption,
          ...formatUsers(managers, 'manager'),
          ...formatUsers(commercials, 'commercial'),
        ]
      }

      case ROLES.COMMERCIAL: {
        const scopedCommercial = commercials?.find(c => c.id === safeUserId)
        return scopedCommercial
          ? [
              {
                id: scopedCommercial.id,
                name: `${scopedCommercial.prenom} ${scopedCommercial.nom}`,
                role: 'commercial',
              },
            ]
          : []
      }

      default:
        return []
    }
  }, [permissions, currentUserId, currentRole, directeurs, managers, commercials])
}

/**
 * Hook for Mapbox lazy loader configuration
 */
export const useMapboxLoader = () => {
    return useMemo(
    () => ({
      namespace: 'mapbox-geocode',
      fetcher: async zone => {
        return fetchLocationName(zone.xOrigin, zone.yOrigin)
      },
      getCacheKey: zone => [zone.xOrigin.toFixed(4), zone.yOrigin.toFixed(4)],
      shouldLoad: (zone, currentData) => {
        return zone.xOrigin && zone.yOrigin && !currentData
      },
      delay: 200, // 200ms entre chaque appel
      maxConcurrent: 3,
    }),
    []
  )
}

/**
 * Hook to enrich zones with assignment information
 */
export const useEnrichedZones = (zones, directeurs, managers, commercials, allAssignments) => {
  return useMemo(() => {
    if (!zones) return []

    // Créer des Maps pour un accès O(1)
    const directeursMap = new Map(directeurs?.map(d => [d.id, d]) || [])
    const managersMap = new Map(managers?.map(m => [m.id, m]) || [])
    const commercialsMap = new Map(commercials?.map(c => [c.id, c]) || [])

    // Créer un index des assignations par zoneId
    const assignmentsByZone = (allAssignments || []).reduce((acc, assignment) => {
      if (!acc[assignment.zoneId]) {
        acc[assignment.zoneId] = []
      }
      acc[assignment.zoneId].push(assignment)
      return acc
    }, {})

    return zones
      .map(zone => {
        const assignedUsers = []

        // 1. Vérifier l'assignation directe au directeur
        if (zone.directeurId) {
          const directeur = directeursMap.get(zone.directeurId)
          if (directeur) {
            assignedUsers.push(`${directeur.prenom} ${directeur.nom} (Directeur)`)
          }
        }

        // 2. Vérifier l'assignation directe au manager
        if (zone.managerId) {
          const manager = managersMap.get(zone.managerId)
          if (manager) {
            assignedUsers.push(`${manager.prenom} ${manager.nom} (Manager)`)
          }
        }

        // 3. Trouver toutes les assignations via ZoneEnCours
        const zoneAssignments = assignmentsByZone[zone.id] || []

        zoneAssignments.forEach(assignment => {
          if (assignment.userType === 'COMMERCIAL') {
            const commercial = commercialsMap.get(assignment.userId)
            if (commercial) {
              assignedUsers.push(`${commercial.prenom} ${commercial.nom} (Commercial)`)
            }
          } else if (assignment.userType === 'MANAGER') {
            const manager = managersMap.get(assignment.userId)
            if (manager) {
              assignedUsers.push(`${manager.prenom} ${manager.nom} (Manager)`)
            }
          } else if (assignment.userType === 'DIRECTEUR') {
            const directeur = directeursMap.get(assignment.userId)
            if (directeur) {
              assignedUsers.push(`${directeur.prenom} ${directeur.nom} (Directeur)`)
            }
          }
        })

        // Deduplicate assignedUsers strings
        const uniqueAssignedUsers = [...new Set(assignedUsers)];

        // Formater l'affichage
        const assignedTo = uniqueAssignedUsers.length > 0
          ? uniqueAssignedUsers.join(', ')
          : 'Non assigné'

        return {
          ...zone,
          assignedTo,
          assignedUsersCount: uniqueAssignedUsers.length,
        }
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [zones, directeurs, managers, commercials, allAssignments])
}

export function useZonesLogic() {
  const { showError, showSuccess } = useErrorToast()
  const [showZoneModal, setShowZoneModal] = useState(false)
  const [editingZone, setEditingZone] = useState(null)
  const [isSubmittingZone, setIsSubmittingZone] = useState(false)
  const [confirmAction, setConfirmAction] = useState({
    isOpen: false,
    type: '',
    zone: null,
    isLoading: false,
  })

  // Récupération du rôle de l'utilisateur
  const { currentRole, currentUserId } = useRole()

  // API hooks
  const { data: zonesApi, refetch: refetchZones } = useZones()
  // Les données sont déjà filtrées côté serveur
  const zonesData = useMemo(() => zonesApi || [], [zonesApi])
  
  const { mutate: createZone } = useCreateZone()
  const { mutate: updateZone } = useUpdateZone()
  const { mutate: removeZone } = useRemoveZone()
  const { mutate: assignZoneToCommercial } = useAssignZone()
  const { mutate: assignZoneToDirecteur } = useAssignZoneToDirecteur()
  const { mutate: assignZoneToManager } = useAssignZoneToManager()
  
  const { data: directeurs } = useDirecteurs()
  const { data: managers } = useManagers()
  const { data: commercials } = useCommercials()
  const { data: allAssignments, refetch: refetchAssignments } = useAllCurrentAssignments()

  // Récupération des permissions et description
  const permissions = useEntityPermissions('zones')
  const description = useEntityDescription('zones')

  // Custom Hooks for Data Logic
  const enrichedZones = useEnrichedZones(zonesData, directeurs, managers, commercials, allAssignments)
  const assignableUsers = useAssignableUsers(permissions, currentUserId, currentRole, directeurs, managers, commercials)
  const mapboxLazyLoader = useMapboxLoader()

  // Helper local pour le traitement des assignations
  const processAssignments = async (zoneId, assignments) => {
    const assignmentPromises = assignments.map(assignment => {
      if (assignment.role === 'commercial') {
        return assignZoneToCommercial({
          commercialId: assignment.id,
          zoneId: zoneId,
        }).catch(err => {
          console.warn('Assignation commerciale échouée (ignorée):', err)
          return null
        })
      } else if (assignment.role === 'directeur') {
        return assignZoneToDirecteur({
          directeurId: assignment.id,
          zoneId: zoneId,
        }).catch(err => {
          console.warn('Assignation directeur échouée (ignorée):', err)
          return null
        })
      } else if (assignment.role === 'manager') {
        return assignZoneToManager({
          managerId: assignment.id,
          zoneId: zoneId,
        }).catch(err => {
          console.warn('Assignation manager échouée (ignorée):', err)
          return null
        })
      }
      return Promise.resolve()
    })

    await Promise.allSettled(assignmentPromises)
  }

  // Actions Handlers
  const handleAddZone = () => {
    setEditingZone(null)
    setShowZoneModal(true)
  }

  const handleEditZone = zone => {
    setConfirmAction({
      isOpen: true,
      type: 'edit',
      zone,
      isLoading: false,
    })
  }

  const confirmEditZone = () => {
    // Enrichir la zone avec les utilisateurs assignés actuels
    const currentAssignments = getAssignedUserIdsFromZone(confirmAction.zone, allAssignments)
    const zoneWithAssignment = {
      ...confirmAction.zone,
      assignedUserId: currentAssignments[0] || '', // Pour compatibilité
      assignedUserIds: currentAssignments,
    }
    setEditingZone(zoneWithAssignment)
    setShowZoneModal(true)
    setConfirmAction({ isOpen: false, type: '', zone: null, isLoading: false })
  }

  const handleDeleteZone = zone => {
    setConfirmAction({
      isOpen: true,
      type: 'delete',
      zone,
      isLoading: false,
    })
  }

  const confirmDeleteZone = async () => {
    setConfirmAction(prev => ({ ...prev, isLoading: true }))
    try {
      await removeZone(confirmAction.zone.id)
      await refetchZones()
      showSuccess('Zone supprimée avec succès')
      setConfirmAction({ isOpen: false, type: '', zone: null, isLoading: false })
    } catch (error) {
      showError(error, 'Zones.confirmDeleteZone')
      setConfirmAction(prev => ({ ...prev, isLoading: false }))
    }
  }

  const handleCloseModal = () => {
    setShowZoneModal(false)
    setEditingZone(null)
  }

  const handleZoneValidate = async (zoneData, assignedUserIds) => {
    setIsSubmittingZone(true)
    try {
      const parsedAssignments = parseAssignedUserIds(assignedUserIds)
      // Filtrer les assignations redondantes (commerciaux dont le manager/directeur est déjà assigné)
      const assignments = removeRedundantAssignments(parsedAssignments, directeurs, managers, commercials)

      if (editingZone) {
        // Modifier la zone existante (sans directeurId/managerId)
        await updateZone({
          id: editingZone.id,
          ...zoneData,
        })
        await processAssignments(editingZone.id, assignments)
      } else {
        // Créer une nouvelle zone (sans directeurId/managerId)
        const newZone = await createZone(zoneData)
        if (newZone?.id) {
          await processAssignments(newZone.id, assignments)
        }
      }

      showSuccess(editingZone ? 'Zone modifiée avec succès' : 'Zone créée avec succès')

      // Rafraîchir la liste des zones
      await Promise.all([refetchZones(), refetchAssignments()])
      setShowZoneModal(false)
    } catch (error) {
      showError(error, 'Zones.handleZoneValidate')
    } finally {
      setIsSubmittingZone(false)
    }
  }

   // Définition des colonnes du tableau
  const zonesColumns = [
    {
      header: 'Nom',
      accessor: 'nom',
      sortable: true,
      className: 'font-medium',
    },
    {
      header: 'Localisation',
      accessor: 'location',
      className: 'hidden sm:table-cell',
      cell: (row, { getLoadedData, isLoading }) => {
        // Utiliser les données chargées dynamiquement
        const loadedLocation = getLoadedData(row, 'mapbox-geocode')

        if (loadedLocation) return loadedLocation

        if (row.xOrigin && row.yOrigin) {
          const isCurrentlyLoading = isLoading(row, 'mapbox-geocode')
          if (isCurrentlyLoading) {
            return (
              <span className="text-gray-500 text-sm flex items-center gap-1">
                <div className="animate-spin h-3 w-3 border border-gray-300 border-t-blue-600 rounded-full"></div>
                Chargement...
              </span>
            )
          }
          // Si pas encore chargé et pas en cours, afficher coordonnées temporaires
          return `${row.yOrigin.toFixed(2)}°N, ${row.xOrigin.toFixed(2)}°E`
        }

        return 'Coordonnées non disponibles'
      },
    },
    {
      header: 'Date de création de la zone:',
      accessor: 'createdAt',
      sortable: true,
      className: 'hidden md:table-cell',
      cell: row => new Date(row.createdAt).toLocaleDateString('fr-FR'),
    },
    {
      header: 'Assigné à',
      accessor: 'assignedTo',
      className: 'hidden lg:table-cell max-w-xs',
      cell: row => {
        if (row.assignedUsersCount === 0) {
          return <span className="text-muted-foreground">Non assigné</span>
        }
        if (row.assignedUsersCount === 1) {
          return row.assignedTo
        }
        // Si plusieurs utilisateurs, afficher avec un indicateur
        return (
          <div className="flex items-center gap-2">
            <span className="truncate">{row.assignedTo}</span>
            <span className="flex-shrink-0 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium px-2 py-0.5">
              {row.assignedUsersCount}
            </span>
          </div>
        )
      },
    },
    {
      header: 'Rayon (km)',
      accessor: 'rayon',
      sortable: true,
      className: 'hidden xl:table-cell text-start',
      cell: row => `${(row.rayon / 1000).toFixed(1)} km`,
    },
  ]


  return {
    description,
    enrichedZones,
    zonesColumns,
    permissions,
    mapboxLazyLoader,
    handleAddZone,
    handleEditZone,
    handleDeleteZone,
    showZoneModal,
    handleZoneValidate,
    handleCloseModal,
    zonesData,
    editingZone,
    currentRole,
    assignableUsers,
    isSubmittingZone,
    confirmAction,
    setConfirmAction,
    confirmDeleteZone,
    confirmEditZone,
  }
}
