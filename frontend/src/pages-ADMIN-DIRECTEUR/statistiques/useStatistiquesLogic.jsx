import { useEffect, useMemo, useRef, useState } from 'react'
import { useRole } from '@/contexts/userole'
import {
  useCommercials,
  useContratsValidesAggregate,
  useManagers,
  useProspectionPipeline,
  useStatsActivityByOwner,
  useStatsEffort,
  useStatsPeriodComparison,
  useStatsTimeline,
  useZoneStatistics,
} from '@/services'
import { useRoleBasedData } from '@/hooks/metier/permissions/useRoleBasedData'
import { useDateFilter } from '@/hooks/utils/filters/useDateFilter'
import { UserStatus } from '@/constants/domain/user-status'
import CoachingService from '@/services/coaching/coaching.service'
import { defaultRange, granularityForRange, toIsoEnd, toIsoStart } from './stats-period'

export const SCOPE_FILTERS = [
  { value: 'all', label: 'Toute l’équipe' },
  { value: 'commercials', label: 'Commerciaux' },
  { value: 'managers', label: 'Managers' },
]

const isProductionUser = user => user?.status !== UserStatus.UTILISATEUR_TEST

const fullName = (person, fallbackLabel, id) =>
  `${person?.prenom || ''} ${person?.nom || ''}`.trim() || `${fallbackLabel} #${id}`

const parseOwnerSelection = selectedOwner => {
  if (!selectedOwner || selectedOwner === 'all') {
    return { ownerType: undefined, ownerId: undefined }
  }

  const [type, rawId] = selectedOwner.split(':')
  const ownerId = Number(rawId)
  if (!Number.isFinite(ownerId)) return { ownerType: undefined, ownerId: undefined }

  return { ownerType: type, ownerId }
}

