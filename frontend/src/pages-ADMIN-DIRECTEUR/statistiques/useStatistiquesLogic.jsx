import { useState, useMemo, useEffect } from 'react'
import { useRole } from '@/contexts/userole'
import {
  useStatistics,
  useCommercials,
  useDirecteurs,
  useManagers,
  useZoneStatistics,
  useTeamLastStatusActivities,
  useStatsTimeline,
  useStatsActivityByOwner,
} from '@/services'
import { useRoleBasedData } from '@/hooks/metier/permissions/useRoleBasedData'
import { Clock, CalendarDays } from 'lucide-react'

export const TIME_FILTERS = [
  { value: '7d', label: '7 derniers jours', shortLabel: '7j', icon: Clock },
  { value: '30d', label: '30 derniers jours', shortLabel: '30j', icon: CalendarDays },
  { value: '90d', label: '3 derniers mois', shortLabel: '90j', icon: CalendarDays },
  { value: '1y', label: 'Cette année', shortLabel: 'Année', icon: CalendarDays },
  { value: 'all', label: 'Toute la période', shortLabel: 'Tout', icon: CalendarDays },
]

export const SCOPE_FILTERS = [
  { value: 'all', label: 'Toute l’équipe' },
  { value: 'commercials', label: 'Commerciaux' },
  { value: 'managers', label: 'Managers' },
]

const STATUS_LABELS = {
  contratsSignes: 'Contrats signés',
  rendezVousPris: 'Rendez-vous pris',
  refus: 'Refus',
  absents: 'Absents',
  argumentes: 'Argumentés',
  repassages: 'Repassages',
}

const TEST_USER_STATUS = 'UTILISATEUR_TEST'

export const ACTIVITY_STATUS_LABELS = {
  CONTRAT_SIGNE: 'Contrat signé',
  RENDEZ_VOUS_PRIS: 'Rendez-vous pris',
  REFUS: 'Refus',
  ABSENT: 'Absent',
  ARGUMENTE: 'Argumenté',
  NECESSITE_REPASSAGE: 'Repassage nécessaire',
  NON_VISITE: 'Non visité',
}

const roundRate = value => Math.round(value * 10) / 10

const emptyTotals = {
  contratsSignes: 0,
  rendezVousPris: 0,
  refus: 0,
  absents: 0,
  argumentes: 0,
  repassages: 0,
  nbImmeubles: 0,
  nbImmeublesProspectes: 0,
  nbPortesProspectes: 0,
}

