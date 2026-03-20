import React, { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Users,
  Trophy,
  RefreshCcw,
  MapPin,
  Target,
  Calendar,
  Clock,
  CheckCircle2,
  Building2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCommercialTheme } from '@/hooks/ui/use-commercial-theme'
import { calculateRank } from '@/utils/business/ranks'
import ContratsEvolutionChart from '@/components/charts/ContratsEvolutionChart'
import ZoneComparisonChart from '@/components/ZoneComparisonChart'
import { BarChart3, TrendingUp } from 'lucide-react'

const INITIAL_STATS = {
  contratsSignes: 0,
  immeublesVisites: 0,
  rendezVousPris: 0,
  refus: 0,
  nbImmeublesProspectes: 0,
  nbPortesProspectes: 0,
}

const formatNumber = value => new Intl.NumberFormat('fr-FR').format(value || 0)

const buildCommercialSnapshot = (commercial, timePeriod) => {
  // Filtrer les statistiques selon la période
  const globalStats = (commercial.statistics || []).filter(stat => stat.immeubleId === null)
  const filteredStats = filterStatisticsByPeriod(globalStats, timePeriod)

  const stats = filteredStats.reduce(
    (acc, stat) => ({
      contratsSignes: acc.contratsSignes + (stat.contratsSignes || 0),
      immeublesVisites: acc.immeublesVisites + (stat.immeublesVisites || 0),
      rendezVousPris: acc.rendezVousPris + (stat.rendezVousPris || 0),
      refus: acc.refus + (stat.refus || 0),
      nbImmeublesProspectes: acc.nbImmeublesProspectes + (stat.nbImmeublesProspectes || 0),
      nbPortesProspectes: acc.nbPortesProspectes + (stat.nbPortesProspectes || 0),
    }),
    { ...INITIAL_STATS }
  )

  const { rank, points } = calculateRank(
    stats.contratsSignes,
    stats.rendezVousPris,
    stats.immeublesVisites
  )

  // Récupérer la zone actuelle (première zone assignée ou "Aucune zone")
  // Les zones sont directement dans commercial.zones (pas commercial.zones[].zone)
  const currentZone = commercial.zones?.[0]?.nom || 'Aucune zone assignée'
  const zoneCount = commercial.zones?.length || 0
  const immeubleCount = commercial.immeubles?.length || 0

  return {
    ...commercial,
    stats,
    rank,
    points,
    currentZone,
    zoneCount,
    immeubleCount,
  }
}

// Fonction pour filtrer les statistiques par période
const filterStatisticsByPeriod = (statistics, period) => {
  if (!statistics?.length) return []
  if (period === 'all') return statistics

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
    default:
      return statistics
  }

  return statistics.filter(stat => {
    const statDate = new Date(stat.createdAt || stat.updatedAt || stat.date)
    return statDate >= startDate
  })
}

