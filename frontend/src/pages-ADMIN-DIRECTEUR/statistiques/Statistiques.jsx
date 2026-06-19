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
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  Activity,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Filter,
  MapPin,
  Medal,
  RefreshCw,
  RotateCcw,
  Target,
  TrendingUp,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import CommercialRankingTable from '@/components/CommercialRankingTable'
import {
  useStatistiquesLogic,
  TIME_FILTERS,
  SCOPE_FILTERS,
  ACTIVITY_STATUS_LABELS,
} from './useStatistiquesLogic'

const formatNumber = (num, decimals = 0) => {
  if (typeof num !== 'number' || Number.isNaN(num)) return decimals > 0 ? '0,0' : '0'
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

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

const trendChartConfig = {
  contratsSignes: { label: 'Contrats', color: 'var(--chart-1)' },
  rendezVousPris: { label: 'RDV', color: 'var(--chart-2)' },
  refus: { label: 'Refus', color: 'var(--chart-5)' },
}

const statusChartConfig = {
  value: { label: 'Volume', color: 'var(--chart-1)' },
}

const zoneChartConfig = {
  contrats: { label: 'Contrats', color: 'var(--chart-1)' },
  rdv: { label: 'RDV', color: 'var(--chart-2)' },
  portes: { label: 'Portes', color: 'var(--chart-3)' },
}

const statusColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-5)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--muted-foreground)',
]

function PageSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-56" />
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map(item => (
          <Skeleton key={item} className="h-36 w-full" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-96 xl:col-span-2" />
        <Skeleton className="h-96" />
      </div>
    </div>
  )
}

