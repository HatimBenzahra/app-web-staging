import React from 'react'
import { Button } from '@/components/ui/button'
import { FileText, Headphones, ListChecks, Rows3, Square } from 'lucide-react'
import AudioPlayer from '@/components/AudioPlayer'
import { InlineEmptyState, ToneBadge } from './CoachingShared'
import { formatSeconds } from '../coaching.utils'

const VIEW_MODES = [
  { value: 'split', label: 'Par conv', icon: Square },
  { value: 'continuous', label: 'Lecture continue', icon: Rows3 },
  { value: 'raw', label: 'Transcript brut', icon: FileText },
]

/**
 * Sticky bar at the top of the session detail. Contains:
 *  - the WaveSurfer audio player (or an empty state)
 *  - a thin status row (currently playing range + duration)
 *  - the layout-mode toggle (per-conversation / continuous reading / raw transcript)
 *  - the "Voir les étapes" shortcut
 *
 * @param {Object} props
 * @param {Object} props.session
 * @param {(ws: any) => void} props.onWavesurferReady
 * @param {{ label?: string, startTime?: number|null, endTime?: number|null }|null} props.activeRange
 * @param {boolean} props.isAudioPlaying
 * @param {'split'|'continuous'|'raw'} props.viewMode
 * @param {(mode: 'split'|'continuous'|'raw') => void} props.onViewModeChange
 * @param {() => void} props.onOpenSteps
 */
function SessionAudioBar({
  session,
  onWavesurferReady,
  activeRange,
  isAudioPlaying,
  viewMode,
  onViewModeChange,
  onOpenSteps,
}) {
  return (
    <div className="sticky top-0 z-30 -mx-1 rounded-lg border border-accent/25 bg-accent/5 px-4 py-4 shadow-sm backdrop-blur-sm sm:mx-0">
      <div className="flex items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Headphones className="h-4 w-4" />
          Audio de la session
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex flex-wrap overflow-hidden rounded-md border border-border/70 bg-background"
            role="group"
            aria-label="Mode de lecture"
          >
            {VIEW_MODES.map(mode => {
              const active = viewMode === mode.value
              const ModeIcon = mode.icon
              return (
                <Button
                  key={mode.value}
                  type="button"
                  size="sm"
                  variant={active ? 'default' : 'ghost'}
                  className="rounded-none border-0"
                  onClick={() => onViewModeChange(mode.value)}
                  aria-pressed={active}
                >
                  <ModeIcon className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">{mode.label}</span>
                  <span className="sm:hidden">{mode.label.split(' ')[0]}</span>
                </Button>
              )
            })}
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onOpenSteps}>
            <ListChecks className="mr-2 h-4 w-4" />
            Voir les étapes
          </Button>
        </div>
      </div>

      {session.audioUrl ? (
        <AudioPlayer
          src={session.audioUrl}
          title={`Enregistrement · ${session.commercialNom || 'Commercial inconnu'}`}
          onWavesurferReady={onWavesurferReady}
        />
      ) : (
        <InlineEmptyState text="Aucun lien audio signé disponible pour cette session." compact />
      )}

      <div
        className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
        aria-live="polite"
      >
        {activeRange ? (
          <>
            {isAudioPlaying ? (
              <ToneBadge status="PROCESSING">En écoute</ToneBadge>
            ) : (
              <ToneBadge status="conversation">En cours</ToneBadge>
            )}
            <span className="truncate font-medium text-foreground">{activeRange.label}</span>
            <span className="tabular-nums">
              {formatSeconds(activeRange.startTime)} → {formatSeconds(activeRange.endTime)}
            </span>
          </>
        ) : (
          <span>Sélectionnez une conversation ou un verbatim pour cibler la lecture.</span>
        )}
      </div>
    </div>
  )
}

export default React.memo(SessionAudioBar)
