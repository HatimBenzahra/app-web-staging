import React, { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Mic,
  UserX,
  MessageSquare,
  RotateCcw,
} from 'lucide-react'
import { formatDuration } from '../ecoutes/EnregistrementComponents'
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

function TodaysRecordingsCard({ segments, loading, navigate }) {
  const [expanded, setExpanded] = React.useState(false)

  const sorted = useMemo(() => {
    if (!segments?.length) return []
    return [...segments].sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt)
    })
  }, [segments])

  const stats = useMemo(() => {
    if (!segments?.length) return null
    const statuts = {}
    let totalDuration = 0
    const commerciaux = new Set()
    for (const seg of segments) {
      if (seg.statut) statuts[seg.statut] = (statuts[seg.statut] || 0) + 1
      if (seg.durationSec) totalDuration += seg.durationSec
      if (seg.commercialNom) commerciaux.add(seg.commercialNom)
    }
    return { total: segments.length, totalDuration, commerciaux: commerciaux.size, statuts }
  }, [segments])

  const visible = expanded ? sorted : sorted.slice(0, 10)
  const overflow = sorted.length > 10 ? sorted.length - 10 : 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/30">
              <Mic className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </div>
            <CardTitle className="text-sm font-semibold">Enregistrements du jour</CardTitle>
          </div>
          {sorted.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1.5 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/ecoutes/enregistrement')}
            >
              Tous les enregistrements
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* ── Summary stats ── */}
        {!loading && stats && (
          <div className="flex flex-wrap items-center gap-4 px-1">
            <div className="flex items-center gap-1.5">
              <Mic className="h-3.5 w-3.5 text-rose-500" />
              <span className="text-sm font-bold tabular-nums">{stats.total}</span>
              <span className="text-xs text-muted-foreground">segments</span>
            </div>
            <div className="h-4 w-px bg-border/60 shrink-0" />
            <div className="flex items-center gap-1.5">
              <DoorOpen className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-bold tabular-nums">{stats.commerciaux}</span>
              <span className="text-xs text-muted-foreground">commerciaux</span>
            </div>
            {stats.totalDuration > 0 && (
              <>
                <div className="h-4 w-px bg-border/60 shrink-0" />
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold tabular-nums">
                    {formatDuration(stats.totalDuration)}
                  </span>
                  <span className="text-xs text-muted-foreground">total</span>
                </div>
              </>
            )}
            <div className="h-4 w-px bg-border/60 shrink-0" />
            <div className="flex flex-wrap items-center gap-1.5">
              {Object.entries(stats.statuts).map(([statut, count]) => (
                <Badge
                  key={statut}
                  className={`text-[9px] px-1.5 py-0 leading-4 font-semibold border-0 ${getStatusColor(statut)}`}
                >
                  {getStatusLabel(statut)} {count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* ── Recording list ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl border border-border/40"
              >
                <div className="w-9 h-9 rounded-full bg-muted/60 shrink-0 animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-muted/60 rounded animate-pulse w-2/5" />
                  <div className="h-2.5 bg-muted/40 rounded animate-pulse w-3/5" />
                </div>
                <div className="h-6 w-10 bg-muted/50 rounded-md animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <div className="p-3 rounded-full bg-muted/50 mb-3">
              <Mic className="h-6 w-6 opacity-30" />
            </div>
            <p className="text-sm font-medium">Aucun enregistrement</p>
            <p className="text-xs mt-0.5">Les enregistrements du jour appara{'\u00ee'}tront ici</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {visible.map(seg => {
                const duration = formatDuration(seg.durationSec)
                const time = seg.createdAt
                  ? new Date(seg.createdAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : null
                const score = seg.speechScore != null ? Math.round(seg.speechScore) : null
                const initials = (seg.commercialNom || 'C')
                  .split(' ')
                  .map(w => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()
                const avatarColor = getAvatarColor(seg.commercialNom || '')
                const scoreColor =
                  score == null
                    ? 'text-muted-foreground'
                    : score >= 50
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : score >= 20
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400'
                const scoreBg =
                  score == null
                    ? 'bg-muted/40'
                    : score >= 50
                      ? 'bg-emerald-500/10'
                      : score >= 20
                        ? 'bg-amber-500/10'
                        : 'bg-red-500/10'
                const canNavigate = !!(seg.immeubleId && seg.porteId)

                return (
                  <button
                    type="button"
                    key={seg.id}
                    disabled={!canNavigate}
                    onClick={() => {
                      if (canNavigate) {
                        navigate(`/immeubles/${seg.immeubleId}/portes/${seg.porteId}`)
                      }
                    }}
                    className="group flex items-center gap-3 w-full rounded-xl border border-border/50 p-3 text-left hover:border-border hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${avatarColor}`}
                    >
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[13px] font-semibold truncate leading-tight">
                          {seg.commercialNom || 'Commercial'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{seg.immeubleAdresse || 'Immeuble'}</span>
                        {seg.porteNumero != null && (
                          <>
                            <span className="shrink-0 text-border/80">&middot;</span>
                            <span className="shrink-0">P.{seg.porteNumero}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {seg.statut && (
                          <Badge
                            className={`text-[9px] px-1.5 py-0 leading-4 font-semibold border-0 ${getStatusColor(seg.statut)}`}
                          >
                            {getStatusLabel(seg.statut)}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                          {time}
                          {duration && ` \u00b7 ${duration}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {score != null ? (
                        <div
                          className={`flex items-center gap-0.5 px-2 py-1 rounded-lg ${scoreBg}`}
                        >
                          <span
                            className={`text-base font-bold tabular-nums leading-none ${scoreColor}`}
                          >
                            {score}
                          </span>
                          <span
                            className={`text-[9px] font-semibold leading-none ${scoreColor} opacity-70`}
                          >
                            %
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-muted/30">
                          <span className="text-[10px] text-muted-foreground/50">—</span>
                        </div>
                      )}
                      <ArrowRight className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                )
              })}
            </div>

            {overflow > 0 && !expanded && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl border border-dashed border-border/60 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/20 transition-all"
              >
                +{overflow} segment{overflow > 1 ? 's' : ''} de plus
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
            {expanded && sorted.length > 10 && (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl border border-dashed border-border/60 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/20 transition-all"
              >
                Voir moins
              </button>
            )}
          </>
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
    segments,
    segmentsLoading,
    data: { immeubles, assignments, rdvToday, portesModifiedToday },
  } = useDashboardLogic()

  const navigate = useNavigate()

  const todayImmeubles = useMemo(() => {
    if (!immeubles || !portesModifiedToday) return []
    const todayIds = new Set(portesModifiedToday.map(p => p.immeubleId))
    return immeubles.filter(imm => todayIds.has(imm.id))
  }, [immeubles, portesModifiedToday])

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

      {/* ── Stats détaillées par statut ── */}
      <div className="dash-stagger" style={{ animationDelay: '120ms' }}>
        <Card className="border-border/50">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-emerald-500/10">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm font-bold tabular-nums">{totals.immeubles}</span>
                <span className="text-xs text-muted-foreground">immeubles</span>
              </div>
              <div className="h-4 w-px bg-border/60 shrink-0" />
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-red-500/10">
                  <UserX className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                </div>
                <span className="text-sm font-bold tabular-nums">{totals.refus}</span>
                <span className="text-xs text-muted-foreground">refus</span>
              </div>
              <div className="h-4 w-px bg-border/60 shrink-0" />
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-slate-500/10">
                  <DoorOpen className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <span className="text-sm font-bold tabular-nums">{totals.absents}</span>
                <span className="text-xs text-muted-foreground">absents</span>
              </div>
              <div className="h-4 w-px bg-border/60 shrink-0" />
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-indigo-500/10">
                  <MessageSquare className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="text-sm font-bold tabular-nums">{totals.argumentes}</span>
                <span className="text-xs text-muted-foreground">argument{'é'}s</span>
              </div>
              <div className="h-4 w-px bg-border/60 shrink-0" />
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-orange-500/10">
                  <RotateCcw className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                </div>
                <span className="text-sm font-bold tabular-nums">{totals.repassages}</span>
                <span className="text-xs text-muted-foreground">repassages</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Map : pleine largeur ── */}
      <div className="dash-stagger" style={{ animationDelay: '160ms' }}>
        <FleetTerrainWidget todayImmeubles={todayImmeubles} />
      </div>

      {/* ── Enregistrements du jour : pleine largeur ── */}
      <div className="dash-stagger" style={{ animationDelay: '220ms' }}>
        <TodaysRecordingsCard segments={segments} loading={segmentsLoading} navigate={navigate} />
      </div>

      {/* ── RDV du jour (pleine largeur si présents) ── */}
      {rdvToday && rdvToday.length > 0 && (
        <div className="dash-stagger" style={{ animationDelay: '240ms' }}>
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
        </div>
      )}

      {/* ── WinLead+ Stats : Performances + Offres ── */}
      <div className="dash-stagger" style={{ animationDelay: '320ms' }}>
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/30">
              <TrendingUp className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">WinLead+ Stats</h2>
              <p className="text-[11px] text-muted-foreground">
                Performances et contrats sync WinLead+
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Top3PerfCard
              mode={perfMode}
              setMode={setPerfMode}
              top3={top3}
              loading={rankingLoading}
            />
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
      </div>

      <div className="dash-stagger" style={{ animationDelay: '400ms' }}>
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