export default function TeamManagement() {
  const context = useOutletContext()
  const { colors, base } = useCommercialTheme()
  const [timePeriod, setTimePeriod] = useState('30d')

  const managerProfile = context?.commercial
  const isManager = context?.isManager
  const refetch = context?.refetch

  const teamSnapshots = React.useMemo(() => {
    if (!managerProfile?.commercials) return []
    return managerProfile.commercials
      .map(commercial => buildCommercialSnapshot(commercial, timePeriod))
      .sort((a, b) => b.points - a.points)
  }, [managerProfile?.commercials, timePeriod])

  const teamStats = React.useMemo(() => {
    return teamSnapshots.reduce(
      (acc, commercial) => ({
        contratsSignes: acc.contratsSignes + commercial.stats.contratsSignes,
        immeublesVisites: acc.immeublesVisites + commercial.stats.immeublesVisites,
        rendezVousPris: acc.rendezVousPris + commercial.stats.rendezVousPris,
        refus: acc.refus + commercial.stats.refus,
        nbImmeublesProspectes: acc.nbImmeublesProspectes + commercial.stats.nbImmeublesProspectes,
        nbPortesProspectes: acc.nbPortesProspectes + commercial.stats.nbPortesProspectes,
      }),
      { ...INITIAL_STATS }
    )
  }, [teamSnapshots])

  // Statistiques agrégées de l'équipe pour les graphiques
  const teamStatistics = React.useMemo(() => {
    if (!managerProfile?.commercials) return []
    return managerProfile.commercials.flatMap(commercial =>
      (commercial.statistics || []).map(stat => ({
        ...stat,
        commercialName: `${commercial.prenom} ${commercial.nom}`,
      }))
    )
  }, [managerProfile?.commercials])

  // Zones de l'équipe
  const teamZones = React.useMemo(() => {
    if (!managerProfile?.commercials) return []
    const allZones = []
    managerProfile.commercials.forEach(commercial => {
      commercial.zones?.forEach(zone => {
        if (zone && !allZones.find(z => z.id === zone.id)) {
          allZones.push({
            ...zone,
            commercials: [{ commercialId: commercial.id }],
          })
        }
      })
    })
    return allZones
  }, [managerProfile?.commercials])

  const filteredTeamStats = React.useMemo(() => {
    return filterStatisticsByPeriod(teamStatistics, timePeriod)
  }, [teamStatistics, timePeriod])

  const topPerformer = teamSnapshots[0]

  if (!isManager) {
    return (
      <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
        Cette page est réservée aux managers.
      </div>
    )
  }

  const handleRefresh = async () => {
    try {
      await refetch?.()
    } catch (error) {
      console.error('TeamManagement.refetch', error)
    }
  }

  const summaryCards = [
    {
      id: 'team-size',
      title: 'Effectif',
      value: formatNumber(teamSnapshots.length),
      subtitle: 'Commerciaux actifs',
      icon: Users,
      tint: `${colors.primary.bgLight} ${colors.primary.border}`,
      iconBg: 'bg-white/70',
      iconColor: colors.primary.textLight,
    },
    {
      id: 'contracts',
      title: 'Contrats signés',
      value: formatNumber(teamStats.contratsSignes),
      subtitle: 'Cumul des signatures',
      icon: Trophy,
      tint: `${colors.success.bgLight} ${colors.success.border}`,
      iconBg: 'bg-white/70',
      iconColor: colors.success.textLight,
    },
    {
      id: 'appointments',
      title: 'Rendez-vous pris',
      value: formatNumber(teamStats.rendezVousPris),
      subtitle: 'Opportunités générées',
      icon: BarChart3,
      tint: `${colors.warning.bgLight} ${colors.warning.border}`,
      iconBg: 'bg-white/70',
      iconColor: colors.warning.textLight,
    },
    {
      id: 'doors',
      title: 'Portes prospectées',
      value: formatNumber(teamStats.nbPortesProspectes),
      subtitle: 'Volume de prospection',
      icon: TrendingUp,
      tint: `${colors.info.bgLight} ${colors.info.border}`,
      iconBg: 'bg-white/70',
      iconColor: colors.info.textLight,
    },
  ]

  const timePeriodOptions = [
    { value: '7d', label: '7 derniers jours' },
    { value: '30d', label: '30 derniers jours' },
    { value: '90d', label: '3 derniers mois' },
    { value: 'all', label: 'Toute la période' },
  ]

  return (
    <div className="space-y-6 pb-24">
      {/* En-tête avec contrôles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={`text-xl font-semibold ${base.text.primary}`}>Gestion d'équipe</h2>
          <p className={`text-sm ${base.text.muted}`}>
            Tableau de bord manager pour le suivi de votre équipe commerciale
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sélecteur de période */}
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger
              className="w-48"
              style={{
                backgroundColor: '#f8fafc',
                borderColor: '#e2e8f0',
                color: '#1e293b',
              }}
            >
              <Clock className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Période" />
            </SelectTrigger>
            <SelectContent
              style={{
                backgroundColor: '#ffffff',
                borderColor: '#e2e8f0',
                color: '#1e293b',
              }}
            >
              {timePeriodOptions.map(option => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  style={{
                    color: '#1e293b',
                    backgroundColor: 'transparent',
                  }}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={handleRefresh}
            className="gap-2"
            style={{
              backgroundColor: '#f8fafc',
              borderColor: '#e2e8f0',
              color: '#1e293b',
            }}
          >
            <RefreshCcw className="h-4 w-4" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Métriques principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <Card
            key={card.id}
            className={`${base.bg.card} ${base.border.card} shadow-sm hover:shadow-md transition-shadow`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1.5">
                  <p className={`text-xs font-semibold uppercase ${base.text.secondary}`}>
                    {card.title}
                  </p>
                  <p className={`text-2xl font-bold ${base.text.primary} leading-none`}>
                    {card.value}
                  </p>
                  {card.subtitle && <p className={`text-xs ${base.text.muted}`}>{card.subtitle}</p>}
                </div>
                <div className={`p-2.5 rounded-xl ${card.tint}`}>
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top performer */}
      {topPerformer && (
        <Card className={`${base.bg.card} ${base.border.card} shadow-md`}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${base.text.primary}`}>
              <Trophy className="h-5 w-5 text-yellow-500" />
              Meilleur commercial de l'équipe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`h-12 w-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg`}
                >
                  <Trophy className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${base.text.primary}`}>
                    {topPerformer.prenom} {topPerformer.nom}
                  </h3>
                  <p className={`text-sm ${base.text.muted}`}>
                    Rang {topPerformer.rank.name} • {formatNumber(topPerformer.points)} points
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className={`text-2xl font-bold text-green-600`}>
                    {formatNumber(topPerformer.stats.contratsSignes)}
                  </p>
                  <p className={`text-xs ${base.text.muted}`}>Contrats signés</p>
                </div>
                <div>
                  <p className={`text-2xl font-bold text-blue-600`}>
                    {formatNumber(topPerformer.stats.rendezVousPris)}
                  </p>
                  <p className={`text-xs ${base.text.muted}`}>Rendez-vous pris</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Graphique d'évolution */}
      <ContratsEvolutionChart
        statistics={filteredTeamStats}
        title="Évolution des performances de l'équipe"
        description={`Tendance sur ${timePeriodOptions.find(opt => opt.value === timePeriod)?.label?.toLowerCase()}`}
        daysToShow={
          timePeriod === '7d' ? 7 : timePeriod === '30d' ? 30 : timePeriod === '90d' ? 90 : 365
        }
      />

      {/* Liste des commerciaux */}
      <div className="space-y-3">
        <h3 className={`text-lg font-semibold ${base.text.primary}`}>Équipe commerciale</h3>
        {teamSnapshots.map(commercial => (
          <Card
            key={commercial.id}
            className={`${base.bg.card} ${base.border.card} shadow-sm hover:shadow-md transition-shadow`}
          >
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`text-lg font-semibold ${base.text.primary}`}>
                        {commercial.prenom} {commercial.nom}
                      </h4>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${commercial.rank.bgColor} ${commercial.rank.textColor}`}
                      >
                        {commercial.rank.name}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {formatNumber(commercial.points)} pts
                      </Badge>
                    </div>
                    <p className={`text-sm ${base.text.muted}`}>
                      {commercial.email} • {commercial.numTel || 'Téléphone non fourni'}
                    </p>

                    {/* Zone actuelle en évidence */}
                    <div className="flex items-center gap-2 mt-2">
                      <MapPin className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
                        {commercial.currentZone}
                      </span>
                      {commercial.zoneCount > 1 && (
                        <Badge variant="outline" className="text-xs">
                          +{commercial.zoneCount - 1} autre(s)
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className={`flex items-center gap-2 ${base.text.muted}`}>
                      <Building2 className="h-4 w-4" />
                      <span>{commercial.immeubleCount} immeubles prospectés</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className={`rounded-lg p-3 ${base.bg.muted} border`}>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <p className={`text-xs ${base.text.muted} uppercase font-medium`}>Contrats</p>
                    </div>
                    <p className={`text-lg font-bold text-green-600`}>
                      {formatNumber(commercial.stats.contratsSignes)}
                    </p>
                  </div>
                  <div className={`rounded-lg p-3 ${base.bg.muted} border`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <p className={`text-xs ${base.text.muted} uppercase font-medium`}>RDV</p>
                    </div>
                    <p className={`text-lg font-bold text-blue-600`}>
                      {formatNumber(commercial.stats.rendezVousPris)}
                    </p>
                  </div>
                  <div className={`rounded-lg p-3 ${base.bg.muted} border`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4 text-purple-600" />
                      <p className={`text-xs ${base.text.muted} uppercase font-medium`}>
                        Immeubles
                      </p>
                    </div>
                    <p className={`text-lg font-bold text-purple-600`}>
                      {formatNumber(commercial.stats.immeublesVisites)}
                    </p>
                  </div>
                  <div className={`rounded-lg p-3 ${base.bg.muted} border`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="h-4 w-4 text-orange-600" />
                      <p className={`text-xs ${base.text.muted} uppercase font-medium`}>Portes</p>
                    </div>
                    <p className={`text-lg font-bold text-orange-600`}>
                      {formatNumber(commercial.stats.nbPortesProspectes)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {teamSnapshots.length === 0 && (
          <Card className={`${base.bg.card} ${base.border.card} p-6 text-center`}>
            <CardContent className="space-y-2">
              <Users className={`h-10 w-10 mx-auto ${base.text.muted}`} />
              <h3 className={`text-lg font-semibold ${base.text.primary}`}>
                Aucun commercial assigné
              </h3>
              <p className={`text-sm ${base.text.muted}`}>
                Dès qu'un commercial vous sera rattaché, ses résultats apparaîtront ici.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Analyse des zones */}
      {teamZones.length > 0 && (
        <ZoneComparisonChart
          zones={teamZones}
          statistics={filteredTeamStats}
          title="Analyse des zones de votre équipe"
          description={`Performance par zone sur ${timePeriodOptions.find(opt => opt.value === timePeriod)?.label?.toLowerCase()}`}
          maxZones={6}
        />
      )}
    </div>
  )
}
