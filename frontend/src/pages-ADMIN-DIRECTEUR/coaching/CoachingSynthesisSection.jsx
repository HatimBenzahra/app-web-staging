import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GraduationCap,
  Loader2,
  Sparkles,
  ClipboardList,
  ThumbsUp,
  TrendingUp,
  ListChecks,
  TrendingDown,
  Minus,
  ArrowUpRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import CoachingService from '@/services/coaching/coaching.service'

const POLL_MS = 5000

// Date courte JJ/MM/AAAA (tolère null / ISO).
function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const TREND_META = {
  progresse: { label: 'En progression', icon: ArrowUpRight, cls: 'bg-green-500/10 text-green-600' },
  stagne: { label: 'Stable', icon: Minus, cls: 'bg-slate-500/10 text-slate-600' },
  regresse: { label: 'En baisse', icon: TrendingDown, cls: 'bg-red-500/10 text-red-600' },
}

function Block({ icon: Icon, title, items, tone }) {
  const list = items || []
  if (!list.length) return null
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className={cn('mb-2 flex items-center gap-1.5 text-sm font-medium', tone)}>
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <ul className="space-y-1.5">
        {list.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm text-foreground/90">
            <span className="select-none text-muted-foreground">–</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Section « Synthèse coaching » d'une fiche commercial / manager : bilan global
 * généré par le LLM (hors pipeline audio). Prop `commercialId` OU `managerId`.
 */
export default function CoachingSynthesisSection({ commercialId, managerId }) {
  const subjectType = commercialId != null ? 'commercial' : 'manager'
  const subjectId = commercialId != null ? commercialId : managerId

  const [syn, setSyn] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const pollRef = useRef(null)

  const load = useCallback(async () => {
    if (subjectId == null) return
    const s = await CoachingService.getSynthesis(subjectType, subjectId)
    setSyn(s)
    setLoading(false)
    return s
  }, [subjectType, subjectId])

  useEffect(() => {
    load()
  }, [load])

  const inProgress = syn && ['PENDING', 'ANALYZING'].includes(syn.status)

  // Poll tant que la génération est en cours.
  useEffect(() => {
    if (!inProgress) {
      if (pollRef.current) clearInterval(pollRef.current)
      return
    }
    pollRef.current = setInterval(load, POLL_MS)
    return () => pollRef.current && clearInterval(pollRef.current)
  }, [inProgress, load])

  const generate = async () => {
    setGenerating(true)
    try {
      const s = await CoachingService.generateSynthesis(subjectType, subjectId)
      if (s) setSyn(s)
    } finally {
      setGenerating(false)
    }
  }

  const trend = TREND_META[syn?.trend] || null
  const ready = syn?.status === 'READY'

  return (
    <Card className="border-border/60 bg-card">
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600">
              <GraduationCap className="h-4 w-4" />
            </span>
            <h3 className="text-base font-semibold">Synthèse coaching</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={generate}
            disabled={generating || inProgress}
          >
            {generating || inProgress ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {syn ? 'Régénérer' : 'Générer'}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        ) : inProgress ? (
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Génération de la synthèse en cours…
          </div>
        ) : syn?.status === 'FAILED' ? (
          <div className="rounded-lg bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Échec de la génération{syn.error ? ` : ${syn.error}` : ''}.
          </div>
        ) : !syn || !ready ? (
          <p className="text-sm text-muted-foreground">
            Pas encore de synthèse pour ce {subjectType === 'manager' ? 'manager' : 'commercial'}.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Bandeau : tendance · score · nb analyses */}
            <div className="flex flex-wrap items-center gap-3">
              {trend && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                    trend.cls,
                  )}
                >
                  <trend.icon className="h-3.5 w-3.5" />
                  {trend.label}
                </span>
              )}
              <span className="text-sm">
                <span className="font-serif text-lg tabular-nums">
                  {syn.scoreMoyen ?? '—'}
                </span>
                <span className="text-muted-foreground">/100 moyen</span>
              </span>
              <span className="text-sm text-muted-foreground">
                · {syn.nbAnalyses} session{syn.nbAnalyses > 1 ? 's' : ''} analysée
                {syn.nbAnalyses > 1 ? 's' : ''}
              </span>
            </div>

            {/* Période couverte par les sessions jugées */}
            {(syn.periodStart || syn.periodEnd) && (
              <p className="text-xs text-muted-foreground">
                Période couverte : du{' '}
                <span className="font-medium text-foreground/80">{fmtDate(syn.periodStart)}</span>{' '}
                au{' '}
                <span className="font-medium text-foreground/80">{fmtDate(syn.periodEnd)}</span>
              </p>
            )}

            {/* Analyse détaillée (tirets fouillés : contrats, portes, durées, refus, absences…) */}
            <Block
              icon={ClipboardList}
              title="Analyse détaillée"
              items={syn.analyse}
              tone="text-foreground"
            />

            {/* Forces / Axes / Priorités */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Block icon={ThumbsUp} title="Forces" items={syn.strengths} tone="text-green-600" />
              <Block icon={TrendingUp} title="À améliorer" items={syn.improvements} tone="text-amber-600" />
              <Block icon={ListChecks} title="Priorités" items={syn.priorities} tone="text-indigo-600" />
            </div>

            {syn.generatedAt && (
              <p className="text-xs text-muted-foreground">
                Généré le{' '}
                {new Date(syn.generatedAt).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
