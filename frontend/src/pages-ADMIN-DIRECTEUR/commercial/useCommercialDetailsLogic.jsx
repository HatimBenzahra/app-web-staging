import { useParams } from 'react-router-dom'
import {
  useCommercialFull,
  useManagers,
  useCurrentZoneAssignment,
  useTeamLastStatusActivities,
} from '@/services'
import { useEffect, useMemo, useState } from 'react'
import { Mic } from 'lucide-react'
import { calculateRank, aggregateStats } from '@/utils/business/ranks'
import { Badge } from '@/components/ui/badge'
import DateRangeFilter from '@/components/DateRangeFilter'
import UserRecordingsSection from '@/pages-ADMIN-DIRECTEUR/ecoutes/UserRecordingsSection'
import { useDateFilter } from '@/hooks/utils/filters/useDateFilter'
import { getStatusLabel, getStatusColor } from '@/constants/domain/porte-status'
import { porteApi } from '@/services/api/portes/porte.service'
import {
  usePersonalStats,
  useImmeublesTableData,
  useFilteredPortes,
} from '@/hooks/utils/filters/useStatisticsFilter'

const ACTIVITY_STATUS_LABELS = {
  CONTRAT_SIGNE: 'Contrat signé',
  RENDEZ_VOUS_PRIS: 'Rendez-vous pris',
  REFUS: 'Refus',
  ABSENT: 'Absent',
  ARGUMENTE: 'Argumenté',
  NECESSITE_REPASSAGE: 'Repassage nécessaire',
  NON_VISITE: 'Non visité',
}

