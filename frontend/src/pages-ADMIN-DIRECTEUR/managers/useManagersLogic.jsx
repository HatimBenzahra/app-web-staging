import { useMemo, useCallback } from 'react'
import { useManagers, useUpdateManager, useDirecteurs } from '@/services'
import { useEntityPage } from '@/hooks/metier/permissions/useRoleBasedData'
import { useRole } from '@/contexts/userole'
import { useErrorToast } from '@/hooks/utils/ui/use-error-toast'
import { calculateRankFromStats } from '@/utils/business/ranks'
import { USER_STATUS_CONFIG, getStatusFilterOptions } from '@/constants/domain/user-status'
import { useStatusBadge } from '@/hooks/utils/ui/useStatusBadge'

const getManagersColumns = renderStatusBadge => {
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
      header: 'Rang',
      accessor: 'rankBadge',
      sortKey: 'points',
      sortable: true,
      className: 'hidden sm:table-cell',
    },
    {
      header: 'Email',
      accessor: 'email',
      className: 'hidden sm:table-cell',
    },
    {
      header: 'Téléphone',
      accessor: 'numTelephone',
      className: 'hidden md:table-cell',
    },
    {
      header: 'Directeur',
      accessor: 'directeur',
      sortable: true,
      className: 'hidden lg:table-cell',
    },
  ]

  return baseColumns
}

export function useManagersLogic() {
  const { isAdmin } = useRole()
  const { showError, showSuccess } = useErrorToast()
  // API hooks
  const { data: managersApi, loading: managersLoading, refetch } = useManagers()
  const { data: directeurs } = useDirecteurs()
  const { mutate: updateManager } = useUpdateManager()

  // Utilisation du système de rôles pour filtrer les données
  const {
    data: filteredManagers,
    permissions,
    description,
  } = useEntityPage('managers', managersApi || [])

  const { renderStatusBadge } = useStatusBadge()

  // Préparation des données pour le tableau avec mapping API -> UI
  const tableData = useMemo(() => {
    if (!filteredManagers) return []
    return filteredManagers.map(manager => {
      const directeur = directeurs?.find(d => d.id === manager.directeurId)
      const { rank, points } = calculateRankFromStats(manager.statistics)
      return {
        ...manager,
        nom: manager.nom,
        prenom: manager.prenom,
        status: manager.status,
        email: manager.email || 'Non renseigné',
        numTelephone: manager.numTelephone || 'Non renseigné',
        directeur: directeur ? `${directeur.prenom} ${directeur.nom}` : 'Aucun directeur',
        rankBadge: (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${rank.bgColor} ${rank.textColor} ${rank.borderColor} border`}
          >
            <span>🏆</span>
            {rank.name}
            <span className="text-[10px] opacity-75">({points}pts)</span>
          </span>
        ),
        points,
      }
    })
  }, [filteredManagers, directeurs])

  // Options dynamiques pour les directeurs
  const directeurOptions = useMemo(() => {
    if (!directeurs) return []
    return directeurs.map(d => ({
      value: `${d.prenom} ${d.nom}`,
      label: `${d.prenom} ${d.nom}`,
    }))
  }, [directeurs])

  // Configuration des champs du modal d'édition
  const managersEditFields = useMemo(
    () => [
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
        required: true,
        section: 'Informations personnelles',
      },
      {
        key: 'numTelephone',
        label: 'Téléphone',
        type: 'tel',
        required: true,
        section: 'Informations personnelles',
        placeholder: '+33 XX XXX XXX',
      },

      {
        key: 'directeur',
        label: 'Directeur',
        type: 'select',
        required: true,
        section: 'Affectation',
        options: directeurOptions,
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
         hint: 'Actif par défaut pour les nouveaux comptes.',
       },
    ],
    [directeurOptions]
  )

  const handleEditManager = async editedData => {
    try {
      const updateInput = {
        id: editedData.id,
        nom: editedData.nom,
        prenom: editedData.prenom,
        numTelephone: editedData.numTelephone,
        directeurId:
          editedData.directeur && editedData.directeur !== 'Aucun directeur'
            ? directeurs?.find(d => `${d.prenom} ${d.nom}` === editedData.directeur)?.id
            : null,
        status: editedData.status || undefined,
      }

      await updateManager(updateInput)
      await refetch()
      showSuccess('Manager modifié avec succès')
    } catch (error) {
      showError(error, 'Managers.handleEditManager')
      throw error
    }
  }

  const columns = getManagersColumns(renderStatusBadge)

  return {
    tableData,
    columns,
    permissions,
    description,
    managersLoading,
    managersEditFields,
    handleEditManager,
    isAdmin,
    statusOptions: getStatusFilterOptions(),
  }
}