const startOfDay = date => {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

const endOfDay = date => {
  const value = new Date(date)
  value.setHours(23, 59, 59, 999)
  return value
}

const addDays = (date, days) => {
  const value = new Date(date)
  value.setDate(value.getDate() + days)
  return value
}

const getDateRange = period => {
  const now = new Date()
  const end = endOfDay(now)

  if (period === 'all') {
    return { startDate: null, endDate: null, daysToShow: 365 }
  }

  if (period === '1y') {
    return {
      startDate: startOfDay(new Date(now.getFullYear(), 0, 1)),
      endDate: end,
      daysToShow: Math.max(
        1,
        Math.ceil(
          (end.getTime() - startOfDay(new Date(now.getFullYear(), 0, 1)).getTime()) / 86400000
        )
      ),
    }
  }

  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  return {
    startDate: startOfDay(addDays(now, -(days - 1))),
    endDate: end,
    daysToShow: days,
  }
}

const toIsoOrUndefined = date => (date ? date.toISOString() : undefined)

const isProductionUser = user => user?.status !== TEST_USER_STATUS

const parseOwnerSelection = selectedOwner => {
  if (!selectedOwner || selectedOwner === 'all') {
    return { ownerType: undefined, ownerId: undefined }
  }

  const [type, rawId] = selectedOwner.split(':')
  const ownerId = Number(rawId)
  if (!Number.isFinite(ownerId)) {
    return { ownerType: undefined, ownerId: undefined }
  }

  return { ownerType: type, ownerId }
}

const sumAggregateStats = stats =>
  (stats || []).reduce(
    (acc, stat) => ({
      contratsSignes: acc.contratsSignes + (stat.contratsSignes || 0),
      rendezVousPris: acc.rendezVousPris + (stat.rendezVousPris || 0),
      refus: acc.refus + (stat.refus || 0),
      absents: acc.absents + (stat.absents || 0),
      argumentes: acc.argumentes + (stat.argumentes || 0),
      repassages: acc.repassages,
      nbImmeubles: acc.nbImmeubles + (stat.immeublesVisites || 0),
      nbImmeublesProspectes: acc.nbImmeublesProspectes + (stat.nbImmeublesProspectes || 0),
      nbPortesProspectes: acc.nbPortesProspectes + (stat.nbPortesProspectes || 0),
    }),
    { ...emptyTotals }
  )

const sumActivityStats = activityStats =>
  (activityStats || []).reduce(
    (acc, stat) => ({
      contratsSignes: acc.contratsSignes + (stat.contratsSignes || 0),
      rendezVousPris: acc.rendezVousPris + (stat.rendezVousPris || 0),
      refus: acc.refus + (stat.refus || 0),
      absents: acc.absents + (stat.absents || 0),
      argumentes: acc.argumentes + (stat.argumentes || 0),
      repassages: acc.repassages + (stat.repassages || 0),
      nbImmeubles: acc.nbImmeubles,
      nbImmeublesProspectes: acc.nbImmeublesProspectes,
      nbPortesProspectes: acc.nbPortesProspectes + (stat.nbPortesProspectes || 0),
    }),
    { ...emptyTotals }
  )

const buildMetrics = (totals, context) => {
  const opportunities = totals.contratsSignes + totals.rendezVousPris + totals.refus
  const contacted = totals.contratsSignes + totals.rendezVousPris + totals.refus + totals.argumentes
  const actionsTerrain =
    totals.contratsSignes +
    totals.rendezVousPris +
    totals.refus +
    totals.absents +
    totals.argumentes +
    totals.repassages

  return {
    ...totals,
    ...context,
    actionsTerrain,
    tauxConversion:
      opportunities > 0 ? roundRate((totals.contratsSignes / opportunities) * 100) : 0,
    tauxContact:
      totals.nbPortesProspectes > 0 ? roundRate((contacted / totals.nbPortesProspectes) * 100) : 0,
    tauxRdv:
      totals.nbPortesProspectes > 0
        ? roundRate((totals.rendezVousPris / totals.nbPortesProspectes) * 100)
        : 0,
  }
}

const buildTimelineData = (timeline, timePeriod, dateRange) => {
  const safeTimeline = timeline || []
  const byDay = new Map(
    safeTimeline.map(point => [new Date(point.date).toISOString().slice(0, 10), point])
  )
  const count = Math.min(dateRange.daysToShow || 365, 365)
  const end = dateRange.endDate || endOfDay(new Date())
  const start = dateRange.startDate || startOfDay(addDays(end, -(count - 1)))
  const days = []

  for (let i = 0; i < count; i++) {
    const date = addDays(start, i)
    const key = date.toISOString().slice(0, 10)
    const point = byDay.get(key)

    days.push({
      key,
      label:
        timePeriod === '1y' || timePeriod === 'all'
          ? date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
          : date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      contratsSignes: point?.contratsSignes || 0,
      rendezVousPris: point?.rdvPris || 0,
      refus: point?.refus || 0,
      absents: point?.absents || 0,
      argumentes: point?.argumentes || 0,
      repassages: point?.repassages || 0,
      portesProspectees: point?.portesProspectees || 0,
    })
  }

  return days
}

export function useStatistiquesLogic() {
  const { currentRole } = useRole()
  const [timePeriod, setTimePeriod] = useState('30d')
  const [scopeType, setScopeType] = useState('all')
  const [selectedOwner, setSelectedOwner] = useState('all')

  const dateRange = useMemo(() => getDateRange(timePeriod), [timePeriod])
  const ownerSelection = useMemo(() => parseOwnerSelection(selectedOwner), [selectedOwner])
  const activityFilters = useMemo(
    () => ({
      scopeType,
      ownerType: ownerSelection.ownerType,
      ownerId: ownerSelection.ownerId,
      startDate: toIsoOrUndefined(dateRange.startDate),
      endDate: toIsoOrUndefined(dateRange.endDate),
    }),
    [
      dateRange.endDate,
      dateRange.startDate,
      ownerSelection.ownerId,
      ownerSelection.ownerType,
      scopeType,
    ]
  )

  const {
    data: rawStatistics,
    loading: statisticsLoading,
    error: statisticsError,
  } = useStatistics()

  const {
    data: rawCommercials,
    loading: commercialsLoading,
    error: commercialsError,
  } = useCommercials()

  const {
    data: rawDirecteurs,
    loading: directeursLoading,
    error: directeursError,
  } = useDirecteurs()

  const { data: rawManagers, loading: managersLoading, error: managersError } = useManagers()

  const {
    data: zoneStatisticsData,
    loading: zoneStatsLoading,
    error: zoneStatsError,
  } = useZoneStatistics()

  const {
    data: rawLastStatusActivities,
    loading: lastActivitiesLoading,
    error: lastActivitiesError,
  } = useTeamLastStatusActivities()

  const {
    data: statsTimeline,
    loading: timelineLoading,
    error: timelineError,
  } = useStatsTimeline(activityFilters)

  const {
    data: ownerActivityStats,
    loading: ownerActivityLoading,
    error: ownerActivityError,
  } = useStatsActivityByOwner(activityFilters)

  const loading =
    statisticsLoading ||
    commercialsLoading ||
    directeursLoading ||
    managersLoading ||
    zoneStatsLoading ||
    lastActivitiesLoading ||
    timelineLoading ||
    ownerActivityLoading

  const error =
    statisticsError ||
    commercialsError ||
    directeursError ||
    managersError ||
    zoneStatsError ||
    lastActivitiesError ||
    timelineError ||
    ownerActivityError

  const filteredStatistics = useRoleBasedData('statistics', rawStatistics, {
    commercials: rawCommercials,
  })
  const filteredCommercials = useRoleBasedData('commerciaux', rawCommercials)
  const filteredDirecteurs = useRoleBasedData('directeurs', rawDirecteurs)
  const filteredManagers = useRoleBasedData('managers', rawManagers)

  const productionCommercials = useMemo(
    () => (filteredCommercials || []).filter(isProductionUser),
    [filteredCommercials]
  )
  const productionManagers = useMemo(
    () => (filteredManagers || []).filter(isProductionUser),
    [filteredManagers]
  )
  const productionDirecteurs = useMemo(
    () => (filteredDirecteurs || []).filter(isProductionUser),
    [filteredDirecteurs]
  )
  const productionCommercialIds = useMemo(
    () => new Set(productionCommercials.map(commercial => commercial.id)),
    [productionCommercials]
  )
  const productionManagerIds = useMemo(
    () => new Set(productionManagers.map(manager => manager.id)),
    [productionManagers]
  )

  const ownerOptions = useMemo(() => {
    const options = []

    if (scopeType === 'all' || scopeType === 'commercials') {
      productionCommercials.forEach(commercial => {
        options.push({
          value: `commercial:${commercial.id}`,
          label:
            `${commercial.prenom || ''} ${commercial.nom || ''}`.trim() ||
            `Commercial #${commercial.id}`,
          type: 'commercial',
        })
      })
    }

    if (scopeType === 'all' || scopeType === 'managers') {
      productionManagers.forEach(manager => {
        options.push({
          value: `manager:${manager.id}`,
          label: `${manager.prenom || ''} ${manager.nom || ''}`.trim() || `Manager #${manager.id}`,
          type: 'manager',
        })
      })
    }

    return options.sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [productionCommercials, productionManagers, scopeType])

  useEffect(() => {
    if (selectedOwner === 'all') return
    if (!ownerOptions.some(option => option.value === selectedOwner)) {
      setSelectedOwner('all')
    }
  }, [ownerOptions, selectedOwner])

  const scopedProductionStats = useMemo(() => {
    return (filteredStatistics || []).filter(stat => {
      const isCommercialStat = Boolean(stat.commercialId)
      const isManagerStat = Boolean(stat.managerId)

      if (!isCommercialStat && !isManagerStat) return false
      if (isCommercialStat && !productionCommercialIds.has(stat.commercialId)) return false
      if (isManagerStat && !productionManagerIds.has(stat.managerId)) return false

      const matchesScope =
        scopeType === 'all' ||
        (scopeType === 'commercials' && isCommercialStat) ||
        (scopeType === 'managers' && isManagerStat)

      if (!matchesScope) return false
      if (selectedOwner === 'all') return true

      const ownerKey = isCommercialStat
        ? `commercial:${stat.commercialId}`
        : `manager:${stat.managerId}`

      return ownerKey === selectedOwner
    })
  }, [filteredStatistics, productionCommercialIds, productionManagerIds, scopeType, selectedOwner])

  const scopedCommercials = useMemo(() => {
    if (scopeType === 'managers') return []
    if (selectedOwner.startsWith('manager:')) return []
    if (selectedOwner.startsWith('commercial:')) {
      const commercialId = selectedOwner.replace('commercial:', '')
      return productionCommercials.filter(commercial => String(commercial.id) === commercialId)
    }
    return productionCommercials
  }, [productionCommercials, scopeType, selectedOwner])

  const scopedManagers = useMemo(() => {
    if (scopeType === 'commercials') return []
    if (selectedOwner.startsWith('commercial:')) return []
    if (selectedOwner.startsWith('manager:')) {
      const managerId = selectedOwner.replace('manager:', '')
      return productionManagers.filter(manager => String(manager.id) === managerId)
    }
    return productionManagers
  }, [productionManagers, scopeType, selectedOwner])

  const scopedDirecteurs = useMemo(
    () => (scopeType === 'all' && selectedOwner === 'all' ? productionDirecteurs : []),
    [productionDirecteurs, scopeType, selectedOwner]
  )

  const aggregateTotals = useMemo(
    () => sumAggregateStats(scopedProductionStats),
    [scopedProductionStats]
  )
  const activityTotals = useMemo(() => sumActivityStats(ownerActivityStats), [ownerActivityStats])
  const hasPeriodActivity = Boolean(
    (ownerActivityStats || []).length || (statsTimeline || []).length
  )
  const useAggregateFallback = timePeriod === 'all' && !hasPeriodActivity
  const sourceTotals = useAggregateFallback ? aggregateTotals : activityTotals

  const metrics = useMemo(
    () =>
      buildMetrics(sourceTotals, {
        nbCommerciaux: scopedCommercials?.length || 0,
        nbManagers: scopedManagers?.length || 0,
        nbIntervenants: (scopedCommercials?.length || 0) + (scopedManagers?.length || 0),
        nbImmeubles: aggregateTotals.nbImmeubles,
        nbImmeublesProspectes: aggregateTotals.nbImmeublesProspectes,
        dataMode: useAggregateFallback ? 'consolidated' : 'activity',
      }),
    [aggregateTotals, scopedCommercials, scopedManagers, sourceTotals, useAggregateFallback]
  )

  const timelineData = useMemo(
    () => buildTimelineData(statsTimeline, timePeriod, dateRange),
    [dateRange, statsTimeline, timePeriod]
  )

  const statusBreakdown = useMemo(() => {
    const total =
      metrics.contratsSignes +
      metrics.rendezVousPris +
      metrics.refus +
      metrics.absents +
      metrics.argumentes +
      metrics.repassages

    return Object.entries(STATUS_LABELS).map(([key, label]) => ({
      key,
      label,
      value: metrics[key] || 0,
      percentage: total > 0 ? roundRate(((metrics[key] || 0) / total) * 100) : 0,
    }))
  }, [metrics])

  const funnelData = useMemo(() => {
    const base = Math.max(metrics.nbPortesProspectes, 1)
    const contacts =
      metrics.contratsSignes + metrics.rendezVousPris + metrics.refus + metrics.argumentes

    return [
      {
        key: 'portes',
        label: 'Portes prospectées',
        value: metrics.nbPortesProspectes,
        percentage: metrics.nbPortesProspectes > 0 ? 100 : 0,
      },
      {
        key: 'contacts',
        label: 'Contacts qualifiés',
        value: contacts,
        percentage: roundRate((contacts / base) * 100),
      },
      {
        key: 'rdv',
        label: 'Rendez-vous',
        value: metrics.rendezVousPris,
        percentage: roundRate((metrics.rendezVousPris / base) * 100),
      },
      {
        key: 'contrats',
        label: 'Contrats signés',
        value: metrics.contratsSignes,
        percentage: roundRate((metrics.contratsSignes / base) * 100),
      },
    ]
  }, [metrics])

  const lastStatusActivities = useMemo(() => {
    return (rawLastStatusActivities || []).filter(activity => {
      if (activity.userType === 'commercial' && !productionCommercialIds.has(activity.userId)) {
        return false
      }
      if (activity.userType === 'manager' && !productionManagerIds.has(activity.userId)) {
        return false
      }

      const matchesScope =
        scopeType === 'all' ||
        (scopeType === 'commercials' && activity.userType === 'commercial') ||
        (scopeType === 'managers' && activity.userType === 'manager')

      if (!matchesScope) return false
      if (selectedOwner === 'all') return true

      return `${activity.userType}:${activity.userId}` === selectedOwner
    })
  }, [
    rawLastStatusActivities,
    productionCommercialIds,
    productionManagerIds,
    scopeType,
    selectedOwner,
  ])

  const lastStatusActivityByOwner = useMemo(() => {
    return new Map(
      lastStatusActivities.map(activity => [`${activity.userType}:${activity.userId}`, activity])
    )
  }, [lastStatusActivities])

  const aggregatePerformersFallback = useMemo(() => {
    const statsByOwner = new Map()

    scopedProductionStats.forEach(stat => {
      const type = stat.commercialId ? 'commercial' : 'manager'
      const id = stat.commercialId || stat.managerId
      if (!id) return
      const key = `${type}:${id}`
      const existing = statsByOwner.get(key) || {
        userId: id,
        userType: type,
        contratsSignes: 0,
        rendezVousPris: 0,
        refus: 0,
        absents: 0,
        argumentes: 0,
        repassages: 0,
        nbPortesProspectes: 0,
      }

      existing.contratsSignes += stat.contratsSignes || 0
      existing.rendezVousPris += stat.rendezVousPris || 0
      existing.refus += stat.refus || 0
      existing.absents += stat.absents || 0
      existing.argumentes += stat.argumentes || 0
      existing.nbPortesProspectes += stat.nbPortesProspectes || 0
      statsByOwner.set(key, existing)
    })

    const commercialNames = new Map(
      (scopedCommercials || []).map(commercial => [
        commercial.id,
        `${commercial.prenom || ''} ${commercial.nom || ''}`.trim(),
      ])
    )
    const managerNames = new Map(
      (scopedManagers || []).map(manager => [
        manager.id,
        `${manager.prenom || ''} ${manager.nom || ''}`.trim(),
      ])
    )

    return Array.from(statsByOwner.values()).map(entry => {
      const opportunities = entry.contratsSignes + entry.rendezVousPris + entry.refus
      return {
        ...entry,
        userName:
          entry.userType === 'commercial'
            ? commercialNames.get(entry.userId) || `Commercial #${entry.userId}`
            : managerNames.get(entry.userId) || `Manager #${entry.userId}`,
        tauxConversion:
          opportunities > 0 ? roundRate((entry.contratsSignes / opportunities) * 100) : 0,
        points:
          entry.contratsSignes * 50 +
          entry.rendezVousPris * 10 +
          entry.argumentes * 4 +
          entry.nbPortesProspectes * 2,
        lastActivityAt:
          lastStatusActivityByOwner.get(`${entry.userType}:${entry.userId}`)?.changedAt || null,
      }
    })
  }, [lastStatusActivityByOwner, scopedCommercials, scopedManagers, scopedProductionStats])

  const topPerformers = useMemo(() => {
    const source =
      (ownerActivityStats || []).length > 0 ? ownerActivityStats : aggregatePerformersFallback

    return source
      .filter(entry => {
        if (entry.userType === 'commercial') return productionCommercialIds.has(entry.userId)
        if (entry.userType === 'manager') return productionManagerIds.has(entry.userId)
        return false
      })
      .map(entry => ({
        ...entry,
        label: entry.userType === 'commercial' ? 'Commercial' : 'Manager',
        lastActivity:
          lastStatusActivityByOwner.get(`${entry.userType}:${entry.userId}`) ||
          (entry.lastActivityAt ? { changedAt: entry.lastActivityAt } : null),
      }))
      .sort((a, b) => b.points - a.points || b.contratsSignes - a.contratsSignes)
      .slice(0, 5)
  }, [
    aggregatePerformersFallback,
    lastStatusActivityByOwner,
    ownerActivityStats,
    productionCommercialIds,
    productionManagerIds,
  ])

  const zoneHighlights = useMemo(() => {
    return (zoneStatisticsData || [])
      .slice()
      .sort((a, b) => (b.performanceGlobale || 0) - (a.performanceGlobale || 0))
      .slice(0, 6)
  }, [zoneStatisticsData])

  const zoneSummary = useMemo(() => {
    const zones = zoneStatisticsData || []
    const totals = zones.reduce(
      (acc, zone) => ({
        contrats: acc.contrats + (zone.totalContratsSignes || 0),
        portes: acc.portes + (zone.totalPortesProspectes || 0),
        rdv: acc.rdv + (zone.totalRendezVousPris || 0),
      }),
      { contrats: 0, portes: 0, rdv: 0 }
    )

    return {
      count: zones.length,
      bestZone: zoneHighlights[0] || null,
      ...totals,
    }
  }, [zoneHighlights, zoneStatisticsData])

  const periodLabel = TIME_FILTERS.find(filter => filter.value === timePeriod)?.label || 'Période'
  const activeFiltersCount =
    (timePeriod !== '30d' ? 1 : 0) +
    (scopeType !== 'all' ? 1 : 0) +
    (selectedOwner !== 'all' ? 1 : 0)

  const resetFilters = () => {
    setTimePeriod('30d')
    setScopeType('all')
    setSelectedOwner('all')
  }

  return {
    loading,
    error,
    timePeriod,
    setTimePeriod,
    scopeType,
    setScopeType,
    selectedOwner,
    setSelectedOwner,
    ownerOptions,
    activeFiltersCount,
    resetFilters,
    metrics,
    aggregateTotals,
    activityTotals,
    statusBreakdown,
    funnelData,
    timelineData,
    topPerformers,
    lastStatusActivities,
    productionStats: scopedProductionStats,
    rankingStatistics: scopedProductionStats,
    filteredCommercials: scopedCommercials,
    filteredDirecteurs: scopedDirecteurs,
    filteredManagers: scopedManagers,
    zoneStatisticsData: zoneHighlights,
    zoneSummary,
    currentRole,
    periodLabel,
    dataModeLabel: metrics.dataMode === 'activity' ? 'Activité période' : 'État consolidé',
  }
}