const formatRelativeActivityDate = dateValue => {
  if (!dateValue) return 'Aucune activité'

  const date = new Date(dateValue)
  const diffMs = Date.now() - date.getTime()
  if (!Number.isFinite(diffMs)) return 'Date inconnue'

  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'À l’instant'
  if (minutes < 60) return `Il y a ${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Il y a ${hours} h`

  const days = Math.floor(hours / 24)
  if (days < 7) return `Il y a ${days} j`

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const getActivityDescription = activity => {
  if (!activity) return 'Aucun changement de statut enregistré'

  const statusLabel = ACTIVITY_STATUS_LABELS[activity.statut] || activity.statut
  const address = activity.immeubleAdresse ? ` · ${activity.immeubleAdresse}` : ''
  return `${statusLabel} · Porte ${activity.porteNumero}${address}`
}

export function useCommercialDetailsLogic() {
  const { id } = useParams()
  const { data: commercial, loading, error } = useCommercialFull(parseInt(id))
  const { data: managers } = useManagers()
  const { data: currentZone } = useCurrentZoneAssignment(parseInt(id), 'COMMERCIAL')
  const { data: lastStatusActivities } = useTeamLastStatusActivities()

  // Hook pour gérer les filtres de date (pour les stats et portes)
  const dateFilter = useDateFilter()
  const { appliedStartDate, appliedEndDate } = dateFilter

  // États pour le filtre des immeubles
  const immeubleDateFilter = useDateFilter()
  const {
    appliedStartDate: appliedImmeubleStartDate,
    appliedEndDate: appliedImmeubleEndDate,
  } = immeubleDateFilter

  // État pour le type de date à filtrer (création ou modification)
  const [immeubleDateType, setImmeubleDateType] = useState('created')
  const [recordingSegments, setRecordingSegments] = useState([])

  useEffect(() => {
    const commercialId = parseInt(id)
    if (!Number.isFinite(commercialId)) return

    let active = true
    porteApi
      .getRecordingSegmentsByCommercial(commercialId)
      .then(segments => {
        if (active) setRecordingSegments(segments || [])
      })
      .catch(error => {
        console.error('Erreur chargement segments audio du commercial:', error)
        if (active) setRecordingSegments([])
      })

    return () => {
      active = false
    }
  }, [id])

  // Utiliser le hook pour calculer les stats personnelles du commercial
  const { personalStats } = usePersonalStats(commercial, appliedStartDate, appliedEndDate)

  // Calculer les stats globales depuis le backend (source de vérité)
  const backendStats = useMemo(() => {
    if (!commercial?.statistics) return null
    
    const { contratsSignes, immeublesVisites, rendezVousPris, refus } = aggregateStats(commercial.statistics)
    return {
      totalContratsSignes: contratsSignes,
      totalImmeublesVisites: immeublesVisites,
      totalRendezVousPris: rendezVousPris,
      totalRefus: refus,
      totalAbsents: commercial.statistics.reduce((sum, stat) => sum + (stat.absents || 0), 0),
      totalArgumentes: commercial.statistics.reduce((sum, stat) => sum + (stat.argumentes || 0), 0),
      totalPortesProspectes: commercial.statistics.reduce((sum, stat) => sum + (stat.nbPortesProspectes || 0), 0),
      totalImmeublesProspectes: commercial.statistics.reduce((sum, stat) => sum + (stat.nbImmeublesProspectes || 0), 0),
    }
  }, [commercial?.statistics])

  // Calculer le rang du commercial basé sur TOUTES ses stats (non filtrées)
  const memoizedCommercialRank = useMemo(() => {
    if (!backendStats) return null
    return calculateRank(
      backendStats.totalContratsSignes,
      backendStats.totalRendezVousPris,
      backendStats.totalImmeublesVisites
    )
  }, [backendStats])

  const lastStatusActivity = useMemo(() => {
    return (lastStatusActivities || []).find(
      activity => activity.userType === 'commercial' && activity.userId === parseInt(id)
    )
  }, [id, lastStatusActivities])

  // Préparer les données pour l'affichage
  const commercialData = useMemo(() => {
    if (!commercial) return null

    const manager = managers?.find(m => m.id === commercial.managerId)
    const managerName = manager ? `${manager.prenom} ${manager.nom}` : 'Aucun manager assigné'

    // Utiliser les stats du backend par défaut, sauf si un filtre de date est appliqué
    const hasDateFilter = appliedStartDate || appliedEndDate
    const statsSource = (!hasDateFilter && backendStats) ? backendStats : personalStats

    return {
      ...commercial,
      name: `${commercial.prenom} ${commercial.nom}`,
      managerName,
      totalContratsSignes: statsSource.totalContratsSignes,
      totalImmeublesVisites: statsSource.totalImmeublesVisites,
      totalRendezVousPris: statsSource.totalRendezVousPris,
      totalRefus: statsSource.totalRefus,
      totalAbsents: statsSource.totalAbsents,
      totalArgumentes: statsSource.totalArgumentes,
      totalPortesProspectes: statsSource.totalPortesProspectes,
      totalImmeublesProspectes: statsSource.totalImmeublesProspectes,
      zonesCount: currentZone ? 1 : 0,
      immeublesCount: commercial.immeubles?.length || 0,
      rank: memoizedCommercialRank?.rank,
      points: memoizedCommercialRank?.points,
      lastStatusActivity,
    }
  }, [commercial, managers, personalStats, backendStats, memoizedCommercialRank, currentZone, appliedStartDate, appliedEndDate, lastStatusActivity])

  // Préparer les zones
  const assignedZones = useMemo(() => {
    if (!currentZone) return []

    const immeublesCreatedByCommercial = currentZone.zone?.immeubles?.filter(
      imm => imm.commercialId === commercial?.id
    ) || []

    return [
      {
        ...currentZone.zone,
        immeubles: immeublesCreatedByCommercial,
        assignmentDate: currentZone.assignedAt,
        immeublesCount: immeublesCreatedByCommercial.length,
      },
    ]
  }, [currentZone, commercial?.id])

  // Données des immeubles
  const allImmeublesTableData = useImmeublesTableData(
    commercial?.immeubles,
    appliedStartDate,
    appliedEndDate
  )

  const immeublesTableData = useMemo(() => {
    if (!allImmeublesTableData) return []
    if (!appliedImmeubleStartDate && !appliedImmeubleEndDate) return allImmeublesTableData

    return allImmeublesTableData.filter(immeuble => {
      const dateToCompare = immeubleDateType === 'created'
        ? new Date(immeuble.createdAt)
        : new Date(immeuble.visitedAt || immeuble.createdAt)

      if (appliedImmeubleStartDate) {
        const startDateObj = new Date(appliedImmeubleStartDate)
        startDateObj.setHours(0, 0, 0, 0)
        if (dateToCompare < startDateObj) return false
      }

      if (appliedImmeubleEndDate) {
        const endDateObj = new Date(appliedImmeubleEndDate)
        endDateObj.setHours(23, 59, 59, 999)
        if (dateToCompare > endDateObj) return false
      }

      return true
    })
  }, [allImmeublesTableData, appliedImmeubleStartDate, appliedImmeubleEndDate, immeubleDateType])

  // Données des portes
  const allPortes = useFilteredPortes(commercial?.immeubles, appliedStartDate, appliedEndDate)

  const porteSegmentCounts = useMemo(() => {
    const counts = new Map()
    recordingSegments.forEach(segment => {
      if (!segment.porteId) return
      counts.set(segment.porteId, (counts.get(segment.porteId) || 0) + 1)
    })
    return counts
  }, [recordingSegments])

  // Colonnes des portes
  const doorsColumns = [
    {
      header: 'Porte',
      accessor: 'number',
      sortable: true,
      className: 'font-medium',
    },
    {
      header: 'Adresse',
      accessor: 'address',
      sortable: true,
      className: 'text-sm',
    },
    {
      header: 'Étage',
      accessor: 'etage',
      sortable: true,
      className: 'text-sm',
    },
    {
      header: 'Statut',
      accessor: 'status',
      sortable: true,
      cell: row => {
        const normalizedStatus = row.status?.toUpperCase()
        const label = getStatusLabel(normalizedStatus)
        const colorClasses = getStatusColor(normalizedStatus)
        return <Badge className={colorClasses}>{label}</Badge>
      },
    },
    {
      header: 'RDV',
      accessor: 'rdvDate',
      sortable: true,
      cell: row => {
        if (row.rdvDate && row.rdvTime) {
          return (
            <div className="text-sm">
              <div>{row.rdvDate}</div>
              <div className="text-muted-foreground">{row.rdvTime}</div>
            </div>
          )
        }
        return <span className="text-muted-foreground">-</span>
      },
    },
    {
      header: 'Dernière visite',
      accessor: 'lastVisit',
      sortable: true,
      cell: row => row.visitedAt || <span className="text-muted-foreground">-</span>,
    },
    {
      header: 'Audio',
      accessor: 'audio',
      sortable: false,
      className: 'text-center',
      cell: row => {
        const count = porteSegmentCounts.get(row.porteId) || 0
        if (!count || !row.immeubleId) return <span className="text-muted-foreground">-</span>

        return (
          <span
            className="inline-flex items-center justify-center gap-1 text-primary"
            title={`${count} audio${count > 1 ? 's' : ''} disponible${count > 1 ? 's' : ''}. Clique la ligne pour ouvrir les détails.`}
          >
            <Mic className="h-4 w-4" />
            <span className="text-sm font-medium">{count}</span>
          </span>
        )
      },
    },
  ]

  // Colonnes des immeubles
  const immeublesColumns = [
    {
      header: 'Adresse',
      accessor: 'address',
      sortable: true,
      className: 'font-medium',
    },
    {
      header: 'Étages',
      accessor: 'floors',
      className: 'hidden md:table-cell text-center',
      cell: row => `${row.floors} étages`,
    },
    {
      header: 'Total Portes',
      accessor: 'total_doors',
      className: 'hidden lg:table-cell text-center',
    },
    {
      header: 'Couverture',
      accessor: 'couverture',
      sortable: true,
      className: 'hidden lg:table-cell text-center',
      cell: row => {
        const couverture = row.couverture || 0
        const colorClass =
          couverture >= 80
            ? 'bg-green-100 text-green-800'
            : couverture >= 50
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
        return <Badge className={colorClass}>{couverture}%</Badge>
      },
    },
    {
      header: 'Contrats signés',
      accessor: 'contrats_signes',
      sortable: true,
      className: 'text-center',
      cell: row => (
        <Badge className="bg-green-100 text-green-800">{row.contrats_signes || 0}</Badge>
      ),
    },
    {
      header: 'RDV pris',
      accessor: 'rdv_pris',
      sortable: true,
      className: 'hidden xl:table-cell text-center',
      cell: row => <Badge className="bg-blue-100 text-blue-800">{row.rdv_pris || 0}</Badge>,
    },
    {
      header: 'Refus',
      accessor: 'refus',
      sortable: true,
      className: 'hidden xl:table-cell text-center',
      cell: row => <Badge className="bg-red-100 text-red-800">{row.refus || 0}</Badge>,
    },
    {
      header: 'Absents',
      accessor: 'absent',
      sortable: true,
      className: 'hidden xl:table-cell text-center',
      cell: row => <Badge className="bg-blue-100 text-blue-800">{row.absent || 0}</Badge>,
    },
    {
      header: 'Argumentés',
      accessor: 'argumente',
      sortable: true,
      className: 'hidden xl:table-cell text-center',
      cell: row => <Badge className="bg-orange-100 text-orange-800">{row.argumente || 0}</Badge>,
    },
  ]

  // Construction des objets props pour la vue
  const personalInfo = commercialData ? [
    {
      label: 'Email',
      value: commercialData.email,
      icon: 'mail',
    },
    {
      label: 'Téléphone',
      value: commercialData.numTel || 'Non renseigné',
      icon: 'phone',
    },
    {
      label: 'Age',
      value: commercialData.age == null ? 'Non renseigné' : `${commercialData.age} ans`,
      icon: 'user',
    },
    {
      label: 'Manager',
      value: commercialData.managerName,
      icon: 'users',
    },
    {
      label: 'Rang',
      value: (
        <span
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${commercialData.rank.bgColor} ${commercialData.rank.textColor} ${commercialData.rank.borderColor} border font-semibold`}
        >
          <span className="text-lg">🏆</span>
          {commercialData.rank.name}
          <span className="text-xs opacity-75">({commercialData.points} pts)</span>
        </span>
      ),
      icon: 'award',
    },
    {
      label: 'Date de création de compte',
      value: new Date(commercialData.createdAt).toLocaleDateString('fr-FR'),
      icon: 'calendar',
    },
  ] : []

  const statsCards = commercialData ? [
    {
      title: 'Points totaux',
      value: commercialData.points,
      description: 'Score personnel',
      icon: 'trendingUp',
      fullWidth: true,
    },
    {
      title: 'Dernière activité terrain',
      value: formatRelativeActivityDate(commercialData.lastStatusActivity?.changedAt),
      description: getActivityDescription(commercialData.lastStatusActivity),
      icon: 'shieldCheck',
      fullWidth: true,
    },
    {
      title: 'Contrats signés',
      value: commercialData.totalContratsSignes,
      description: 'Total des contrats signés',
      icon: 'fileText',
    },
    {
      title: 'Rendez-vous pris',
      value: commercialData.totalRendezVousPris,
      description: 'Total des rendez-vous',
      icon: 'calendar',
    },
    {
      title: 'Immeubles visités',
      value: commercialData.totalImmeublesVisites,
      description: 'Total des immeubles visités',
      icon: 'building',
    },
    {
      title: 'Refus',
      value: commercialData.totalRefus,
      description: 'Total des refus',
      icon: 'x',
    },
    {
      title: 'Absents',
      value: commercialData.totalAbsents,
      description: 'Portes où personne n\'était présent',
      icon: 'userX',
    },
    {
      title: 'Argumentés',
      value: commercialData.totalArgumentes,
      description: 'Refus après argumentation',
      icon: 'messageCircle',
    },
    {
      title: 'Portes prospectées',
      value: commercialData.totalPortesProspectes,
      description: 'Total des portes prospectées',
      icon: 'fileText',
    },
    {
      title: 'Immeubles prospectés',
      value: commercialData.totalImmeublesProspectes,
      description: 'Total des immeubles prospectés',
      icon: 'building',
    },
  ] : []

  const additionalSections = [
    {
      title: 'Statistiques de prospection',
      description: "Analyse de l'activité de prospection",
      type: 'custom',
      component: 'ChartsSection',
      data: {
        charts: [
          {
            type: 'PortesStatusChart',
            props: {
              portes: allPortes || [],
              title: 'Répartition des statuts',
              description: 'État actuel de toutes les portes',
              showNonVisited: true,
            },
          },
          {
            type: 'PortesProspectionChart',
            props: {
              portes: allPortes || [],
              title: 'Portes prospectées par jour',
              description: 'Activité quotidienne des 7 derniers jours',
              daysToShow: 7,
            },
          },
          {
            type: 'PortesWeeklyChart',
            props: {
              portes: allPortes || [],
              title: 'Évolution hebdomadaire',
              description: 'Tendance sur les 4 dernières semaines',
              weeksToShow: 4,
            },
          },
        ],
      },
    },
    {
      title: 'Immeubles prospectés',
      description: 'Liste des immeubles prospectés par ce commercial avec leurs statistiques',
      type: 'custom',
      component: 'ImmeublesTable',
      data: {
        immeubles: immeublesTableData,
        columns: immeublesColumns,
        nestedColumns: doorsColumns,
        showFilters: false,
      },
      customFilter: (
        <DateRangeFilter
          className="h-fit"
          startDate={immeubleDateFilter.startDate}
          endDate={immeubleDateFilter.endDate}
          appliedStartDate={appliedImmeubleStartDate}
          appliedEndDate={appliedImmeubleEndDate}
          onChangeStart={immeubleDateFilter.setStartDate}
          onChangeEnd={immeubleDateFilter.setEndDate}
          onApply={immeubleDateFilter.handleApplyFilters}
          onReset={immeubleDateFilter.handleResetFilters}
          title="Filtrer les immeubles"
          showDateTypeSelector={true}
          dateType={immeubleDateType}
          onDateTypeChange={setImmeubleDateType}
        />
      ),
    },
    {
      title: 'Enregistrements audio',
      description: 'Ecoute et telechargement des enregistrements de ce commercial',
      type: 'custom',
      render: () => (
        <UserRecordingsSection
          userId={commercialData?.id}
          userType="commercial"
          userName={commercialData?.name}
        />
      ),
    },
  ]

  return {
    commercialData,
    loading,
    error,
    assignedZones,
    personalInfo,
    statsCards,
    additionalSections,
    dateFilter, // To be destructured in view for main filter
  }
}
