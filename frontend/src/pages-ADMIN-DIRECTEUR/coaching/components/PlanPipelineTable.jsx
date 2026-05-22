import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, PauseCircle, PlayCircle, Target } from 'lucide-react'
import { badgeToneClass, formatSeconds } from '../coaching.utils'
import { InlineEmptyState, ToneBadge } from './CoachingShared'

const QUALITY_LABELS = {
  COMPLETE: 'Réussie',
  PARTIAL: 'Partielle',
  WEAK: 'Faible',
  MISSING: 'Échouée',
}

function PlanPipelineTable({
  conversation,
  audioAvailable,
  playingRangeId,
  isAudioPlaying,
  onToggleRange,
}) {
  const rows = React.useMemo(() => buildRows(conversation), [conversation])

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-3 py-4">
        <InlineEmptyState
          text="Aucune preuve par étape n’est disponible pour cette fenêtre candidate."
          compact
        />
      </div>
    )
  }

  return (
    <section className="rounded-lg border border-border/70 bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4 text-primary" />
          Pipeline de la fenêtre candidate par rapport au plan
        </div>
        <span className="text-xs text-muted-foreground">
          {rows.length} étape(s) analysée(s)
        </span>
      </div>

      <div className="hidden md:block">
        <div className="grid grid-cols-[1.1fr_0.8fr_1.4fr_1.4fr_1fr_76px] border-b border-border/70 bg-muted/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <div>Étape</div>
          <div>Statut</div>
          <div>Preuve</div>
          <div>Pourquoi</div>
          <div>Action</div>
          <div className="text-right">Audio</div>
        </div>
        <div className="divide-y divide-border/60">
          {rows.map(row => (
            <DesktopRow
              key={row.id}
              row={row}
              audioAvailable={audioAvailable}
              playing={isAudioPlaying && playingRangeId === row.rangeId}
              onToggleRange={onToggleRange}
            />
          ))}
        </div>
      </div>

      <div className="divide-y divide-border/60 md:hidden">
        {rows.map(row => (
          <MobileRow
            key={row.id}
            row={row}
            audioAvailable={audioAvailable}
            playing={isAudioPlaying && playingRangeId === row.rangeId}
            onToggleRange={onToggleRange}
          />
        ))}
      </div>
    </section>
  )
}

function DesktopRow({ row, audioAvailable, playing, onToggleRange }) {
  return (
    <div
      className={cn(
        'grid grid-cols-[1.1fr_0.8fr_1.4fr_1.4fr_1fr_76px] gap-3 px-3 py-3 text-sm',
        row.quality === 'MISSING' ? 'bg-chart-5/5' : 'bg-background'
      )}
    >
      <StepCell row={row} />
      <StatusCell row={row} />
      <ProofCell row={row} />
      <p className="min-w-0 text-muted-foreground">{row.reason}</p>
      <p className="min-w-0 font-medium">{row.action}</p>
      <AudioButton
        row={row}
        playing={playing}
        audioAvailable={audioAvailable}
        onToggleRange={onToggleRange}
      />
    </div>
  )
}

function MobileRow({ row, audioAvailable, playing, onToggleRange }) {
  return (
    <article className={cn('space-y-3 px-3 py-4', row.quality === 'MISSING' && 'bg-chart-5/5')}>
      <div className="flex items-start justify-between gap-3">
        <StepCell row={row} />
        <AudioButton
          row={row}
          playing={playing}
          audioAvailable={audioAvailable}
          onToggleRange={onToggleRange}
        />
      </div>
      <StatusCell row={row} />
      <Field label={row.quality === 'MISSING' && row.verbatim ? "Preuve d'échec" : 'Preuve'}>
        <ProofCell row={row} />
      </Field>
      <Field label="Pourquoi">
        <p className="text-sm text-muted-foreground">{row.reason}</p>
      </Field>
      <Field label="Action">
        <p className="text-sm font-medium">{row.action}</p>
      </Field>
    </article>
  )
}

function StepCell({ row }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
          {row.stepOrder}
        </span>
        <span className="min-w-0 font-semibold">{row.label}</span>
      </div>
      {row.timeLabel ? (
        <div className="mt-1 font-mono text-[11px] text-muted-foreground">{row.timeLabel}</div>
      ) : null}
    </div>
  )
}

