import { useParams } from 'react-router-dom'
import {
  useCommercialFull,
  useManagers,
  useCurrentZoneAssignment,
  useTeamLastStatusActivities,
} from '@/services'
import { useEffect, useMemo, useState } from 'react'
import { aggregateStats } from '@/utils/business/ranks'
import { useCommercialRankings } from '@/hooks/metier/api/gamification'
import { pickMonthlySnapshot, toRankInfo } from '@/lib/rank-wps'
import { Badge } from '@/components/ui/badge'
import { BuildingTypeBadge } from '@/components/BuildingTypeBadge'
import DateRangeFilter from '@/components/DateRangeFilter'
import { useDateFilter } from '@/hooks/utils/filters/useDateFilter'
import { buildingDoorCount } from '@/constants/domain/habitat'
import { porteApi } from '@/services/api/portes/porte.service'
import { buildFacadeFloors } from '@/pages-ADMIN-DIRECTEUR/immeubles/facade-data'
import CommercialTrajetsSection from './components/CommercialTrajetsSection'
import CommercialZoneHistorySection from './components/CommercialZoneHistorySection'
import CommercialContratsSection from './components/CommercialContratsSection'
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
  const { appliedStartDate: appliedImmeubleStartDate, appliedEndDate: appliedImmeubleEndDate } =
    immeubleDateFilter

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

    const { contratsSignes, immeublesVisites, rendezVousPris, refus } = aggregateStats(
      commercial.statistics
    )
    return {
      totalContratsSignes: contratsSignes,
      totalImmeublesVisites: immeublesVisites,
      totalRendezVousPris: rendezVousPris,
      totalRefus: refus,
      totalAbsents: commercial.statistics.reduce((sum, stat) => sum + (stat.absents || 0), 0),
      totalArgumentes: commercial.statistics.reduce((sum, stat) => sum + (stat.argumentes || 0), 0),
      totalPortesProspectes: commercial.statistics.reduce(
        (sum, stat) => sum + (stat.nbPortesProspectes || 0),
        0
      ),
      totalImmeublesProspectes: commercial.statistics.reduce(
        (sum, stat) => sum + (stat.nbImmeublesProspectes || 0),
        0
      ),
    }
  }, [commercial?.statistics])

  // Rang = classement mensuel WinLeadPlus (source de vérité gamification),
  // aligné sur le mobile. Repli Bronze/0 si non classé ce mois.
  const { data: rankings } = useCommercialRankings(parseInt(id))
  const rankInfo = useMemo(() => toRankInfo(pickMonthlySnapshot(rankings)), [rankings])

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
    const statsSource = !hasDateFilter && backendStats ? backendStats : personalStats

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
      rank: rankInfo,
      points: rankInfo.points,
      lastStatusActivity,
    }
  }, [
    commercial,
    managers,
    personalStats,
    backendStats,
    rankInfo,
    currentZone,
    appliedStartDate,
    appliedEndDate,
    lastStatusActivity,
  ])

  // Préparer les zones
  const assignedZones = useMemo(() => {
    if (!currentZone) return []

    const immeublesCreatedByCommercial =
      currentZone.zone?.immeubles?.filter(imm => imm.commercialId === commercial?.id) || []

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
      const dateToCompare =
        immeubleDateType === 'created'
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
  // Capacité déclarée (grille) = dénominateur de la couverture (Option A).
  const totalDoorsGrid = (commercial?.immeubles || []).reduce(
    (sum, immeuble) => sum + buildingDoorCount(immeuble),
    0
  )

  // 1 enregistrement par porte : on garde le segment le plus long si plusieurs
  // remontent (robustesse), c'est celui qui porte le vrai signal.
  const porteSegmentMap = useMemo(() => {
    const map = new Map()
    recordingSegments.forEach(segment => {
      if (!segment.porteId) return
      const existing = map.get(segment.porteId)
      if (!existing || (segment.durationSec || 0) > (existing.durationSec || 0)) {
        map.set(segment.porteId, segment)
      }
    })
    return map
  }, [recordingSegments])

  // Bâtiment sélectionné → façade affichée en modal (clic sur une ligne du tableau).
  const rawImmeublesById = useMemo(() => {
    const map = new Map()
    ;(commercial?.immeubles || []).forEach(imm => map.set(imm.id, imm))
    return map
  }, [commercial?.immeubles])

  const [selectedImmeubleId, setSelectedImmeubleId] = useState(null)

  const selectedFacade = useMemo(() => {
    const imm = rawImmeublesById.get(selectedImmeubleId)
    if (!imm) return null
    return buildFacadeFloors(imm, imm.portes || [], porteSegmentMap)
  }, [rawImmeublesById, selectedImmeubleId, porteSegmentMap])

  const handleImmeubleClick = row => setSelectedImmeubleId(row.id)

  // Colonnes des immeubles
  const immeublesColumns = [
    {
      header: 'Adresse',
      accessor: 'address',
      sortable: true,
      className: 'font-medium',
    },
    {
      header: 'Type',
      accessor: 'type',
      sortable: true,
      className: 'hidden md:table-cell',
      cell: row => <BuildingTypeBadge type={row.type} className="text-[10px]" />,
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
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
            : couverture >= 50
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
              : 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300'
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
  const personalInfo = commercialData
    ? [
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
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border font-semibold ${commercialData.rank.badgeClasses}`}
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
      ]
    : []

  const statsCards = commercialData
    ? [
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
          title: 'Bâtiments visités',
          value: commercialData.totalImmeublesVisites,
          description: 'Total des bâtiments visités',
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
          description: "Portes où personne n'était présent",
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
          title: 'Bâtiments prospectés',
          value: commercialData.totalImmeublesProspectes,
          description: 'Total des bâtiments prospectés',
          icon: 'building',
        },
      ]
    : []

  const additionalSections = [
    {
      title: 'Historique des zones',
      description: 'Zones précédemment attribuées à ce commercial',
      type: 'custom',
      render: () =>
        commercialData?.id ? (
          <CommercialZoneHistorySection commercialId={commercialData.id} />
        ) : null,
    },
    {
      title: 'Statistiques de prospection',
      description: "Analyse de l'activité de prospection",
      type: 'custom',
      component: 'ChartsSection',
      data: {
        totalDoors: totalDoorsGrid,
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
      title: 'Trajets',
      description: 'Trajet GPS du commercial (par jour)',
      type: 'custom',
      bare: true,
      render: () =>
        commercialData?.id ? (
          <CommercialTrajetsSection
            commercialId={commercialData.id}
            commercialName={commercialData.name}
          />
        ) : null,
    },
    {
      title: 'Bâtiments prospectés',
      description: 'Liste des bâtiments prospectés par ce commercial avec leurs statistiques',
      type: 'custom',
      component: 'ImmeublesTable',
      data: {
        immeubles: immeublesTableData,
        columns: immeublesColumns,
        showFilters: false,
        onImmeubleClick: handleImmeubleClick,
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
          title="Filtrer les bâtiments"
          showDateTypeSelector={true}
          dateType={immeubleDateType}
          onDateTypeChange={setImmeubleDateType}
        />
      ),
    },
    {
      title: 'Contrats signés (WinLeadPlus)',
      description: 'Contrats confirmés côté CRM (source fiable) — offre, date, points',
      type: 'custom',
      render: () =>
        commercialData?.id ? <CommercialContratsSection commercialId={commercialData.id} /> : null,
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
    buildingModal: {
      facade: selectedFacade,
      open: Boolean(selectedFacade),
      onOpenChange: openState => {
        if (!openState) setSelectedImmeubleId(null)
      },
    },
  }
}
