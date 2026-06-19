import React, { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  Activity,
  Building,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Filter,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import CommercialRankingTable from '@/components/CommercialRankingTable'
import ZoneComparisonChart from '@/components/ZoneComparisonChart'
import {
  useStatistiquesLogic,
  TIME_FILTERS,
  SCOPE_FILTERS,
  ACTIVITY_STATUS_LABELS,
} from './useStatistiquesLogic'

const formatNumber = (num, decimals = 0) => {
  if (typeof num !== 'number') return '0'
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

const trendChartConfig = {
  contratsSignes: { label: 'Contrats', color: 'var(--chart-1)' },
  rendezVousPris: { label: 'RDV', color: 'var(--chart-2)' },
  refus: { label: 'Refus', color: 'var(--chart-5)' },
}

const statusChartConfig = {
  value: { label: 'Total', color: 'var(--chart-1)' },
}

const statusColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-5)',
  'var(--chart-3)',
  'var(--chart-4)',
]

const formatRelativeDate = dateValue => {
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

const formatActivityStatus = statut => ACTIVITY_STATUS_LABELS[statut] || statut || 'Statut modifié'

function MetricCard({ title, value, description, icon, badge }) {
  const IconComponent = icon

  return (
    <Card className="border-border/60 bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-muted-foreground">{title}</p>
            <div className="mt-2 text-3xl font-bold tracking-tight">
              {typeof value === 'number' ? formatNumber(value) : value}
            </div>
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/60 text-primary">
            <IconComponent className="h-5 w-5" />
          </div>
        </div>
        {badge && (
          <Badge variant="outline" className="mt-4 bg-background">
            {badge}
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}

function buildTrendData(statistics, daysToShow) {
  const safeStats = statistics || []
  const days = []
  const today = new Date()
  const count = Math.min(daysToShow || 365, 365)

  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    date.setHours(0, 0, 0, 0)
    const key = date.toISOString().slice(0, 10)

    days.push({
      key,
      label: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      contratsSignes: 0,
      rendezVousPris: 0,
      refus: 0,
    })
  }

  const byDay = new Map(days.map(day => [day.key, day]))

  safeStats.forEach(stat => {
    const rawDate = stat.updatedAt || stat.createdAt
    if (!rawDate) return
    const key = new Date(rawDate).toISOString().slice(0, 10)
    const day = byDay.get(key)
    if (!day) return

    day.contratsSignes += stat.contratsSignes || 0
    day.rendezVousPris += stat.rendezVousPris || 0
    day.refus += stat.refus || 0
  })

  return days
}

function AggregatesTrendChart({ statistics, daysToShow, periodLabel }) {
  const data = useMemo(
    () => buildTrendData(statistics, daysToShow),
    [statistics, daysToShow]
  )
  const totals = useMemo(
    () =>
      data.reduce(
        (acc, day) => ({
          contratsSignes: acc.contratsSignes + day.contratsSignes,
          rendezVousPris: acc.rendezVousPris + day.rendezVousPris,
          refus: acc.refus + day.refus,
        }),
        { contratsSignes: 0, rendezVousPris: 0, refus: 0 }
      ),
    [data]
  )

  return (
    <Card className="border-border/60 bg-card">
      <CardHeader className="flex flex-col gap-3 border-b border-border/60 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Évolution des agrégats
          </CardTitle>
          <CardDescription>
            Tendance consolidée des performances · {periodLabel.toLowerCase()}
          </CardDescription>
        </div>
        <div className="grid grid-cols-3 gap-3 text-right">
          <div>
            <div className="text-lg font-bold">{formatNumber(totals.contratsSignes)}</div>
            <div className="text-[11px] text-muted-foreground">Contrats</div>
          </div>
          <div>
            <div className="text-lg font-bold">{formatNumber(totals.rendezVousPris)}</div>
            <div className="text-[11px] text-muted-foreground">RDV</div>
          </div>
          <div>
            <div className="text-lg font-bold">{formatNumber(totals.refus)}</div>
            <div className="text-[11px] text-muted-foreground">Refus</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <ChartContainer config={trendChartConfig} className="h-[280px] w-full">
          <AreaChart data={data} margin={{ left: -14, right: 12, top: 12, bottom: 0 }}>
            <defs>
              <linearGradient id="statsContrats" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-contratsSignes)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-contratsSignes)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="statsRdv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-rendezVousPris)" stopOpacity={0.28} />
                <stop offset="95%" stopColor="var(--color-rendezVousPris)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Area
              dataKey="rendezVousPris"
              type="monotone"
              stroke="var(--color-rendezVousPris)"
              fill="url(#statsRdv)"
              strokeWidth={2}
            />
            <Area
              dataKey="contratsSignes"
              type="monotone"
              stroke="var(--color-contratsSignes)"
              fill="url(#statsContrats)"
              strokeWidth={2}
            />
            <Area
              dataKey="refus"
              type="monotone"
              stroke="var(--color-refus)"
              fill="transparent"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function StatusDistributionChart({ data }) {
  const visibleData = data.filter(item => item.value > 0)

  return (
    <Card className="border-border/60 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />
          Répartition terrain
        </CardTitle>
        <CardDescription>Répartition des résultats terrain par statut</CardDescription>
      </CardHeader>
      <CardContent>
        {visibleData.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            Aucune donnée de statut disponible
          </div>
        ) : (
          <ChartContainer config={statusChartConfig} className="h-[260px] w-full">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, name, props) => [
                      `${formatNumber(value)} · ${props.payload.percentage}%`,
                      name,
                    ]}
                  />
                }
              />
              <Pie
                data={visibleData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={2}
              >
                {visibleData.map((entry, index) => (
                  <Cell key={entry.key} fill={statusColors[index % statusColors.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
        <div className="mt-4 grid gap-2">
          {data.map((item, index) => (
            <div key={item.key} className="flex items-center justify-between text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: statusColors[index % statusColors.length] }}
                />
                <span className="truncate text-muted-foreground">{item.label}</span>
              </div>
              <span className="font-medium tabular-nums">
                {formatNumber(item.value)} · {item.percentage}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function FunnelChart({ data }) {
  return (
    <Card className="border-border/60 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" />
          Funnel de prospection
        </CardTitle>
        <CardDescription>Progression depuis les portes prospectées jusqu’aux contrats</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((step, index) => (
            <div key={step.key} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{step.label}</span>
                <span className="text-muted-foreground">
                  {formatNumber(step.value)} · {step.percentage}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(step.percentage, 100)}%`,
                    backgroundColor: statusColors[index % statusColors.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function TopPerformersCard({ performers }) {
  return (
    <Card className="border-border/60 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" />
          Top performers
        </CardTitle>
        <CardDescription>Meilleurs résultats commerciaux sur la période sélectionnée</CardDescription>
      </CardHeader>
      <CardContent>
        {performers.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            Aucun performer à afficher
          </div>
        ) : (
          <div className="space-y-3">
            {performers.map((performer, index) => (
              <div
                key={`${performer.type}-${performer.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background text-sm font-bold">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{performer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {performer.label} · {formatNumber(performer.contratsSignes)} contrats
                    </p>
                    {performer.lastActivity && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Dernier statut · {formatRelativeDate(performer.lastActivity.changedAt)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold tabular-nums">{formatNumber(performer.points)}</div>
                  <div className="text-xs text-muted-foreground">{performer.tauxConversion}% conv.</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function LastActivitiesCard({ activities }) {
  return (
    <Card className="border-border/60 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-primary" />
          Dernières activités terrain
        </CardTitle>
        <CardDescription>Dernier statut de porte modifié par commercial ou manager</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-center text-sm text-muted-foreground">
            Aucun changement de statut trouvé pour cette sélection
          </div>
        ) : (
          <div className="space-y-3">
            {activities.slice(0, 6).map(activity => (
              <div
                key={`${activity.userType}-${activity.userId}`}
                className="rounded-xl border border-border/60 bg-muted/30 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{activity.userName}</p>
                      <Badge variant="outline" className="bg-background text-[10px]">
                        {activity.userType === 'manager' ? 'Manager' : 'Commercial'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Porte {activity.porteNumero} · {formatActivityStatus(activity.statut)}
                    </p>
                    {activity.immeubleAdresse && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {activity.immeubleAdresse}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-xs font-medium text-muted-foreground">
                    {formatRelativeDate(activity.changedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ZoneBarChart({ zoneStatistics }) {
  const data = useMemo(
    () =>
      (zoneStatistics || [])
        .slice(0, 6)
        .map(zone => ({
          name: zone.zoneName,
          contrats: zone.totalContratsSignes || 0,
          rdv: zone.totalRendezVousPris || 0,
          refus: zone.totalRefus || 0,
        })),
    [zoneStatistics]
  )

  return (
    <Card className="border-border/60 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building className="h-4 w-4 text-primary" />
          Zones en lecture rapide
        </CardTitle>
        <CardDescription>Comparaison rapide des zones les plus performantes</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={trendChartConfig} className="h-[260px] w-full">
          <BarChart data={data} margin={{ left: -14, right: 12, top: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="contrats" fill="var(--color-contratsSignes)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="rdv" fill="var(--color-rendezVousPris)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="refus" fill="var(--color-refus)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export default function Statistiques() {
  const {
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
    timeFilteredStatistics,
    filteredCommercials,
    filteredDirecteurs,
    filteredManagers,
    zoneStatisticsData,
    currentRole,
    periodLabel,
    daysToShow,
  } = useStatistiquesLogic()

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Chargement des statistiques...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <FileText className="mx-auto mb-4 h-8 w-8 text-destructive" />
          <p className="font-medium text-destructive">Erreur lors du chargement des statistiques</p>
          <p className="mt-2 text-sm text-muted-foreground">Veuillez réessayer plus tard</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Statistiques</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vue consolidée des performances commerciales et des zones.
          </p>
        </div>
      </div>

      <Card className="border-border/60 bg-card">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/60 text-primary">
                <Filter className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Filtres</p>
                <p className="text-xs text-muted-foreground">
                  Les KPI, graphiques et classements suivent ces sélections.
                </p>
              </div>
              {activeFiltersCount > 0 && (
                <Badge variant="outline" className="bg-background">
                  {activeFiltersCount} actif{activeFiltersCount > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:min-w-[760px]">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Période</p>
                <Select value={timePeriod} onValueChange={setTimePeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une période" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_FILTERS.map(filter => (
                      <SelectItem key={filter.value} value={filter.value}>
                        <div className="flex items-center gap-2">
                          <filter.icon className="h-4 w-4" />
                          {filter.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Périmètre</p>
                <Select value={scopeType} onValueChange={setScopeType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un périmètre" />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_FILTERS.map(filter => (
                      <SelectItem key={filter.value} value={filter.value}>
                        {filter.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <p className="text-xs font-medium text-muted-foreground">Personne</p>
                <Select value={selectedOwner} onValueChange={setSelectedOwner}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une personne" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les intervenants</SelectItem>
                    {ownerOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <span>{option.label}</span>
                          <Badge variant="outline" className="bg-background text-[10px]">
                            {option.type === 'commercial' ? 'Commercial' : 'Manager'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <Button variant="outline" className="gap-2 xl:self-end" onClick={resetFilters}>
                <X className="h-4 w-4" />
                Réinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Contrats signés"
          value={metrics.contratsSignes}
          description="Total production"
          icon={CheckCircle}
          badge={`${metrics.tauxConversion}% conversion`}
        />
        <MetricCard
          title="Portes prospectées"
          value={metrics.nbPortesProspectes}
          description="Portes non marquées non visitées"
          icon={Activity}
          badge={`${metrics.tauxContact}% contact`}
        />
        <MetricCard
          title="Rendez-vous pris"
          value={metrics.rendezVousPris}
          description="RDV planifiés"
          icon={Calendar}
          badge={`${metrics.tauxRdv}% des portes`}
        />
        <MetricCard
          title="Immeubles visités"
          value={metrics.nbImmeubles}
          description={`${formatNumber(metrics.nbCommerciaux)} commerciaux · ${formatNumber(metrics.nbManagers)} managers`}
          icon={Building}
          badge={periodLabel}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <AggregatesTrendChart
            statistics={chartStatistics}
            daysToShow={daysToShow}
            periodLabel={periodLabel}
          />
        </div>
        <StatusDistributionChart data={statusBreakdown} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <FunnelChart data={funnelData} />
        <TopPerformersCard performers={topPerformers} />
        <LastActivitiesCard activities={lastStatusActivities} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ZoneBarChart zoneStatistics={zoneStatisticsData} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CommercialRankingTable
          commercials={filteredCommercials}
          directeurs={filteredDirecteurs}
          managers={filteredManagers}
          statistics={timeFilteredStatistics}
          currentUserRole={currentRole}
          title="Classement détaillé"
          description={`Classement par rôle et performance · ${periodLabel}`}
          limit={10}
        />
        <ZoneComparisonChart
          zoneStatistics={zoneStatisticsData}
          title="Analyse des zones"
          description="Comparaison détaillée des zones par volume, conversion et performance"
          maxZones={5}
        />
      </div>
    </div>
  )
}