function StatusCell({ row }) {
  const nonVerifiable = row.scoreable === false || row.missingBecause === 'TRANSCRIPT_UNCLEAR'
  const success = !nonVerifiable && (row.quality === 'COMPLETE' || row.quality === 'PARTIAL')
  const Icon = success ? CheckCircle2 : AlertTriangle
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToneBadge status={success ? 'COMPLETED' : 'NEEDS_REVIEW'}>
        <Icon className="mr-1 h-3 w-3" />
        {nonVerifiable ? 'Non vérifiable' : QUALITY_LABELS[row.quality] || row.quality}
      </ToneBadge>
      <Badge variant="outline" className={badgeToneClass(success ? 'success' : 'warning')}>
        {Math.round(row.confidence * 100)}%
      </Badge>
    </div>
  )
}

function ProofCell({ row }) {
  if (!row.verbatim) {
    return <p className="italic text-muted-foreground">Aucun verbatim précis disponible.</p>
  }
  return (
    <p className={cn('min-w-0 leading-5', row.quality === 'MISSING' && 'text-chart-5')}>
      “{row.verbatim}”
    </p>
  )
}

function AudioButton({ row, playing, audioAvailable, onToggleRange }) {
  const canPlay = audioAvailable && row.startTime !== null && row.startTime !== undefined
  const hasUnlocalizedProof = audioAvailable && row.verbatim && !canPlay
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="icon"
        variant={playing ? 'default' : 'outline'}
        onClick={() => onToggleRange(row.rangeId, row.startTime, row.endTime)}
        disabled={!canPlay}
        aria-label={playing ? 'Mettre en pause' : 'Écouter cette preuve'}
        title={hasUnlocalizedProof ? 'Verbatim non localisé dans l’audio' : undefined}
        className="h-8 w-8"
      >
        {playing ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
      </Button>
      {hasUnlocalizedProof ? (
        <span className="text-right text-[10px] leading-3 text-muted-foreground">
          Non localisé
        </span>
      ) : null}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  )
}

function buildRows(conversation) {
  const evidences = Array.isArray(conversation?.criterionEvidences)
    ? conversation.criterionEvidences
    : []
  return evidences
    .slice()
    .sort((a, b) => Number(a.stepOrder || 0) - Number(b.stepOrder || 0))
    .map(evidence => {
      const quality = evidence.quality || (evidence.found ? 'PARTIAL' : 'MISSING')
      const startTime = normalizeNullableTime(evidence.startTime)
      const endTime = normalizeNullableTime(evidence.endTime)
      return {
        id: evidence.id || `${evidence.stepOrder}-${evidence.criterionKey}`,
        rangeId: `evidence-${evidence.id || `${evidence.stepOrder}-${evidence.criterionKey}`}`,
        stepOrder: evidence.stepOrder,
        label: evidence.criterionLabel || `Étape ${evidence.stepOrder}`,
        quality,
        confidence: Number.isFinite(Number(evidence.confidence)) ? Number(evidence.confidence) : 0.5,
        verbatim: cleanText(evidence.verbatim),
        reason: cleanText(evidence.reason) || reasonFallback(quality),
        action: actionFromEvidence(evidence, quality),
        scoreable: evidence.scoreable !== false,
        missingBecause: cleanText(evidence.missingBecause),
        evidenceCompleteness: cleanText(evidence.evidenceCompleteness),
        startTime,
        endTime,
        timeLabel:
          startTime !== null
            ? `${formatSeconds(startTime)} → ${formatSeconds(endTime)}`
            : null,
      }
    })
}

function normalizeNullableTime(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function cleanText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function reasonFallback(quality) {
  if (quality === 'MISSING') return "L'étape n'est pas observable dans cette fenêtre."
  if (quality === 'WEAK') return "L'étape est présente mais trop fragile."
  return "L'étape est partiellement couverte dans cette fenêtre."
}

function actionFromEvidence(evidence, quality) {
  const label = evidence.criterionLabel || `étape ${evidence.stepOrder}`
  if (evidence.scoreable === false || evidence.missingBecause === 'TRANSCRIPT_UNCLEAR') {
    return 'Revue humaine nécessaire: le transcript ne permet pas de conclure.'
  }
  if (quality === 'COMPLETE') return 'Conserver cette séquence.'
  if (quality === 'MISSING') return `Reprendre ${label.toLowerCase()} avec une phrase explicite.`
  if (quality === 'WEAK') return `Renforcer ${label.toLowerCase()} avant de passer à la suite.`
  return `Clarifier ${label.toLowerCase()} et valider la réponse du prospect.`
}

export default React.memo(PlanPipelineTable)
