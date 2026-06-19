import { useMemo } from 'react'
import {
  useCommercials,
  useUpdateCommercial,
  useManagers,
  useDirecteurs,
  useTeamLastStatusActivities,
} from '@/services'
import { useRole } from '@/contexts/userole'
import { useEntityPermissions, useEntityDescription } from '@/hooks/metier/permissions/useRoleBasedData'
import { useErrorToast } from '@/hooks/utils/ui/use-error-toast'
import { aggregateStats, calculateRank } from '@/utils/business/ranks'
import { USER_STATUS_CONFIG, getStatusFilterOptions } from '@/constants/domain/user-status'
import { useStatusBadge } from '@/hooks/utils/ui/useStatusBadge'

const getActivityTime = activity => {
  if (!activity?.changedAt) return 0
  const time = new Date(activity.changedAt).getTime()
  return Number.isFinite(time) ? time : 0
}

const formatRelativeActivityDate = dateValue => {
  if (!dateValue) return 'Jamais'

  const date = new Date(dateValue)
  const diffMs = Date.now() - date.getTime()
  if (!Number.isFinite(diffMs)) return 'Date inconnue'

  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'À l’instant'
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} j`

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const renderActivityCell = row => {
  if (!row.lastActivity) {
    return <span className="text-xs text-muted-foreground">Jamais</span>
  }

  return (
    <div className="min-w-28">
      <p className="text-sm font-medium">{formatRelativeActivityDate(row.lastActivity.changedAt)}</p>
    </div>
  )
}

const getCommerciauxColumns = (isAdmin, isDirecteur, renderStatusBadge) => {
  const baseColumns = [
    {
      header: 'Nom',
      accessor: 'nom',
      sortable: true,
      className: 'font-medium',
    },
    {
      header: 'Prénom',
      accessor: 'prenom',
      sortable: true,
      className: 'font-medium',
    },
    {
      header: 'Statut',
      accessor: 'status',
      sortable: true,
      className: 'hidden md:table-cell',
      cell: row => renderStatusBadge(row.status),
    },
    {
      header: 'Dernier terrain',
      accessor: 'lastActivityLabel',
      sortKey: 'lastActivityAt',
      sortable: true,
      className: 'hidden md:table-cell',
      cell: renderActivityCell,
    },
    {
      header: 'Rang',
      accessor: 'rankBadge',
      sortable: false,
      className: 'hidden sm:table-cell',
    }
  ]

  // Colonne Manager: visible pour Admin et Directeur seulement
  if (isAdmin || isDirecteur) {
    baseColumns.push({
      header: 'Manager',
      accessor: 'managerName',
      sortable: true,
      className: 'hidden lg:table-cell',
    })
  }

  // Colonne Directeur: visible pour Admin seulement
  if (isAdmin) {
    baseColumns.push({
      header: 'Directeur',
      accessor: 'directeurName',
      sortable: true,
      className: 'hidden xl:table-cell',
    })
  }

  return baseColumns
}

export function useCommerciauxLogic() {
  const { isAdmin, isDirecteur } = useRole()
  const { data: commercials, loading, error, refetch } = useCommercials()
  const { data: managers } = useManagers()
  const { data: directeurs } = useDirecteurs()
  const {
    data: lastStatusActivities,
    loading: lastActivitiesLoading,
  } = useTeamLastStatusActivities()
  const { mutate: updateCommercial, loading: updating } = useUpdateCommercial()
  const { showError, showSuccess } = useErrorToast()
  const { renderStatusBadge } = useStatusBadge()

  // Les données sont déjà filtrées côté serveur
  const filteredCommercials = useMemo(() => commercials || [], [commercials])

  // Récupération des permissions et description
  const permissions = useEntityPermissions('commerciaux')
  const description = useEntityDescription('commerciaux')
  const columns = useMemo(
    () => getCommerciauxColumns(isAdmin, isDirecteur, renderStatusBadge),
    [isAdmin, isDirecteur, renderStatusBadge]
  )

  // Préparer les données pour le tableau
  const tableData = useMemo(() => {
    if (!filteredCommercials) return []

    const activityByCommercial = new Map(
      (lastStatusActivities || [])
        .filter(activity => activity.userType === 'commercial')
        .map(activity => [activity.userId, activity])
    )

    return filteredCommercials.map(commercial => {
      // Trouver le nom du manager
      const manager = managers?.find(m => m.id === commercial.managerId)
      const managerName = manager ? `${manager.prenom} ${manager.nom}` : 'N/A'

      // Trouver le nom du directeur
      const directeur = directeurs?.find(d => d.id === commercial.directeurId)
      const directeurName = directeur ? `${directeur.prenom} ${directeur.nom}` : 'N/A'

      const { contratsSignes: totalContratsSignes, rendezVousPris: totalRendezVousPris, immeublesVisites: totalImmeublesVisites } = aggregateStats(commercial.statistics)
      const { rank, points } = calculateRank(totalContratsSignes, totalRendezVousPris, totalImmeublesVisites)
      const lastActivity = activityByCommercial.get(commercial.id) || null
      const lastActivityAt = getActivityTime(lastActivity)

      // Créer le badge de rang
      const rankBadge = (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${rank.bgColor} ${rank.textColor} ${rank.borderColor} border`}
        >
          <span>🏆</span>
          {rank.name}
          <span className="text-[10px] opacity-75">({points}pts)</span>
        </span>
      )

      return {
        ...commercial,
        nom: commercial.nom,
        prenom: commercial.prenom,
        status: commercial.status,
        columns,
        rankBadge,
        lastActivity,
        lastActivityAt,
        lastActivityLabel: formatRelativeActivityDate(lastActivity?.changedAt),
        managerName,
        directeurName,
        createdAt: new Date(commercial.createdAt).toLocaleDateString('fr-FR'),
      }
    }).sort((a, b) => b.lastActivityAt - a.lastActivityAt || a.nom.localeCompare(b.nom, 'fr'))
  }, [filteredCommercials, managers, directeurs, columns, lastStatusActivities])

  // Préparer les options pour les formulaires
  const managerOptions = useMemo(() => {
    if (!managers) return []
    return managers.map(manager => ({
      value: manager.id,
      label: `${manager.prenom} ${manager.nom}`,
    }))
  }, [managers])

  // Configuration des champs du modal d'édition
  const commerciauxEditFields = [
    {
      key: 'nom',
      label: 'Nom',
      type: 'text',
      required: true,
      section: 'Informations personnelles',
    },
    {
      key: 'prenom',
      label: 'Prénom',
      type: 'text',
      required: false,
      section: 'Informations personnelles',
    },
    {
      key: 'numTel',
      label: 'Téléphone',
      type: 'tel',
      required: false,
      section: 'Informations personnelles',
      placeholder: '+33 XX XXX XXX',
    },
    {
      key: 'age',
      label: 'Age',
      type: 'number',
      required: false,
      section: 'Informations personnelles',
    },
    {
      key: 'managerId',
      label: 'Manager',
      type: 'select',
      section: 'Affectation',
      options: managerOptions,
    },
     {
       key: 'status',
       label: 'Statut',
       type: 'select',
       section: 'Statut',
       options: USER_STATUS_CONFIG.map(option => ({
         value: option.value,
         label: option.label,
       })),
       hint: 'Statut du commercial',
     },
  ]

  const handleEditCommercial = async editedData => {
    try {
      await updateCommercial({
        id: editedData.id,
        nom: editedData.nom,
        prenom: editedData.prenom,
        numTel: editedData.numTel,
        age: editedData.age ? parseInt(editedData.age) : undefined,
        managerId: editedData.managerId ? parseInt(editedData.managerId) : undefined,
        status: editedData.status || undefined,
      })
      await refetch()
      showSuccess('Commercial modifié avec succès')
    } catch (error) {
      showError(error, 'Commerciaux.handleEditCommercial')
      throw error
    }
  }

  return {
    tableData,
    columns,
    permissions,
    description,
    loading: loading || lastActivitiesLoading,
    error,
    updating,
    refetch,
    commerciauxEditFields,
    handleEditCommercial,
    statusOptions: getStatusFilterOptions(),
  }
}
