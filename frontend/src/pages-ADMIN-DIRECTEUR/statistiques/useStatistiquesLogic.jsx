import { useState, useMemo, useEffect } from 'react'
import { useRole } from '@/contexts/userole'
import {
  useStatistics,
  useCommercials,
  useDirecteurs,
  useManagers,
  useZoneStatistics,
  useTeamLastStatusActivities,
} from '@/services'
import { useRoleBasedData } from '@/hooks/metier/permissions/useRoleBasedData'
import { Clock, Calendar } from 'lucide-react'

// Options de filtres temporels
export const TIME_FILTERS = [
  { value: '7d', label: '7 derniers jours', icon: Clock, days: 7 },
  { value: '30d', label: '30 derniers jours', icon: Calendar, days: 30 },
  { value: '90d', label: '3 derniers mois', icon: Calendar, days: 90 },
  { value: '1y', label: 'Cette année', icon: Calendar, days: 365 },
  { value: 'all', label: 'Toute la période', icon: Calendar, days: null },
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
}

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

const sumStats = stats =>
  stats.reduce(
    (acc, stat) => ({
      contratsSignes: acc.contratsSignes + (stat.contratsSignes || 0),
      rendezVousPris: acc.rendezVousPris + (stat.rendezVousPris || 0),
      refus: acc.refus + (stat.refus || 0),
      absents: acc.absents + (stat.absents || 0),
      argumentes: acc.argumentes + (stat.argumentes || 0),
      nbImmeubles: acc.nbImmeubles + (stat.immeublesVisites || 0),
      nbImmeublesProspectes: acc.nbImmeublesProspectes + (stat.nbImmeublesProspectes || 0),
      nbPortesProspectes: acc.nbPortesProspectes + (stat.nbPortesProspectes || 0),
    }),
    {
      contratsSignes: 0,
      rendezVousPris: 0,
      refus: 0,
      absents: 0,
      argumentes: 0,
      nbImmeubles: 0,
      nbImmeublesProspectes: 0,
      nbPortesProspectes: 0,
    }
  )

// Fonction pour filtrer les statistiques par période
const filterStatisticsByPeriod = (statistics, period) => {
  if (!statistics?.length) return []

  const now = new Date()
  let startDate

  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case '1y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      break
    case 'all':
    default:
      return statistics
  }

  return statistics.filter(stat => {
    const statDate = new Date(stat.updatedAt || stat.createdAt || stat.date)
    return statDate >= startDate
  })
}