function MetricCard({ title, value, suffix, description, icon, tone = 'primary' }) {
  const toneClasses = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    info: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  }

  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-muted-foreground">{title}</p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight">
                {typeof value === 'number' ? formatNumber(value, suffix === '%' ? 1 : 0) : value}
              </span>
              {suffix && (
                <span className="text-sm font-semibold text-muted-foreground">{suffix}</span>
              )}
            </div>
            {description && (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
            )}
          </div>
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${toneClasses[tone]}`}
          >
            {React.createElement(icon, { className: 'h-5 w-5' })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function FilterBar({
  timePeriod,
  setTimePeriod,
  scopeType,
  setScopeType,
  selectedOwner,
  setSelectedOwner,
  ownerOptions,
  activeFiltersCount,
  resetFilters,
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
              <Filter className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Filtres d’analyse</p>
              <p className="truncate text-xs text-muted-foreground">
                Période, périmètre et intervenant
              </p>
            </div>
            {activeFiltersCount > 0 && (
              <Badge variant="outline" className="bg-background">
                {activeFiltersCount} actif{activeFiltersCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_220px_minmax(220px,280px)_auto] lg:items-end">
            <div className="min-w-0">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Période</p>
              <div className="grid grid-cols-5 gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
                {TIME_FILTERS.map(filter => {
                  const Icon = filter.icon
                  const isActive = timePeriod === filter.value
                  return (
                    <Button
                      key={filter.value}
                      type="button"
                      variant={isActive ? 'default' : 'ghost'}
                      size="sm"
                      className="h-9 gap-1 px-2 text-xs"
                      onClick={() => setTimePeriod(filter.value)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{filter.shortLabel}</span>
                    </Button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Périmètre</p>
              <Select value={scopeType} onValueChange={setScopeType}>
                <SelectTrigger>
                  <SelectValue />
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

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Intervenant</p>
              <Select value={selectedOwner} onValueChange={setSelectedOwner}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les intervenants</SelectItem>
                  {ownerOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={activeFiltersCount === 0}
              onClick={resetFilters}
            >
              <X className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TimelineCard({ data, periodLabel, metrics, dataModeLabel }) {
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
    <Card className="border-border/60">
      <CardHeader className="gap-3 border-b border-border/60 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Activité terrain
          </CardTitle>
          <CardDescription>
            {periodLabel} · {dataModeLabel}
          </CardDescription>
        </div>
        <div className="grid grid-cols-3 gap-4 text-right">
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
        <ChartContainer config={trendChartConfig} className="h-[320px] w-full">
          <AreaChart data={data} margin={{ left: -14, right: 12, top: 12, bottom: 0 }}>
            <defs>
              <linearGradient id="statsContrats" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-contratsSignes)" stopOpacity={0.34} />
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

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Portes prospectées</p>
            <p className="mt-1 text-lg font-bold">{formatNumber(metrics.nbPortesProspectes)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Taux contact</p>
            <p className="mt-1 text-lg font-bold">{formatNumber(metrics.tauxContact, 1)}%</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Taux RDV</p>
            <p className="mt-1 text-lg font-bold">{formatNumber(metrics.tauxRdv, 1)}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function FunnelCard({ data }) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" />
          Funnel
        </CardTitle>
        <CardDescription>De la porte au contrat</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((step, index) => (
            <div key={step.key} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{step.label}</span>
                <span className="text-muted-foreground">
                  {formatNumber(step.value)} · {formatNumber(step.percentage, 1)}%
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

function StatusDistributionCard({ data }) {
  const visibleData = data.filter(item => item.value > 0)

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-primary" />
          Mix des statuts
        </CardTitle>
        <CardDescription>Répartition des résultats terrain</CardDescription>
      </CardHeader>
      <CardContent>
        {visibleData.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            Aucune activité sur cette période
          </div>
        ) : (
          <ChartContainer config={statusChartConfig} className="h-[240px] w-full">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, name, props) => [
                      `${formatNumber(value)} · ${formatNumber(props.payload.percentage, 1)}%`,
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
                outerRadius={90}
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
            <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: statusColors[index % statusColors.length] }}
                />
                <span className="truncate text-muted-foreground">{item.label}</span>
              </div>
              <span className="shrink-0 font-medium tabular-nums">
                {formatNumber(item.value)} · {formatNumber(item.percentage, 1)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function TopPerformersCard({ performers }) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-primary" />
          Top performers
        </CardTitle>
        <CardDescription>Classement sur la sélection</CardDescription>
      </CardHeader>
      <CardContent>
        {performers.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            Aucun performer à afficher
          </div>
        ) : (
          <div className="space-y-3">
            {performers.map((performer, index) => (
              <div
                key={`${performer.userType}-${performer.userId}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/30 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-sm font-bold">
                    {index === 0 ? <Medal className="h-4 w-4 text-amber-500" /> : index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{performer.userName}</p>
                    <p className="text-xs text-muted-foreground">
                      {performer.label} · {formatNumber(performer.contratsSignes)} contrats ·{' '}
                      {formatNumber(performer.rendezVousPris)} RDV
                    </p>
                    {performer.lastActivity && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Dernière activité · {formatRelativeDate(performer.lastActivity.changedAt)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold tabular-nums">
                    {formatNumber(performer.points)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(performer.tauxConversion, 1)}% conv.
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

function LastActivitiesCard({ activities }) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock3 className="h-4 w-4 text-primary" />
          Activités récentes
        </CardTitle>
        <CardDescription>Derniers changements de statut</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-center text-sm text-muted-foreground">
            Aucun changement récent sur cette sélection
          </div>
        ) : (
          <div className="space-y-3">
            {activities.slice(0, 6).map(activity => (
              <div
                key={`${activity.userType}-${activity.userId}`}
                className="rounded-lg border border-border/60 bg-muted/30 p-3"
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
                      Porte {activity.porteNumero} ·{' '}
                      {ACTIVITY_STATUS_LABELS[activity.statut] || activity.statut}
                    </p>
                    {activity.immeubleAdresse && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {activity.immeubleAdresse}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-right text-xs font-medium text-muted-foreground">
                    {formatRelativeDate(activity.changedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ZonePerformanceSection({ zones, summary }) {
  const chartData = zones.map(zone => ({
    name: zone.zoneName,
    contrats: zone.totalContratsSignes || 0,
    rdv: zone.totalRendezVousPris || 0,
    portes: zone.totalPortesProspectes || 0,
  }))

  return (
    <Card className="border-border/60">
      <CardHeader className="gap-3 border-b border-border/60 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-primary" />
            Performance par zone
          </CardTitle>
          <CardDescription>
            {summary.count} zone{summary.count > 1 ? 's' : ''} · {formatNumber(summary.portes)}{' '}
            portes
          </CardDescription>
        </div>
        {summary.bestZone && (
          <Badge variant="outline" className="w-fit bg-background">
            Meilleure zone · {summary.bestZone.zoneName}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="grid gap-6 pt-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <ChartContainer config={zoneChartConfig} className="h-[320px] w-full">
          <BarChart data={chartData} margin={{ left: -14, right: 12, top: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="contrats" fill="var(--color-contrats)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="rdv" fill="var(--color-rdv)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="portes" fill="var(--color-portes)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>

        <div className="min-w-0 overflow-hidden rounded-lg border border-border/60">
          <div className="grid grid-cols-[1fr_72px_72px_80px] border-b border-border/60 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Zone</span>
            <span className="text-right">Contrats</span>
            <span className="text-right">RDV</span>
            <span className="text-right">Perf.</span>
          </div>
          <div className="divide-y divide-border/60">
            {zones.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                Aucune zone à afficher
              </div>
            ) : (
              zones.map(zone => (
                <div
                  key={zone.zoneId}
                  className="grid grid-cols-[1fr_72px_72px_80px] items-center px-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{zone.zoneName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(zone.totalPortesProspectes || 0)} portes ·{' '}
                      {formatNumber(zone.nombreCommerciaux || 0)} intervenants
                    </p>
                  </div>
                  <span className="text-right font-medium tabular-nums">
                    {formatNumber(zone.totalContratsSignes || 0)}
                  </span>
                  <span className="text-right font-medium tabular-nums">
                    {formatNumber(zone.totalRendezVousPris || 0)}
                  </span>
                  <span className="text-right font-semibold tabular-nums">
                    {formatNumber(zone.performanceGlobale || 0, 1)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
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
    timelineData,
    topPerformers,
    lastStatusActivities,
    rankingStatistics,
    filteredCommercials,
    filteredDirecteurs,
    filteredManagers,
    zoneStatisticsData,
    zoneSummary,
    currentRole,
    periodLabel,
    dataModeLabel,
  } = useStatistiquesLogic()

  if (loading) return <PageSkeleton />

  if (error) {
    return (
      <div className="flex min-h-[420px] items-center justify-center p-6">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-4 h-8 w-8 text-destructive" />
          <p className="font-medium text-destructive">Erreur lors du chargement des statistiques</p>
          <p className="mt-2 text-sm text-muted-foreground">Veuillez réessayer plus tard</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Activity className="h-4 w-4" />
            Statistiques terrain
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Pilotage commercial</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {periodLabel} · {dataModeLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3.5 w-3.5" />
            {formatNumber(metrics.nbIntervenants)} intervenants
          </Badge>
          <Badge variant="outline" className="gap-1 bg-background">
            <Building2 className="h-3.5 w-3.5" />
            {formatNumber(metrics.nbImmeubles)} immeubles couverts
          </Badge>
        </div>
      </div>

      <FilterBar
        timePeriod={timePeriod}
        setTimePeriod={setTimePeriod}
        scopeType={scopeType}
        setScopeType={setScopeType}
        selectedOwner={selectedOwner}
        setSelectedOwner={setSelectedOwner}
        ownerOptions={ownerOptions}
        activeFiltersCount={activeFiltersCount}
        resetFilters={resetFilters}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Contrats signés"
          value={metrics.contratsSignes}
          description={`${formatNumber(metrics.tauxConversion, 1)}% de conversion`}
          icon={CheckCircle2}
          tone="success"
        />
        <MetricCard
          title="Portes prospectées"
          value={metrics.nbPortesProspectes}
          description={`${formatNumber(metrics.actionsTerrain)} actions terrain`}
          icon={DoorOpen}
          tone="info"
        />
        <MetricCard
          title="Rendez-vous pris"
          value={metrics.rendezVousPris}
          description={`${formatNumber(metrics.tauxRdv, 1)}% des portes prospectées`}
          icon={CalendarDays}
          tone="warning"
        />
        <MetricCard
          title="Taux contact"
          value={metrics.tauxContact}
          suffix="%"
          description={`${formatNumber(metrics.argumentes)} argumentés · ${formatNumber(metrics.refus)} refus`}
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard title="Absents" value={metrics.absents} icon={Clock3} />
        <MetricCard title="Argumentés" value={metrics.argumentes} icon={Users} />
        <MetricCard title="Refus" value={metrics.refus} icon={X} />
        <MetricCard title="Repassages" value={metrics.repassages} icon={RotateCcw} />
        <MetricCard title="Immeubles" value={metrics.nbImmeubles} icon={Building2} />
        <MetricCard title="Équipe" value={metrics.nbIntervenants} icon={Users} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TimelineCard
            data={timelineData}
            periodLabel={periodLabel}
            metrics={metrics}
            dataModeLabel={dataModeLabel}
          />
        </div>
        <FunnelCard data={funnelData} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <StatusDistributionCard data={statusBreakdown} />
        <TopPerformersCard performers={topPerformers} />
        <LastActivitiesCard activities={lastStatusActivities} />
      </div>

      <ZonePerformanceSection zones={zoneStatisticsData} summary={zoneSummary} />

      <CommercialRankingTable
        commercials={filteredCommercials}
        directeurs={filteredDirecteurs}
        managers={filteredManagers}
        statistics={rankingStatistics}
        currentUserRole={currentRole}
        title="Classement consolidé"
        description="Comparaison par rôle sur les statistiques synchronisées"
        limit={10}
      />
    </div>
  )
}
