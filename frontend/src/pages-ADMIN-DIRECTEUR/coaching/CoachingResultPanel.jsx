import { useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  ThumbsUp,
  TrendingUp,
  Lightbulb,
  CheckCircle2,
  XCircle,
  MinusCircle,
  CircleDashed,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import AudioPlayer from '@/components/AudioPlayer'
import RecordingService from '@/services/audio/recordings/recording.service'
import {
  ScoreBar,
  StatusPill,
  QualityPill,
  CRITERION_META,
  formatDuration,
  isInProgress,
} from './CoachingComponents'

function VerdictIcon({ status }) {
  const cls = 'h-4 w-4 shrink-0'
  if (status === 'atteint') return <CheckCircle2 className={cn(cls, 'text-green-600')} />
  if (status === 'partiel') return <MinusCircle className={cn(cls, 'text-amber-600')} />
  if (status === 'non_applicable')
    return <CircleDashed className={cn(cls, 'text-muted-foreground')} />
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

/**
 * Contenu réutilisable d'une analyse de coaching (hors Dialog) : bannières
 * d'état, lecteur audio optionnel, résumé, forces/axes/reco, déroulé du plan,
 * transcription. Utilisé par CoachingDetailModal ET dans le modal de la porte.
 */
export default function CoachingResultPanel({
  analysis,
  recordingKey,
  showAudio = true,
  showScoreHeader = false,
  showTranscript = true,
}) {
  const [audioUrl, setAudioUrl] = useState(null)

  useEffect(() => {
    let active = true
    const key = recordingKey || analysis?.s3KeyOriginal
    if (showAudio && key) {
      RecordingService.getStreamingUrl(key)
        .then((url) => active && setAudioUrl(url))
        .catch(() => {})
    } else {
      setAudioUrl(null)
    }
    return () => {
      active = false
    }
  }, [showAudio, recordingKey, analysis?.s3KeyOriginal])

  const stepGroups = useMemo(() => {
    if (!analysis) return []
    const byStep = {}
    for (const c of analysis.criterionResults || []) {
      ;(byStep[c.stepKey] ||= []).push(c)
    }
    const subScores = analysis.subScores || []
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

  const inProgress = isInProgress(analysis.status)
  const hasScore = typeof analysis.score === 'number'

  return (
    <div className="space-y-5">
      {showScoreHeader && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            <StatusPill status={analysis.status} />
            <QualityPill quality={analysis.quality} />
          </div>
          <div className="flex items-center gap-3">
            {hasScore && <ScoreBar value={analysis.score} className="w-28" />}
            <div className="text-2xl font-semibold leading-none tabular-nums">
              {hasScore ? Math.round(analysis.score) : '—'}
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          </div>
        </div>
      )}

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

      {showAudio && audioUrl && <AudioPlayer src={audioUrl} title="Enregistrement" />}

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

      {stepGroups.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Déroulé du plan de vente</h3>
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

      {showTranscript && analysis.transcript && (
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
  )
}