export function useStatistiquesLogic() {
  const { currentRole } = useRole()
  const [timePeriod, setTimePeriod] = useState('all')
  const [scopeType, setScopeType] = useState('all')
  const [selectedOwner, setSelectedOwner] = useState('all')

  // Chargement des données depuis les APIs
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

  // États de chargement et d'erreur combinés
  const loading =
    statisticsLoading ||
    commercialsLoading ||
    directeursLoading ||
    managersLoading ||
    zoneStatsLoading ||
    lastActivitiesLoading
  const error =
    statisticsError ||
    commercialsError ||
    directeursError ||
    managersError ||
    zoneStatsError ||
    lastActivitiesError

  // Calculs des statistiques filtrées avec le hook unifié
  const filteredStatistics = useRoleBasedData('statistics', rawStatistics, {
    commercials: rawCommercials,
  })

  const filteredCommercials = useRoleBasedData('commerciaux', rawCommercials)

  const filteredDirecteurs = useRoleBasedData('directeurs', rawDirecteurs)

  const filteredManagers = useRoleBasedData('managers', rawManagers)

  const ownerOptions = useMemo(() => {
    const options = []

    if (scopeType === 'all' || scopeType === 'commercials') {
      ;(filteredCommercials || []).forEach(commercial => {
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
      ;(filteredManagers || []).forEach(manager => {
        options.push({
          value: `manager:${manager.id}`,
          label:
            `${manager.prenom || ''} ${manager.nom || ''}`.trim() || `Manager #${manager.id}`,
          type: 'manager',
        })
      })
    }

    return options.sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [filteredCommercials, filteredManagers, scopeType])

  useEffect(() => {
    if (selectedOwner === 'all') return
    if (!ownerOptions.some(option => option.value === selectedOwner)) {
      setSelectedOwner('all')
    }
  }, [ownerOptions, selectedOwner])

  // Appliquer le filtre temporel aux statistiques
  const timeFilteredStatistics = useMemo(() => {
    return filterStatisticsByPeriod(filteredStatistics, timePeriod)
  }, [filteredStatistics, timePeriod])

  const scopedProductionStats = useMemo(() => {
    return timeFilteredStatistics.filter(stat => {
      const isCommercialStat = Boolean(stat.commercialId)
      const isManagerStat = Boolean(stat.managerId)

      if (!isCommercialStat && !isManagerStat) return false

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
  }, [scopeType, selectedOwner, timeFilteredStatistics])

  const scopedCommercials = useMemo(() => {
    if (scopeType === 'managers') return []
    if (selectedOwner.startsWith('manager:')) return []
    if (selectedOwner.startsWith('commercial:')) {
      const commercialId = selectedOwner.replace('commercial:', '')
      return (filteredCommercials || []).filter(commercial => String(commercial.id) === commercialId)
    }
    return filteredCommercials || []
  }, [filteredCommercials, scopeType, selectedOwner])

  const scopedManagers = useMemo(() => {
    if (scopeType === 'commercials') return []
    if (selectedOwner.startsWith('commercial:')) return []
    if (selectedOwner.startsWith('manager:')) {
      const managerId = selectedOwner.replace('manager:', '')
      return (filteredManagers || []).filter(manager => String(manager.id) === managerId)
    }
    return filteredManagers || []
  }, [filteredManagers, scopeType, selectedOwner])

  const scopedDirecteurs = useMemo(
    () => (scopeType === 'all' && selectedOwner === 'all' ? filteredDirecteurs || [] : []),
    [filteredDirecteurs, scopeType, selectedOwner]
  )

  const scopedTimeFilteredStatistics = useMemo(() => {
    if (scopeType === 'all' && selectedOwner === 'all') return timeFilteredStatistics
    return scopedProductionStats
  }, [scopeType, scopedProductionStats, selectedOwner, timeFilteredStatistics])

  const lastStatusActivities = useMemo(() => {
    return (rawLastStatusActivities || []).filter(activity => {
      const matchesScope =
        scopeType === 'all' ||
        (scopeType === 'commercials' && activity.userType === 'commercial') ||
        (scopeType === 'managers' && activity.userType === 'manager')

      if (!matchesScope) return false
      if (selectedOwner === 'all') return true

      return `${activity.userType}:${activity.userId}` === selectedOwner
    })
  }, [rawLastStatusActivities, scopeType, selectedOwner])

  const lastStatusActivityByOwner = useMemo(() => {
    return new Map(
      lastStatusActivities.map(activity => [`${activity.userType}:${activity.userId}`, activity])
    )
  }, [lastStatusActivities])

  // Pour le graphique, on exclut les statistiques des directeurs car ce sont des agrégats
  // On ne garde que la production réelle (commerciaux et managers)
  const chartStatistics = useMemo(() => {
    return scopedProductionStats
  }, [scopedProductionStats])

  const productionStats = scopedProductionStats

  const metrics = useMemo(() => {
    const totals = sumStats(productionStats)
    const opportunities = totals.contratsSignes + totals.rendezVousPris + totals.refus
    const contacted =
      totals.contratsSignes + totals.rendezVousPris + totals.refus + totals.argumentes

    return {
      ...totals,
      nbCommerciaux: scopedCommercials?.length || 0,
      nbManagers: scopedManagers?.length || 0,
      actionsTerrain:
        totals.contratsSignes +
        totals.rendezVousPris +
        totals.refus +
        totals.absents +
        totals.argumentes,
      tauxConversion:
        opportunities > 0 ? roundRate((totals.contratsSignes / opportunities) * 100) : 0,
      tauxContact:
        totals.nbPortesProspectes > 0
          ? roundRate((contacted / totals.nbPortesProspectes) * 100)
          : 0,
      tauxRdv:
        totals.nbPortesProspectes > 0
          ? roundRate((totals.rendezVousPris / totals.nbPortesProspectes) * 100)
          : 0,
    }
  }, [productionStats, scopedCommercials, scopedManagers])

  const statusBreakdown = useMemo(() => {
    const total =
      metrics.contratsSignes +
      metrics.rendezVousPris +
      metrics.refus +
      metrics.absents +
      metrics.argumentes

    return Object.entries(STATUS_LABELS).map(([key, label]) => ({
      key,
      label,
      value: metrics[key] || 0,
      percentage: total > 0 ? roundRate(((metrics[key] || 0) / total) * 100) : 0,
    }))
  }, [metrics])

  const funnelData = useMemo(() => {
    const base = Math.max(metrics.nbPortesProspectes, 1)

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
        value: metrics.contratsSignes + metrics.rendezVousPris + metrics.refus + metrics.argumentes,
        percentage: roundRate(
          ((metrics.contratsSignes + metrics.rendezVousPris + metrics.refus + metrics.argumentes) /
            base) *
            100
        ),
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

  const topPerformers = useMemo(() => {
    const statsByOwner = new Map()

    productionStats.forEach(stat => {
      const type = stat.commercialId ? 'commercial' : 'manager'
      const id = stat.commercialId || stat.managerId
      if (!id) return
      const key = `${type}-${id}`
      const existing = statsByOwner.get(key) || {
        id,
        type,
        contratsSignes: 0,
        rendezVousPris: 0,
        refus: 0,
        immeublesVisites: 0,
        nbPortesProspectes: 0,
      }

      existing.contratsSignes += stat.contratsSignes || 0
      existing.rendezVousPris += stat.rendezVousPris || 0
      existing.refus += stat.refus || 0
      existing.immeublesVisites += stat.immeublesVisites || 0
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

    return Array.from(statsByOwner.values())
      .map(entry => {
        const opportunities = entry.contratsSignes + entry.rendezVousPris + entry.refus
        return {
          ...entry,
          name:
            entry.type === 'commercial'
              ? commercialNames.get(entry.id) || `Commercial #${entry.id}`
              : managerNames.get(entry.id) || `Manager #${entry.id}`,
          label: entry.type === 'commercial' ? 'Commercial' : 'Manager',
          lastActivity: lastStatusActivityByOwner.get(`${entry.type}:${entry.id}`) || null,
          points: entry.contratsSignes * 50 + entry.rendezVousPris * 10 + entry.immeublesVisites * 5,
          tauxConversion:
            opportunities > 0 ? roundRate((entry.contratsSignes / opportunities) * 100) : 0,
        }
      })
      .sort((a, b) => b.points - a.points || b.contratsSignes - a.contratsSignes)
      .slice(0, 5)
  }, [productionStats, scopedCommercials, scopedManagers, lastStatusActivityByOwner])

  const periodLabel = TIME_FILTERS.find(filter => filter.value === timePeriod)?.label || 'Période'
  const daysToShow =
    TIME_FILTERS.find(filter => filter.value === timePeriod)?.days ||
    (timePeriod === 'all' ? 365 : 30)
  const activeFiltersCount =
    (timePeriod !== 'all' ? 1 : 0) +
    (scopeType !== 'all' ? 1 : 0) +
    (selectedOwner !== 'all' ? 1 : 0)

  const resetFilters = () => {
    setTimePeriod('all')
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
    statusBreakdown,
    funnelData,
    topPerformers,
    lastStatusActivities,
    chartStatistics,
    productionStats,
    timeFilteredStatistics: scopedTimeFilteredStatistics,
    filteredCommercials: scopedCommercials,
    filteredDirecteurs: scopedDirecteurs,
    filteredManagers: scopedManagers,
    zoneStatisticsData,
    currentRole,
    periodLabel,
    daysToShow,
  }
}
