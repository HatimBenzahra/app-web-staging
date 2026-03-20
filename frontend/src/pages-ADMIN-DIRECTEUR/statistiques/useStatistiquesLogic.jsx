import { useState, useMemo } from 'react'
import { useRole } from '@/contexts/userole'
import {
  useStatistics,
  useCommercials,
  useDirecteurs,
  useManagers,
  useZoneStatistics,
} from '@/services'
import { useRoleBasedData } from '@/hooks/metier/permissions/useRoleBasedData'
import { Clock, Calendar } from 'lucide-react'

// Options de filtres temporels
export const TIME_FILTERS = [
  { value: '7d', label: '7 derniers jours', icon: Clock },
  { value: '30d', label: '30 derniers jours', icon: Calendar },
  { value: '90d', label: '3 derniers mois', icon: Calendar },
  { value: '1y', label: 'Cette année', icon: Calendar },
  { value: 'all', label: 'Toute la période', icon: Calendar },
]

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
    const statDate = new Date(stat.createdAt || stat.date)
    return statDate >= startDate
  })
}

export function useStatistiquesLogic() {
  const { currentRole } = useRole()
  const [timePeriod, setTimePeriod] = useState('30d')

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

  // États de chargement et d'erreur combinés
  const loading =
    statisticsLoading ||
    commercialsLoading ||
    directeursLoading ||
    managersLoading ||
    zoneStatsLoading
  const error =
    statisticsError || commercialsError || directeursError || managersError || zoneStatsError

  // Calculs des statistiques filtrées avec le hook unifié
  const filteredStatistics = useRoleBasedData('statistics', rawStatistics, {
    commercials: rawCommercials,
  })

  const filteredCommercials = useRoleBasedData('commerciaux', rawCommercials)

  const filteredDirecteurs = useRoleBasedData('directeurs', rawDirecteurs)

  const filteredManagers = useRoleBasedData('managers', rawManagers)

  // Appliquer le filtre temporel aux statistiques
  const timeFilteredStatistics = useMemo(() => {
    return filterStatisticsByPeriod(filteredStatistics, timePeriod)
  }, [filteredStatistics, timePeriod])

  // Pour le graphique, on exclut les statistiques des directeurs car ce sont des agrégats
  // On ne garde que la production réelle (commerciaux et managers)
  const chartStatistics = useMemo(() => {
    return timeFilteredStatistics.filter(stat => stat.commercialId || stat.managerId)
  }, [timeFilteredStatistics])

  // Calculs des métriques - Calculer automatiquement la somme des stats des commerciaux et managers
  const metrics = useMemo(() => {
    if (!timeFilteredStatistics?.length) {
      return {
        contratsSignes: 0,
        rendezVousPris: 0,
        refus: 0,
        absents: 0,
        argumentes: 0,
        nbRepassages: 0,
        nbImmeubles: 0,
        nbCommerciaux: filteredCommercials?.length || 0,
      }
    }

    // Filtrer uniquement les stats des commerciaux et managers (exclure les stats orphelines ou de directeur)
    const productionStats = timeFilteredStatistics.filter(
      stat => stat.commercialId || stat.managerId
    )

    // Calculer la somme de toutes les stats de production réelles
    const contratsSignes = productionStats.reduce(
      (sum, stat) => sum + (stat.contratsSignes || 0),
      0
    )
    const rendezVousPris = productionStats.reduce(
      (sum, stat) => sum + (stat.rendezVousPris || 0),
      0
    )
    const refus = productionStats.reduce((sum, stat) => sum + (stat.refus || 0), 0)
    const absents = productionStats.reduce((sum, stat) => sum + (stat.absents || 0), 0)
    const argumentes = productionStats.reduce((sum, stat) => sum + (stat.argumentes || 0), 0)
    const nbRepassages = productionStats.reduce(
      (sum, stat) => sum + (stat.nbRepassages || 0),
      0
    )
    const nbImmeubles = productionStats.reduce(
      (sum, stat) => sum + (stat.immeublesVisites || 0),
      0
    )
    const nbCommerciaux = filteredCommercials?.length || 0

    return {
      contratsSignes,
      rendezVousPris,
      refus,
      absents,
      argumentes,
      nbRepassages,
      nbImmeubles,
      nbCommerciaux,
    }
  }, [timeFilteredStatistics, filteredCommercials])

  return {
    loading,
    error,
    timePeriod,
    setTimePeriod,
    metrics,
    chartStatistics,
    timeFilteredStatistics,
    filteredCommercials,
    filteredDirecteurs,
    filteredManagers,
    zoneStatisticsData,
    currentRole,
  }
}
