import { useState, useMemo, useEffect } from 'react'
import {
  useImmeubles,
  useUpdateImmeuble,
  useRemoveImmeuble,
  useCommercials,
  useManagers,
} from '@/services'
import {
  useEntityPermissions,
  useEntityDescription,
} from '@/hooks/metier/permissions/useRoleBasedData'
import { useErrorToast } from '@/hooks/utils/ui/use-error-toast'
import { Badge } from '@/components/ui/badge'
import { getStatusColor, getStatusLabel } from '@/constants/domain/porte-status'

function calculnbcontrats(immeuble) {
  return (immeuble.portes || [])
    .filter(p => p.statut === 'CONTRAT_SIGNE')
    .reduce((sum, p) => sum + (p.nbContrats || 1), 0)
}

export function useImmeublesLogic() {
  const { showError, showSuccess } = useErrorToast()
  const [viewMode, setViewMode] = useState('list')
  const [dateFilterMode, setDateFilterMode] = useState('updatedAt_desc')
  const [filterCommercial, setFilterCommercial] = useState('all')
  const [createdDate, setCreatedDate] = useState('')

  // API hooks
  const { data: immeublesApi, loading: immeublesLoading, refetch } = useImmeubles()
  const { data: commercials } = useCommercials()
  const { data: managers } = useManagers()
  const { mutate: updateImmeuble } = useUpdateImmeuble()
  const { mutate: removeImmeuble } = useRemoveImmeuble()

  useEffect(() => {
    if (dateFilterMode !== 'created_specific_date' && createdDate) {
      setCreatedDate('')
    }
  }, [dateFilterMode, createdDate])

  const effectiveSortBy = useMemo(() => {
    if (
      dateFilterMode === 'createdAt_desc' ||
      dateFilterMode === 'createdAt_asc' ||
      dateFilterMode === 'updatedAt_desc' ||
      dateFilterMode === 'updatedAt_asc'
    ) {
      return dateFilterMode
    }
    return 'createdAt_desc'
  }, [dateFilterMode])

  const filteredImmeubles = useMemo(() => {
    let result = immeublesApi || []

    if (filterCommercial !== 'all') {
      result = result.filter(imm => imm.commercialId === parseInt(filterCommercial))
    }

    if (dateFilterMode === 'created_yesterday') {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 1)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(startDate)
      endDate.setHours(23, 59, 59, 999)

      result = result.filter(imm => {
        const createdAt = new Date(imm.createdAt)
        return createdAt >= startDate && createdAt <= endDate
      })
    }

    if (dateFilterMode === 'created_this_week') {
      const now = new Date()
      const day = now.getDay()
      const diffToMonday = (day + 6) % 7
      const startDate = new Date(now)
      startDate.setDate(now.getDate() - diffToMonday)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + 6)
      endDate.setHours(23, 59, 59, 999)

      result = result.filter(imm => {
        const createdAt = new Date(imm.createdAt)
        return createdAt >= startDate && createdAt <= endDate
      })
    }

    if (dateFilterMode === 'created_specific_date' && createdDate) {
      const startDate = new Date(createdDate)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(startDate)
      endDate.setHours(23, 59, 59, 999)

      result = result.filter(imm => {
        const createdAt = new Date(imm.createdAt)
        return createdAt >= startDate && createdAt <= endDate
      })
    }

    return result
  }, [immeublesApi, filterCommercial, dateFilterMode, createdDate])

  // Récupération des permissions et description
  const permissions = useEntityPermissions('immeubles')
  const description = useEntityDescription('immeubles')

  // Configuration des colonnes
  const immeublesColumns = useMemo(
    () => [
      {
        header: 'Adresse',
        accessor: 'address',
        sortable: true,
        className: 'font-medium max-w-[280px]',
        cell: row => (
          <div className="truncate">
            <span className="text-[13px] font-medium">{row.address}</span>
          </div>
        ),
      },
      {
        header: 'Commercial',
        accessor: 'commercial_name',
        sortable: true,
        className: 'hidden xl:table-cell text-[13px]',
      },
      {
        header: 'Ét.',
        accessor: 'floors',
        sortable: true,
        className: 'hidden md:table-cell tabular-nums text-[13px] text-center',
      },
      {
        header: 'Portes',
        accessor: 'total_doors',
        sortable: true,
        className: 'hidden md:table-cell tabular-nums text-[13px] text-center',
      },
      {
        header: 'Contrats',
        accessor: 'contrats_signes',
        sortable: true,
        className: 'hidden md:table-cell text-center',
        cell: row => (
          <span className={`tabular-nums text-[13px] font-medium ${row.contrats_signes > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
            {row.contrats_signes > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 align-middle" />}
            {row.contrats_signes}
          </span>
        ),
      },
      {
        header: 'RDV',
        accessor: 'rdvCount',
        sortable: true,
        className: 'hidden lg:table-cell text-center',
        cell: row =>
          row.rdvCount > 0 ? (
            <Badge className="text-[10px] bg-blue-100 text-blue-800">{row.rdvCount}</Badge>
          ) : (
            <span className="text-[13px] text-muted-foreground">—</span>
          ),
      },
      {
        header: 'Non visités',
        accessor: 'nonVisiteCount',
        sortable: true,
        className: 'hidden xl:table-cell text-center',
        cell: row => (
          <span
            className={`tabular-nums text-[13px] ${row.nonVisiteCount === 0 ? 'text-muted-foreground' : 'font-medium'}`}
          >
            {row.nonVisiteCount}
          </span>
        ),
      },
      {
        header: 'Couverture',
        accessor: 'couverture',
        sortable: true,
        className: 'hidden lg:table-cell',
        cell: row => (
          <div className="flex items-center gap-2 min-w-[100px]">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${row.couverture >= 80 ? 'bg-emerald-500' : row.couverture >= 40 ? 'bg-blue-500' : row.couverture > 0 ? 'bg-amber-500' : 'bg-muted'}`}
                style={{ width: `${row.couverture}%` }}
              />
            </div>
            <span className="tabular-nums text-[12px] text-muted-foreground w-9 text-right">{row.couverture}%</span>
          </div>
        ),
      },
      {
        header: 'Créé le',
        accessor: 'createdAt',
        sortable: true,
        className: 'hidden xl:table-cell text-[12px] tabular-nums text-muted-foreground',
        cell: row => new Date(row.createdAt).toLocaleDateString('fr-FR'),
      },
    ],
    []
  )

  // Configuration des champs d'édition
  const getImmeublesEditFields = useMemo(
    () => [
      {
        key: 'address',
        label: 'Adresse',
        type: 'textarea',
        required: true,
        section: 'Informations générales',
        fullWidth: true,
        placeholder: "Adresse complète de l'immeuble",
      },
      {
        key: 'floors',
        label: "Nombre d'étages",
        type: 'number',
        required: true,
        section: 'Caractéristiques',
        min: 1,
        max: 100,
      },
      {
        key: 'doors_per_floor',
        label: 'Portes par étage',
        type: 'number',
        required: true,
        section: 'Caractéristiques',
        min: 1,
        max: 100,
      },
      {
        key: 'commercial_name',
        label: 'Commercial responsable',
        type: 'select',
        required: true,
        section: 'Gestion',
        options: (commercials || []).map(c => ({
          value: `${c.prenom} ${c.nom}`,
          label: `${c.prenom} ${c.nom}`,
        })),
      },
    ],
    [commercials]
  )

  const tableData = useMemo(() => {
    if (!filteredImmeubles) return []

    const [field, direction] = effectiveSortBy.split('_')
    const sortedImmeubles = [...filteredImmeubles].sort((a, b) => {
      const dateA = new Date(a[field]).getTime()
      const dateB = new Date(b[field]).getTime()
      return direction === 'desc' ? dateB - dateA : dateA - dateB
    })
    const mappedData = sortedImmeubles.map(immeuble => {
      const commercial = commercials?.find(c => c.id === immeuble.commercialId)
      const manager = managers?.find(m => m.id === immeuble.managerId)
      const portesImmeuble = immeuble.portes || []
      const totalDoors = portesImmeuble.length
      const portesProspectees = portesImmeuble.filter(p => p.statut !== 'NON_VISITE').length
      const couverture =
        totalDoors > 0 ? parseFloat(((portesProspectees / totalDoors) * 100).toFixed(1)) : 0

      // Déterminer le nom du responsable
      let responsibleName = 'N/A'
      if (commercial) {
        responsibleName = `${commercial.prenom} ${commercial.nom}`
      } else if (manager) {
        responsibleName = `${manager.prenom} ${manager.nom} (Manager)`
      }

      const rdvCount = portesImmeuble.filter(p => p.statut === 'RENDEZ_VOUS_PRIS').length
      const nonVisiteCount = portesImmeuble.filter(p => p.statut === 'NON_VISITE').length

      return {
        ...immeuble,
        address: immeuble.adresse,
        floors: immeuble.nbEtages,
        doors_per_floor: immeuble.nbPortesParEtage,
        total_doors: totalDoors,
        contrats_signes: calculnbcontrats(immeuble),
        couverture: couverture,
        rdvCount,
        nonVisiteCount,
        commercial_name: responsibleName,
      }
    })

    const totalImmeubles = sortedImmeubles.length
    const totalContrats = sortedImmeubles.reduce((acc, curr) => acc + calculnbcontrats(curr), 0)
    const avgCouverture =
      totalImmeubles > 0
        ? (
            sortedImmeubles.reduce((acc, curr) => {
              const portesImmeuble = curr.portes || []
              const totalDoors = portesImmeuble.length
              const portesProspectees = portesImmeuble.filter(p => p.statut !== 'NON_VISITE').length
              const couverture = totalDoors > 0 ? (portesProspectees / totalDoors) * 100 : 0
              return acc + couverture
            }, 0) / totalImmeubles
          ).toFixed(1)
        : 0

    const totalRdv = mappedData.reduce((acc, curr) => acc + curr.rdvCount, 0)
    const totalNonVisites = mappedData.reduce((acc, curr) => acc + curr.nonVisiteCount, 0)

    return { data: mappedData, stats: { totalImmeubles, totalContrats, avgCouverture, totalRdv, totalNonVisites } }
  }, [filteredImmeubles, commercials, managers, effectiveSortBy])

  const stats = tableData?.stats || {
    totalImmeubles: 0,
    totalContrats: 0,
    avgCouverture: 0,
    totalRdv: 0,
    totalNonVisites: 0,
  }
  const finalTableData = tableData?.data || []

  const handleEditImmeuble = async editedData => {
    try {
      const commercial = commercials?.find(
        c => `${c.prenom} ${c.nom}` === editedData.commercial_name
      )

      const updateInput = {
        id: editedData.id,
        adresse: editedData.address,
        nbEtages: parseInt(editedData.floors),
        nbPortesParEtage: parseInt(editedData.doors_per_floor),
        commercialId: commercial?.id,
      }

      await updateImmeuble(updateInput)
      await refetch()
      showSuccess('Immeuble modifié avec succès')
    } catch (error) {
      showError(error, 'Immeubles.handleEditImmeuble')
      throw error
    }
  }

  const handleDeleteImmeuble = async id => {
    try {
      await removeImmeuble(id)
      await refetch()
      showSuccess('Immeuble supprimé avec succès')
    } catch (error) {
      showError(error, 'Immeubles.handleDeleteImmeuble')
      throw error
    }
  }

  return {
    viewMode,
    setViewMode,
    immeublesLoading,
    description,
    tableData: finalTableData,
    stats,
    immeublesColumns,
    getImmeublesEditFields,
    permissions,
    handleEditImmeuble,
    handleDeleteImmeuble,
    filteredImmeubles,
    filterCommercial,
    setFilterCommercial,
    dateFilterMode,
    setDateFilterMode,
    createdDate,
    setCreatedDate,
    commercialsList: commercials,
  }
}
