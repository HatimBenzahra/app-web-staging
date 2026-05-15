import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PauseCircle, PlayCircle } from 'lucide-react'
import { badgeToneClass, formatScoreValue, formatSeconds } from '../coaching.utils'
import { InlineEmptyState, ToneBadge } from './CoachingShared'

/**
 * Modal lists every step of the sales plan with its score, verbatim and
 * AI feedback. Each step can be played back in the main audio bar.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {Array} props.steps
 * @param {boolean} props.audioAvailable
 * @param {string|null} props.playingRangeId
 * @param {boolean} props.isAudioPlaying
 * @param {(id: string, start: number, end: number|null) => void} props.onToggleRange
 */
function StepsDialog({
  open,
  onOpenChange,
  steps,
  audioAvailable,
  playingRangeId,
  isAudioPlaying,
  onToggleRange,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-full max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border/70 px-6 py-5">
          <DialogTitle>Étapes du plan</DialogTitle>
          <DialogDescription>
            Ce que le commercial a dit, le score associé et la recommandation IA.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-6 py-5">
          {steps.length === 0 ? (
            <InlineEmptyState text="Les étapes détaillées n’ont pas encore été produites." />
          ) : (
            <div className="space-y-3">
              {steps.map(step => {
                const rangeId = `step-${step.id}`
                const playing = isAudioPlaying && playingRangeId === rangeId
                const canPlay =
                  audioAvailable && step.startTime !== null && step.startTime !== undefined
                return (
                  <article
                    key={step.id}
                    className={[
                      'rounded-lg border px-4 py-4 transition-all',
                      playing
                        ? 'border-primary/50 bg-primary/8 ring-2 ring-primary/15'
                        : 'border-border/70 bg-background',
                    ].join(' ')}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                            {step.ordre}
                          </span>
                          <h3 className="font-semibold">{step.titre}</h3>
                          {playing ? <ToneBadge status="PROCESSING">En écoute</ToneBadge> : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <ToneBadge status={step.coverageStatus || 'neutral'}>
                            {step.coverageStatus || 'Non renseigné'}
                          </ToneBadge>
                          <Badge variant="outline" className={badgeToneClass('primary')}>
                            {formatScoreValue(step.score)}
                          </Badge>
                          <span>
                            {formatSeconds(step.startTime)} → {formatSeconds(step.endTime)}
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={playing ? 'default' : 'outline'}
                        onClick={() => onToggleRange(rangeId, step.startTime, step.endTime)}
                        disabled={!canPlay}
                      >
                        {playing ? (
                          <PauseCircle className="mr-2 h-4 w-4" />
                        ) : (
                          <PlayCircle className="mr-2 h-4 w-4" />
                        )}
                        {playing ? 'Pause' : 'Écouter'}
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                      <div className="rounded-md border border-border/60 bg-muted/25 px-3 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Le commercial a dit
                        </div>
                        <p className="mt-2 max-h-44 overflow-y-auto whitespace-pre-wrap text-sm leading-6">
                          {step.verbatim || 'Aucun verbatim précis disponible pour cette étape.'}
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Feedback IA
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {step.feedback || 'Feedback non renseigné.'}
                          </p>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Recommandation
                          </div>
                          <p className="mt-2 text-sm font-medium">
                            {step.recommendation || 'Aucune recommandation générée.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default React.memo(StepsDialog)