export function useStatistiquesLogic() {
  const { currentRole } = useRole()
  const dateFilter = useDateFilter()
  const [scopeType, setScopeType] = useState('all')
  const [selectedOwner, setSelectedOwner] = useState('all')

  // Le filtre démarre sur les 30 derniers jours : sans bornes, il n'existe pas de
  // période précédente et la page perdrait tous ses écarts.
  const { handleApplyFilters } = dateFilter
  useEffect(() => {
    const { start, end } = defaultRange()
    handleApplyFilters(start, end)
    // Volontairement au montage uniquement : ensuite c'est l'utilisateur qui pilote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { appliedStartDate, appliedEndDate } = dateFilter
  const ownerSelection = useMemo(() => parseOwnerSelection(selectedOwner), [selectedOwner])

  const startIso = useMemo(() => toIsoStart(appliedStartDate), [appliedStartDate])
  const endIso = useMemo(() => toIsoEnd(appliedEndDate), [appliedEndDate])
  const granularity = useMemo(() => granularityForRange(startIso, endIso), [startIso, endIso])

  const filters = useMemo(
    () => ({
      scopeType,
      ownerType: ownerSelection.ownerType,
      ownerId: ownerSelection.ownerId,
      startDate: startIso,
      endDate: endIso,
    }),
    [scopeType, ownerSelection.ownerType, ownerSelection.ownerId, startIso, endIso]
  )

  const contratsFilters = useMemo(() => ({ ...filters, granularity }), [filters, granularity])

  /**
   * Le pipeline est un **stock** : il ne reçoit que le périmètre, jamais les bornes de
   * dates. « Combien de portes attendent un repassage » se lit maintenant, pas sur les
   * 30 derniers jours.
   */
  const pipelineFilters = useMemo(
    () => ({
      scopeType,
      ownerType: ownerSelection.ownerType,
      ownerId: ownerSelection.ownerId,
    }),
    [scopeType, ownerSelection.ownerType, ownerSelection.ownerId]
  )

  const {
    data: comparison,
    loading: comparisonLoading,
    error: comparisonError,
  } = useStatsPeriodComparison(filters)

  const {
    data: timeline,
    loading: timelineLoading,
    error: timelineError,
  } = useStatsTimeline(filters)

  const {
    data: ownerActivity,
    loading: ownerActivityLoading,
    error: ownerActivityError,
  } = useStatsActivityByOwner(filters)

  const { data: effort, loading: effortLoading, error: effortError } = useStatsEffort(filters)

  const {
    data: contratsValides,
    loading: contratsValidesLoading,
    error: contratsValidesError,
  } = useContratsValidesAggregate(contratsFilters)

  const {
    data: pipeline,
    loading: pipelineLoading,
    error: pipelineError,
  } = useProspectionPipeline(pipelineFilters)

  const { data: zoneStats, loading: zoneStatsLoading, error: zoneStatsError } = useZoneStatistics()
  const { data: rawCommercials, loading: commercialsLoading } = useCommercials()
  const { data: rawManagers, loading: managersLoading } = useManagers()

  const filteredCommercials = useRoleBasedData('commerciaux', rawCommercials)
  const filteredManagers = useRoleBasedData('managers', rawManagers)

  const productionCommercials = useMemo(
    () => (filteredCommercials || []).filter(isProductionUser),
    [filteredCommercials]
  )
  const productionManagers = useMemo(
    () => (filteredManagers || []).filter(isProductionUser),
    [filteredManagers]
  )

  /** Options du sélecteur d'intervenant, restreintes au périmètre courant. */
  const ownerOptions = useMemo(() => {
    const options = []

    if (scopeType === 'all' || scopeType === 'commercials') {
      productionCommercials.forEach(commercial => {
        options.push({
          value: `commercial:${commercial.id}`,
          label: fullName(commercial, 'Commercial', commercial.id),
        })
      })
    }

    if (scopeType === 'all' || scopeType === 'managers') {
      productionManagers.forEach(manager => {
        options.push({
          value: `manager:${manager.id}`,
          label: fullName(manager, 'Manager', manager.id),
        })
      })
    }

    return options.sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [productionCommercials, productionManagers, scopeType])

  // Changer de périmètre peut rendre l'intervenant sélectionné hors-champ.
  useEffect(() => {
    if (selectedOwner === 'all') return
    if (!ownerOptions.some(option => option.value === selectedOwner)) {
      setSelectedOwner('all')
    }
  }, [ownerOptions, selectedOwner])

  // ── Comparatif de scoring coaching ────────────────────────────────────────
  // Réservé aux rôles admin/directeur côté backend : un échec de permission ne
  // doit pas faire tomber la page, il se traduit par une section vide.
  const [scoreboard, setScoreboard] = useState(null)
  const [scoreboardLoading, setScoreboardLoading] = useState(true)

  useEffect(() => {
    let active = true
    setScoreboardLoading(true)
    CoachingService.scoreboard(startIso, endIso)
      .then(data => {
        if (active) setScoreboard(data)
      })
      .finally(() => {
        if (active) setScoreboardLoading(false)
      })

    return () => {
      active = false
    }
  }, [startIso, endIso])

  const fetching =
    comparisonLoading ||
    timelineLoading ||
    ownerActivityLoading ||
    effortLoading ||
    contratsValidesLoading ||
    pipelineLoading ||
    zoneStatsLoading ||
    commercialsLoading ||
    managersLoading

  /**
   * Seul le tout premier chargement remplace la page par un squelette.
   *
   * `useApiCall` met `isFetching` dans son `loading`, donc chaque application de
   * filtre repasse les huit requêtes en chargement. Gater la page entière sur ce
   * drapeau ferait clignoter tout l'écran à chaque changement de période — sur une
   * page pilotée par ses filtres, c'est le geste le plus fréquent. Les cartes
   * gardent donc leurs valeurs pendant le rafraîchissement.
   */
  const hasLoadedOnce = useRef(false)
  if (!fetching) hasLoadedOnce.current = true
  const loading = fetching && !hasLoadedOnce.current

  const error =
    comparisonError ||
    timelineError ||
    ownerActivityError ||
    effortError ||
    contratsValidesError ||
    pipelineError ||
    zoneStatsError

  const activeFiltersCount = (scopeType !== 'all' ? 1 : 0) + (selectedOwner !== 'all' ? 1 : 0)

  const resetScope = () => {
    setScopeType('all')
    setSelectedOwner('all')
  }

  const periodLabel = useMemo(() => {
    if (!appliedStartDate && !appliedEndDate) return 'Toute la période'
    const format = value =>
      value ? new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '…'
    return `${format(appliedStartDate)} → ${format(appliedEndDate)}`
  }, [appliedStartDate, appliedEndDate])

  const scopeLabel = useMemo(() => {
    if (selectedOwner !== 'all') {
      return ownerOptions.find(option => option.value === selectedOwner)?.label || 'Intervenant'
    }
    return SCOPE_FILTERS.find(filter => filter.value === scopeType)?.label || 'Toute l’équipe'
  }, [ownerOptions, scopeType, selectedOwner])

  return {
    loading,
    // Rafraîchissement en cours alors que des données sont déjà affichées : la page
    // le signale discrètement plutôt que de se vider.
    fetching: fetching && hasLoadedOnce.current,
    error,
    dateFilter,
    scopeType,
    setScopeType,
    selectedOwner,
    setSelectedOwner,
    ownerOptions,
    activeFiltersCount,
    resetScope,
    periodLabel,
    scopeLabel,
    granularity,
    currentRole,
    // Données
    current: comparison?.current || null,
    previous: comparison?.previous || null,
    timeline: timeline || [],
    ownerActivity: ownerActivity || [],
    effort: effort || null,
    contratsValides: contratsValides || null,
    pipeline: pipeline || null,
    zoneStats: zoneStats || [],
    scoreboard,
    scoreboardLoading,
    productionCommercials,
    productionManagers,
  }
}
