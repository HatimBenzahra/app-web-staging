import React, { useEffect } from 'react'
import ActiveZonesSlider_Dashboard from '@/components/ActiveZonesSlider_Dashboard'
import { Pagination } from '@/components/Pagination'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getStatusLabel, getStatusColor } from '@/constants/domain/porte-status'
import {
  Building2,
  Users,
  Trophy,
  Medal,
  Award,
  TrendingUp,
  Calendar,
  ArrowRight,
  DoorOpen,
  Loader2,
  Star,
  FileText,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardLogic } from './useDashboardLogic'
import PorteDetailModal from './PorteDetailModal'
import FleetTerrainWidget from './FleetTerrainWidget'

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

function buildMonthOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    options.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return options
}

const MONTH_OPTIONS = buildMonthOptions()

const PODIUM_STYLES = [
  {
    ring: 'ring-yellow-400/50',
    bg: 'bg-yellow-50 dark:bg-yellow-950/30',
    border: 'border-yellow-300 dark:border-yellow-700',
    text: 'text-yellow-600 dark:text-yellow-400',
    icon: Trophy,
    size: 'h-16 w-16',
    badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  },
  {
    ring: 'ring-slate-300/50',
    bg: 'bg-slate-50 dark:bg-slate-800/40',
    border: 'border-slate-300 dark:border-slate-600',
    text: 'text-slate-500 dark:text-slate-400',
    icon: Medal,
    size: 'h-13 w-13',
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  {
    ring: 'ring-orange-300/50',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-300 dark:border-orange-700',
    text: 'text-orange-600 dark:text-orange-400',
    icon: Award,
    size: 'h-13 w-13',
    badge: 'bg-orange-100 text-orange-800 border-orange-300',
  },
]

const AVATAR_COLORS = [
  'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
  'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
]

function getAvatarColor(name) {
  const index = (name || 'A').charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

const PERF_MODES = [
  { value: 'DAILY', label: 'Du jour' },
  { value: 'MONTHLY', label: 'Du mois' },
]

function Top3PerfCard({ mode, setMode, top3, loading }) {
  const modeLabel = mode === 'DAILY' ? 'du jour' : 'du mois'

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <Trophy className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold">Meilleures performances</CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Top commerciaux & managers {modeLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center shrink-0">
            <div className="flex items-center rounded-lg border border-border/70 p-0.5 bg-muted/30">
              {PERF_MODES.map(m => (
                <button
                  type="button"
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    mode === m.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : top3.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <div className="p-3 rounded-full bg-muted/50 mb-3">
              <Trophy className="h-6 w-6 opacity-30" />
            </div>
            <p className="text-sm font-medium">Aucune performance {modeLabel}</p>
            <p className="text-xs mt-0.5">
              Les donn{'é'}es apparaîtront apr{'è'}s la synchronisation
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {top3.map((entry, i) => {
              const style = PODIUM_STYLES[i]
              const PodiumIcon = style.icon
              const nom = entry.commercialNom || entry.managerNom || ''
              const prenom = entry.commercialPrenom || entry.managerPrenom || ''
              const isManager = !!entry.managerId && !entry.commercialId
              const initials = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase()

              return (
                <div
                  key={entry.id}
                  className={`relative flex flex-col items-center rounded-xl border ${style.border} p-4 hover:shadow-md transition-all duration-200 ${i === 0 ? 'sm:-mt-1 sm:pb-5 bg-linear-to-b from-yellow-50/50 to-transparent dark:from-yellow-950/10' : 'bg-muted/20'}`}
                >
                  <div
                    className={`absolute -top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${style.badge}`}
                  >
                    <PodiumIcon className="h-3 w-3" />#{i + 1}
                  </div>

                  <div
                    className={`${style.size} rounded-full border-2 ${style.border} ring-4 ${style.ring} flex items-center justify-center text-sm font-bold shrink-0 mb-2.5 ${getAvatarColor(prenom)}`}
                  >
                    {initials}
                  </div>

                  <p className="text-xs font-semibold text-center truncate max-w-full">
                    {prenom} {nom}
                  </p>
                  {isManager && (
                    <Badge variant="outline" className="text-[9px] mt-1">
                      Manager
                    </Badge>
                  )}

                  <div className="flex items-center gap-2.5 mt-2.5 pt-2.5 border-t border-border/40 w-full justify-center">
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-sky-500" />
                      <span className="text-xs font-bold tabular-nums">{entry.points}</span>
                      <span className="text-[9px] text-muted-foreground">pts</span>
                    </div>
                    <div className="w-px h-3.5 bg-border/40" />
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3 text-emerald-500" />
                      <span className="text-xs font-bold tabular-nums">{entry.contratsSignes}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getOffreLogoUrl(logoUrl) {
  if (!logoUrl) return null
  if (logoUrl.startsWith('http')) return logoUrl
  return `https://www.winleadplus.com${logoUrl}`
}

function TopOffresCard({
  selectedMonth,
  setSelectedMonth,
  distribution,
  loading,
  totalContrats,
  maxCount,
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/30">
              <TrendingUp className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold">Offres les plus sign{'é'}es</CardTitle>
              {totalContrats > 0 && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {totalContrats} contrats valid{'é'}s
                </p>
              )}
            </div>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-36 h-8 text-xs shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map(opt => (
                <SelectItem key={opt.key} value={opt.key} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !distribution?.length ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <FileText className="h-6 w-6 opacity-30 mb-2" />
            <p className="text-sm">Aucun contrat ce mois</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {distribution.slice(0, 8).map((entry, i) => {
              const pct = Math.round((entry.count / maxCount) * 100)
              const isTop3 = i < 3
              return (
                <div
                  key={entry.offreId}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${isTop3 ? 'bg-muted/40' : ''}`}
                >
                  <span
                    className={`text-[11px] font-bold tabular-nums w-5 text-center shrink-0 ${
                      i === 0
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : i === 1
                          ? 'text-slate-500'
                          : i === 2
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-muted-foreground'
                    }`}
                  >
                    {i + 1}
                  </span>
                  {entry.logoUrl ? (
                    <img
                      src={getOffreLogoUrl(entry.logoUrl)}
                      alt=""
                      aria-hidden="true"
                      className="h-8 w-8 rounded-lg border border-border/50 object-contain bg-white dark:bg-muted/50 p-0.5 shrink-0"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-lg border border-border/50 bg-white dark:bg-muted/50 flex items-center justify-center shrink-0">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p
                        className={`text-xs truncate pr-2 ${isTop3 ? 'font-semibold' : 'font-medium text-muted-foreground'}`}
                      >
                        {entry.nom}
                      </p>
                      <span
                        className={`text-xs tabular-nums shrink-0 ${isTop3 ? 'font-bold' : 'font-medium text-muted-foreground'}`}
                      >
                        {entry.count}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          i === 0
                            ? 'bg-sky-500'
                            : i === 1
                              ? 'bg-sky-400'
                              : i === 2
                                ? 'bg-sky-400/70'
                                : 'bg-sky-300/50 dark:bg-sky-700/50'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const KPI_COLORS = {
  emerald: {
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    accent: 'border-l-4 border-l-emerald-500',
  },
  blue: {
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    accent: 'border-l-4 border-l-blue-500',
  },
  amber: {
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    accent: 'border-l-4 border-l-amber-500',
  },
  violet: {
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    iconColor: 'text-violet-600 dark:text-violet-400',
    accent: 'border-l-4 border-l-violet-500',
  },
}

// eslint-disable-next-line no-unused-vars -- Icon is used as JSX component
function KpiCard({ title, value, description, icon: Icon, trend, color = 'blue' }) {
  const isPositive = trend && trend > 0
  const colors = KPI_COLORS[color] || KPI_COLORS.blue
  return (
    <Card
      className={`relative overflow-hidden hover:scale-[1.02] transition-all duration-200 cursor-default ${colors.accent}`}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">
              <AnimatedNumber value={value} />
            </p>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${colors.iconBg}`}>
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
  const {
    today,
    totals,
    tauxConversion,
    paginatedRdv,
    currentRdvPage,
    setCurrentRdvPage,
    selectedPorteId,
    setSelectedPorteId,
    isLoading,
    perfMode,
    setPerfMode,
    top3,
    rankingLoading,
    offreMonth,
    setOffreMonth,
    offreDistribution,
    offreDistributionLoading,
    offreTotalContrats,
    offreMaxCount,
    data: { immeubles, assignments, rdvToday },
  } = useDashboardLogic()

  useEffect(() => {
    const saved = sessionStorage.getItem('dashboard-scroll')
    if (saved && !isLoading) {
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(saved, 10))
      })
    }
  }, [isLoading])

  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem('dashboard-scroll', String(window.scrollY))
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 rounded-xl border border-border/60 p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="lg:col-span-2 rounded-xl border border-border/60 p-6 space-y-3">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
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
          description={`${totals.immeubles} immeuble${totals.immeubles > 1 ? 's' : ''} prospecté${totals.immeubles > 1 ? 's' : ''}`}
          icon={TrendingUp}
          color="violet"
        />
      </div>

      <div
        className="grid grid-cols-1 lg:grid-cols-5 gap-6 dash-stagger"
        style={{ animationDelay: '160ms' }}
      >
        <div className="lg:col-span-3 flex">
          <FleetTerrainWidget />
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          {rdvToday && rdvToday.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calendar className="h-4 w-4 text-primary" />
                    RDV du jour
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {rdvToday.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  {paginatedRdv.items.map(porte => {
                    const immeuble = immeubles?.find(imm => imm.id === porte.immeubleId)
                    return (
                      <button
                        type="button"
                        key={porte.id}
                        onClick={() => setSelectedPorteId(porte.id)}
                        className="group flex items-start gap-3 w-full px-4 py-3.5 text-left hover:bg-muted/30 transition-colors active:scale-[0.99]"
                      >
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
                          <DoorOpen className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-semibold leading-none truncate">
                              {immeuble?.adresse || '—'} — Porte {porte.numero}
                              {porte.etage != null && (
                                <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                                  · Ét. {porte.etage}
                                </span>
                              )}
                            </span>
                            <span className="text-[13px] font-bold tabular-nums text-primary shrink-0">
                              {porte.rdvTime || '—'}
                            </span>
                          </div>
                          {porte.nomPersonnalise && (
                            <p className="text-[12px] text-muted-foreground truncate leading-none">
                              {porte.nomPersonnalise}
                            </p>
                          )}
                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Badge
                                className={`text-[10px] px-1.5 py-0 leading-5 font-medium border-0 ${getStatusColor(porte.statut)}`}
                              >
                                {getStatusLabel(porte.statut)}
                              </Badge>
                              {immeuble?.commercial && (
                                <span className="text-[11px] text-muted-foreground truncate">
                                  {immeuble.commercial.prenom} {immeuble.commercial.nom}
                                </span>
                              )}
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
                {paginatedRdv.totalPages > 1 && (
                  <div className="px-4 py-2 border-t">
                    <Pagination
                      currentPage={currentRdvPage}
                      totalPages={paginatedRdv.totalPages}
                      startIndex={paginatedRdv.startIndex}
                      endIndex={paginatedRdv.endIndex}
                      totalItems={rdvToday.length}
                      itemLabel="rendez-vous"
                      onPrevious={() => setCurrentRdvPage(prev => Math.max(1, prev - 1))}
                      onNext={() =>
                        setCurrentRdvPage(prev => Math.min(paginatedRdv.totalPages, prev + 1))
                      }
                      hasPreviousPage={currentRdvPage > 1}
                      hasNextPage={currentRdvPage < paginatedRdv.totalPages}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <TopOffresCard
            selectedMonth={offreMonth}
            setSelectedMonth={setOffreMonth}
            distribution={offreDistribution}
            loading={offreDistributionLoading}
            totalContrats={offreTotalContrats}
            maxCount={offreMaxCount}
          />
        </div>
      </div>

      <div className="dash-stagger" style={{ animationDelay: '240ms' }}>
        <Top3PerfCard mode={perfMode} setMode={setPerfMode} top3={top3} loading={rankingLoading} />
      </div>

      <div className="dash-stagger" style={{ animationDelay: '320ms' }}>
        <ActiveZonesSlider_Dashboard assignments={assignments || []} />
      </div>

      <PorteDetailModal
        open={selectedPorteId !== null}
        onOpenChange={open => {
          if (!open) setSelectedPorteId(null)
        }}
        porteId={selectedPorteId}
        immeuble={
          selectedPorteId
            ? immeubles?.find(
                imm => rdvToday?.find(p => p.id === selectedPorteId)?.immeubleId === imm.id
              )
            : null
        }
      />
    </div>
  )
}
