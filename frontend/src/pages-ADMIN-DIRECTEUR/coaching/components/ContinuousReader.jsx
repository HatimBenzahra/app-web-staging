import React from 'react'
import { Button } from '@/components/ui/button'
import { PauseCircle, PlayCircle } from 'lucide-react'
import { CONVERSATION_LABELS } from '../coaching.constants'
import { formatSeconds, numberOrZero } from '../coaching.utils'
import { InlineEmptyState, ToneBadge } from './CoachingShared'
import ChatTranscript from './ChatTranscript'

/**
 * Single-scroll layout that stacks every candidate window transcript with sticky
 * "Fenêtre candidate N · MM:SS → MM:SS" headers.
 *
 * @param {Object} props
 * @param {Array} props.conversations
 * @param {string|null} props.playingRangeId
 * @param {boolean} props.isAudioPlaying
 * @param {boolean} props.audioAvailable
 * @param {(id: string, start: number, end: number|null) => void} props.onToggleRange
 */
function ContinuousReader({
  conversations,
  playingRangeId,
  isAudioPlaying,
  audioAvailable,
  onToggleRange,
}) {
  if (!conversations || conversations.length === 0) {
    return (
      <InlineEmptyState text="Aucune fenêtre candidate n’a encore été produite pour cette session." />
    )
  }

  return (
    <div className="space-y-6">
      {conversations.map(conversation => {
        const id = `conversation-${conversation.id}`
        const playing = isAudioPlaying && playingRangeId === id
        const canPlay =
          audioAvailable && conversation.startTime !== null && conversation.startTime !== undefined
        const transcript = conversation.readableTranscriptText || conversation.transcriptText || ''

        return (
          <section
            key={conversation.id}
            className={[
              'overflow-hidden rounded-lg border bg-background',
              playing ? 'border-primary/45 ring-1 ring-primary/15' : 'border-border/70',
            ].join(' ')}
            aria-labelledby={`continuous-conv-${conversation.id}`}
          >
            <header className="sticky top-[180px] z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary"
                  aria-hidden="true"
                >
                  {conversation.ordre}
                </span>
                <h3 id={`continuous-conv-${conversation.id}`} className="text-sm font-semibold">
                  {conversation.title || `Fenêtre candidate ${conversation.ordre}`}
                </h3>
                <ToneBadge status={conversation.status}>
                  {CONVERSATION_LABELS[conversation.status] || conversation.status}
                </ToneBadge>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatSeconds(conversation.startTime)} → {formatSeconds(conversation.endTime)} ·
                  Score {numberOrZero(conversation.overallScore)}/100
                </span>
                {playing ? <ToneBadge status="PROCESSING">En écoute</ToneBadge> : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant={playing ? 'default' : 'outline'}
                onClick={() => onToggleRange(id, conversation.startTime, conversation.endTime)}
                disabled={!canPlay}
              >
                {playing ? (
                  <PauseCircle className="mr-2 h-4 w-4" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                {playing ? 'Pause' : 'Écouter'}
              </Button>
            </header>

            <div className="px-4 py-4">
              {conversation.summary ? (
                <p className="mb-3 text-sm leading-6 text-muted-foreground">
                  {conversation.summary}
                </p>
              ) : null}

              {transcript || conversation.dialogueTurns?.length > 0 ? (
                <ChatTranscript
                  transcript={transcript}
                  dialogueTurns={conversation.dialogueTurns || []}
                  audioAvailable={audioAvailable}
                  playingRangeId={playingRangeId}
                  isAudioPlaying={isAudioPlaying}
                  onToggleRange={onToggleRange}
                  rangeIdPrefix={`dialogue-${conversation.id}`}
                />
              ) : (
                <InlineEmptyState
                  text="Transcription indisponible pour cette fenêtre candidate."
                  compact
                />
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default React.memo(ContinuousReader)
