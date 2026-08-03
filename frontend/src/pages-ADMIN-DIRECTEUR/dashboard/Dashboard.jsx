import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Trophy, TrendingUp, Calendar, DoorOpen } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardLogic } from './useDashboardLogic'
import TerrainToday from './TerrainToday'
import ProspectionCharts from './ProspectionCharts'

function AnimatedNumber({ value, duration = 800 }) {
  const [display, setDisplay] = React.useState(0)
  const isPercentage = typeof value === 'string' && String(value).endsWith('%')
  const numericValue = isPercentage ? parseInt(value) : Number(value) || 0

  React.useEffect(() => {
    if (numericValue === 0) {
      setDisplay(0)
      return
    }
    const start = performance.now()
    let raf
    const step = now => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(numericValue * eased))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [numericValue, duration])

  return (
    <>
      {display}
      {isPercentage ? '%' : ''}
    </>
  )
}

const KPI_COLORS = {
  emerald: {
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  blue: {
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  amber: {
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  violet: {
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
}

// eslint-disable-next-line no-unused-vars -- Icon is used as JSX component
function KpiCard({ title, value, description, icon: Icon, trend, color = 'blue' }) {
  const isPositive = trend && trend > 0
  const colors = KPI_COLORS[color] || KPI_COLORS.blue
  return (
    <Card className="relative overflow-hidden border-border/60 bg-card hover:shadow-md transition-shadow duration-200 cursor-default">
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">
              <AnimatedNumber value={value} />
            </p>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 ${colors.iconBg}`}
          >
            <Icon className={`h-5 w-5 ${colors.iconColor}`} />
          </div>
        </div>
        {trend !== undefined && trend !== null && (
          <div
            className={`flex items-center gap-1 mt-3 text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}
          >
            <TrendingUp className={`h-3 w-3 ${!isPositive ? 'rotate-180' : ''}`} />
            {isPositive ? '+' : ''}
            {trend} vs hier
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const { today, totals, tauxConversion, isLoading } = useDashboardLogic()

  if (isLoading)
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-48" />
          </div>
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl border border-border/60 p-6 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-11 w-11 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )

  return (
    <div className="flex flex-col gap-6">
      <style>{`
        @keyframes dashFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dash-stagger { animation: dashFadeIn 0.5s ease-out forwards; opacity: 0; }
      `}</style>
      <div
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 dash-stagger"
        style={{ animationDelay: '0ms' }}
      >
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir'} 👋
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span className="text-sm font-medium">
            {today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 dash-stagger"
        style={{ animationDelay: '80ms' }}
      >
        <KpiCard
          title="Contrats signés"
          value={totals.contrats}
          description="Signatures du jour"
          icon={Trophy}
          color="emerald"
        />
        <KpiCard
          title="Portes prospectées"
          value={totals.portes}
          description="Visites effectuées"
          icon={DoorOpen}
          color="blue"
        />
        <KpiCard
          title="Rendez-vous pris"
          value={totals.rdv}
          description="Planifiés aujourd'hui"
          icon={Calendar}
          color="amber"
        />
        <KpiCard
          title="Taux de conversion"
          value={tauxConversion}
          description={`${totals.immeubles} bâtiment${totals.immeubles > 1 ? 's' : ''} prospecté${totals.immeubles > 1 ? 's' : ''}`}
          icon={TrendingUp}
          color="violet"
        />
      </div>

      {/* ── Terrain du jour : carte dominante + commerciaux actifs ── */}
      <div className="dash-stagger" style={{ animationDelay: '160ms' }}>
        <TerrainToday />
      </div>

      {/* ── Graphes de prospection ── */}
      <div className="dash-stagger" style={{ animationDelay: '240ms' }}>
        <ProspectionCharts />
      </div>
    </div>
  )
}
