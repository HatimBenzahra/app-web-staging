import { useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  RotateCw,
  ThumbsUp,
  TrendingUp,
  Lightbulb,
  CheckCircle2,
  XCircle,
  MinusCircle,
  CircleDashed,
  Clock,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import AudioPlayer from '@/components/AudioPlayer'
import RecordingService from '@/services/audio/recordings/recording.service'
import {
  ScoreBar,
  StatusPill,
  QualityPill,
  PorteStatutPill,
  CRITERION_META,
  parseRecordingKey,
  formatDateTime,
  formatDuration,
  isInProgress,
} from './CoachingComponents'

function VerdictIcon({ status }) {
  const cls = 'h-4 w-4 shrink-0'
  if (status === 'atteint') return <CheckCircle2 className={cn(cls, 'text-green-600')} />
  if (status === 'partiel') return <MinusCircle className={cn(cls, 'text-amber-600')} />
  if (status === 'non_applicable') return <CircleDashed className={cn(cls, 'text-muted-foreground')} />
  return <XCircle className={cn(cls, 'text-red-600')} />
}

function ListBlock({ icon: Icon, title, items, tone }) {
  const list = items || []
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className={cn('mb-2 flex items-center gap-1.5 text-sm font-medium', tone)}>
        <Icon className="h-4 w-4" />
        {title}
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-1.5">
          {list.map((it, i) => (
            <li key={i} className="flex gap-1.5 text-sm text-foreground/90">
              <span className="text-muted-foreground">•</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function CoachingDetailModal({
  open,
  onOpenChange,
  analysis,
  recordingKey,
  onRelaunch,
  relaunching,
}) {
  const [audioUrl, setAudioUrl] = useState(null)

  useEffect(() => {
    let active = true
    if (open && recordingKey) {
      RecordingService.getStreamingUrl(recordingKey)
        .then((url) => active && setAudioUrl(url))
        .catch(() => {})
    } else {
      setAudioUrl(null)
    }
    return () => {
      active = false
    }
  }, [open, recordingKey])

  // Regroupe les critères par étape (checklist complète du plan).
  const stepGroups = useMemo(() => {
    if (!analysis) return []
    const byStep = {}
    for (const c of analysis.criterionResults || []) {
      ;(byStep[c.stepKey] ||= []).push(c)
    }
    const subScores = analysis.subScores || []
    // ordre = subScores (ordre du plan) ; fallback = ordre d'apparition
    const ordered =
      subScores.length > 0
        ? subScores.map((s) => ({ step: s, criteria: byStep[s.key] || [] }))
        : Object.keys(byStep).map((k) => ({
            step: { key: k, label: k, applicable: true, score: null },
            criteria: byStep[k],
          }))
    return ordered.filter((g) => g.criteria.length > 0)
  }, [analysis])

  if (!analysis) return null

  const meta = parseRecordingKey(analysis.s3KeyOriginal || recordingKey)
  const inProgress = isInProgress(analysis.status)
  const hasScore = typeof analysis.score === 'number'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl flex max-h-[92vh] flex-col gap-0 p-0 overflow-hidden">
        {/* En-tête */}
        <DialogHeader className="border-b p-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate text-lg">
                {meta.address || 'Enregistrement'}
              </DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {meta.role && <span>{meta.role} #{meta.userId}</span>}
                <span>·</span>
                <span>{formatDateTime(meta.date)}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(analysis.transcriptDurationSec)}
                </span>
              </DialogDescription>
              {analysis.statutPorte && (
                <div className="mt-2">
                  <PorteStatutPill statut={analysis.statutPorte} />
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <StatusPill status={analysis.status} />
                <QualityPill quality={analysis.quality} />
              </div>
              <div className="text-right">
                <div className="text-3xl font-semibold leading-none">
                  {hasScore ? Math.round(analysis.score) : '—'}
                  <span className="text-base text-muted-foreground">/100</span>
                </div>
                {typeof analysis.confidence === 'number' && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    confiance {Math.round(analysis.confidence)}%
                  </div>
                )}
              </div>
            </div>
          </div>
          {hasScore && <ScoreBar value={analysis.score} className="mt-3" />}
        </DialogHeader>

        {/* Corps défilant */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {inProgress && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyse en cours… (transcription puis évaluation IA)
            </div>
          )}
          {analysis.status === 'FAILED' && analysis.error && (
            <div className="rounded-lg bg-destructive/5 px-3 py-2 text-sm text-destructive">
              Échec : {analysis.error}
            </div>
          )}
          {analysis.quality === 'INEXPLOITABLE' && (
            <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              Échange trop court ou inexploitable — pas de score fiable.
            </div>
          )}

          {audioUrl && (
            <AudioPlayer src={audioUrl} title={meta.address || 'Enregistrement'} />
          )}

          {analysis.summary && (
            <div>
              <h3 className="mb-1.5 text-sm font-semibold">Résumé</h3>
              <p className="text-sm text-foreground/90">{analysis.summary}</p>
            </div>
          )}

          {(analysis.strengths?.length ||
            analysis.improvements?.length ||
            analysis.recommendations?.length) > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              <ListBlock icon={ThumbsUp} title="Forces" items={analysis.strengths} tone="text-green-600" />
              <ListBlock icon={TrendingUp} title="À améliorer" items={analysis.improvements} tone="text-amber-600" />
              <ListBlock icon={Lightbulb} title="Recommandations" items={analysis.recommendations} tone="text-indigo-600" />
            </div>
          )}

          {/* Checklist complète du plan, par étape */}
          {stepGroups.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">
                Déroulé du plan de vente
              </h3>
              <div className="space-y-3">
                {stepGroups.map(({ step, criteria }) => (
                  <div key={step.key} className="rounded-lg border border-border/60">
                    <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/40 px-3 py-2">
                      <span className="text-sm font-medium">{step.label}</span>
                      {step.applicable && typeof step.score === 'number' ? (
                        <div className="flex items-center gap-2">
                          <ScoreBar value={step.score} className="w-24" />
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {Math.round(step.score)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Non applicable</span>
                      )}
                    </div>
                    <ul className="divide-y divide-border/60">
                      {criteria.map((c) => {
                        const cm = CRITERION_META[c.status] || CRITERION_META.absent
                        return (
                          <li key={c.criterionKey} className="px-3 py-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2">
                                <span className="mt-0.5">
                                  <VerdictIcon status={c.status} />
                                </span>
                                <div>
                                  <div className="text-sm">{c.title}</div>
                                  <div className={cn('text-xs', cm.text)}>{cm.label}</div>
                                </div>
                              </div>
                              {c.status !== 'non_applicable' && (
                                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                  {Math.round(c.score)}/{c.maxPoints}
                                </span>
                              )}
                            </div>
                            {c.evidence?.length > 0 && (
                              <ul className="mt-1.5 space-y-1 border-l-2 border-border/60 pl-3">
                                {c.evidence.map((e, i) => (
                                  <li key={i} className="text-xs italic text-muted-foreground">
                                    « {e} »
                                  </li>
                                ))}
                              </ul>
                            )}
                            {c.comment && (
                              <p className="mt-1.5 text-xs text-foreground/80">{c.comment}</p>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transcription (bien visible) */}
          {analysis.transcript && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">
                Transcription
                {typeof analysis.transcriptDurationSec === 'number' &&
                  ` · ${formatDuration(analysis.transcriptDurationSec)}`}
              </h3>
              <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed text-foreground/90">
                {analysis.transcript}
              </div>
            </div>
          )}
        </div>

        {/* Pied */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRelaunch}
            disabled={relaunching || inProgress}
          >
            {relaunching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="h-4 w-4" />
            )}
            Relancer
          </Button>
          <span className="text-xs text-muted-foreground">
            {analysis.planSlug} v{analysis.planVersion}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
