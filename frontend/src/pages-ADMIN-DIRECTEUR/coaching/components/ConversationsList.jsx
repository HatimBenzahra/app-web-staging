import React from 'react'
import { Badge } from '@/components/ui/badge'
import { MessageSquare } from 'lucide-react'
import { CONVERSATION_LABELS } from '../coaching.constants'
import { badgeToneClass, formatSeconds, numberOrZero } from '../coaching.utils'
import { InlineEmptyState, ToneBadge } from './CoachingShared'

/**
 * Vertical list of conversations on the left rail of the master-detail layout.
 *
 * @param {Object} props
 * @param {Array} props.conversations
 * @param {number|null} props.selectedId
 * @param {number|null} props.currentTimecodeId   - conversation currently under the audio cursor
 * @param {boolean} props.isAudioPlaying
 * @param {(conversation: Object) => void} props.onSelect
 */
function ConversationsList({
  conversations,
  selectedId,
  currentTimecodeId,
  isAudioPlaying,
  onSelect,
}) {
  if (!conversations || conversations.length === 0) {
    return (
      <InlineEmptyState text="Aucune conversation séparée n’a encore été produite pour cette session." />
    )
  }

  return (
    <ul
      className="flex h-full max-h-[640px] flex-col gap-2 overflow-y-auto pr-1"
      role="list"
      aria-label="Conversations de la session"
    >
      {conversations.map(conversation => {
        const selected = selectedId === conversation.id
        const currentInAudio = currentTimecodeId === conversation.id && isAudioPlaying
        const score = numberOrZero(conversation.overallScore)
        const statusLabel = CONVERSATION_LABELS[conversation.status] || conversation.status

        return (
          <li key={conversation.id} role="listitem">
            <button
              type="button"
              onClick={() => onSelect(conversation)}
              aria-current={selected ? 'true' : undefined}
              className={[
                'group flex w-full flex-col gap-2 rounded-lg border px-3 py-3 text-left transition-all',
                selected
                  ? 'border-primary/45 bg-primary/8 shadow-sm ring-1 ring-primary/20'
                  : currentInAudio
                    ? 'border-accent/55 bg-accent/10'
                    : 'border-border/70 bg-background hover:border-primary/25 hover:bg-muted/35',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={[
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums',
                      selected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    ].join(' ')}
                  >
                    {conversation.ordre}
                  </span>
                  <span className="min-w-0 truncate text-sm font-medium">
                    {conversation.title || `Conversation ${conversation.ordre}`}
                  </span>
                </div>
                <Badge variant="outline" className={badgeToneClass('primary')}>
                  {score}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                <span className="tabular-nums">
                  {formatSeconds(conversation.startTime)} → {formatSeconds(conversation.endTime)}
                </span>
                <ToneBadge status={conversation.status}>{statusLabel}</ToneBadge>
                {currentInAudio ? <ToneBadge status="PROCESSING">En écoute</ToneBadge> : null}
              </div>
              {conversation.summary ? (
                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {conversation.summary}
                </p>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export default React.memo(ConversationsList)
