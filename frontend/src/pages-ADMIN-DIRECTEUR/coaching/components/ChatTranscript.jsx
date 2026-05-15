import React from 'react'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-react'
import { InlineEmptyState } from './CoachingShared'

const SPEAKER_REGEX = /^\s*(Commercial|Client|Interlocuteur|Intervenant)\s*:\s*/i
const LEADING_TIMECODE_REGEX = /^\[(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?\]\s*/

/**
 * Identify the speaker on a transcript line. Returns one of "commercial",
 * "client" or null when no marker is found.
 *
 * The parsing is intentionally tolerant: case-insensitive, accepts a leading
 * `[MM:SS]` timecode produced by the readable renderer and falls back to the
 * previous speaker when a line is a continuation.
 *
 * @param {string} line
 * @returns {{ speaker: 'commercial'|'client'|null, text: string, timecode: string|null }}
 */
function parseSpeakerLine(line) {
  let working = line.trim()
  let timecode = null

  const timeMatch = working.match(LEADING_TIMECODE_REGEX)
  if (timeMatch) {
    timecode = timeMatch[2] ? `${timeMatch[1]} → ${timeMatch[2]}` : timeMatch[1]
    working = working.slice(timeMatch[0].length)
  }

  const match = working.match(SPEAKER_REGEX)
  if (!match) {
    return { speaker: null, text: working, timecode }
  }

  const marker = match[1].toLowerCase()
  const text = working.slice(match[0].length).trim()
  const speaker = marker === 'commercial' ? 'commercial' : 'client'
  return { speaker, text, timecode }
}

/**
 * Convert the raw readable transcript (line-based) into a list of chat-style
 * messages. Continuations of the same speaker over several lines are merged
 * into a single bubble.
 *
 * @param {string} transcript
 * @returns {Array<{ id: number, speaker: 'commercial'|'client'|'unknown', text: string, timecode: string|null }>}
 */
function buildMessages(transcript) {
  if (!transcript) return []
  const lines = transcript
    .split('\n')
    .map(line => line.replace(/\s+$/, ''))
    .filter(Boolean)

  const messages = []
  let currentSpeaker = null
  let currentTimecode = null

  for (const line of lines) {
    const parsed = parseSpeakerLine(line)
    if (parsed.speaker) {
      currentSpeaker = parsed.speaker
      currentTimecode = parsed.timecode
      messages.push({
        id: messages.length,
        speaker: parsed.speaker,
        text: parsed.text,
        timecode: parsed.timecode,
      })
    } else if (currentSpeaker && messages.length > 0) {
      // continuation of the current bubble
      const last = messages[messages.length - 1]
      last.text = last.text ? `${last.text}\n${parsed.text}` : parsed.text
      if (!last.timecode && parsed.timecode) last.timecode = parsed.timecode
    } else {
      messages.push({
        id: messages.length,
        speaker: 'unknown',
        text: parsed.text,
        timecode: parsed.timecode || currentTimecode,
      })
    }
  }

  return messages.filter(message => message.text.length > 0)
}

const AVATAR_STYLES = {
  commercial: 'bg-primary text-primary-foreground',
  client: 'bg-accent text-accent-foreground',
  unknown: 'bg-muted text-muted-foreground',
}

const BUBBLE_STYLES = {
  commercial: 'bg-primary/10 border-primary/25 text-foreground',
  client: 'bg-background border-border/70 text-foreground',
  unknown: 'bg-muted/30 border-border/60 text-muted-foreground italic',
}

const SPEAKER_LABEL = {
  commercial: 'Commercial',
  client: 'Interlocuteur',
  unknown: 'Narration',
}

const SPEAKER_INITIAL = {
  commercial: 'C',
  client: 'I',
  unknown: '·',
}

/**
 * Chat-style transcript renderer used in the conversation detail. Renders the
 * readable transcript as a messenger thread: the commercial appears on the
 * right with the primary palette, the client/interlocuteur on the left with
 * the accent palette. Unknown speakers fall back to a neutral italic style.
 *
 * @param {Object} props
 * @param {string} props.transcript
 */
function ChatTranscript({ transcript }) {
  const messages = React.useMemo(() => buildMessages(transcript), [transcript])
  const [copied, setCopied] = React.useState(false)

  const handleCopy = React.useCallback(() => {
    if (!transcript) return
    void navigator.clipboard?.writeText(transcript)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }, [transcript])

  if (!transcript || messages.length === 0) {
    return (
      <InlineEmptyState
        text="Aucune transcription lisible disponible pour cette conversation."
        compact
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Commercial
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            Interlocuteur
          </span>
        </div>
        <Button
          type="button"
          variant={copied ? 'default' : 'ghost'}
          size="sm"
          onClick={handleCopy}
          disabled={!transcript}
        >
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? 'Copié' : 'Copier'}
        </Button>
      </div>
      <div className="max-h-[520px] space-y-3 overflow-y-auto rounded-lg border border-border/70 bg-muted/15 px-3 py-4 sm:px-4">
        {messages.map(message => {
          const isCommercial = message.speaker === 'commercial'
          return (
            <div
              key={message.id}
              className={[
                'flex items-end gap-2',
                isCommercial ? 'justify-end' : 'justify-start',
              ].join(' ')}
            >
              {!isCommercial ? <SpeakerAvatar speaker={message.speaker} /> : null}
              <div
                className={[
                  'flex max-w-[78%] flex-col gap-1',
                  isCommercial ? 'items-end' : 'items-start',
                ].join(' ')}
              >
                <div className="flex items-center gap-2 px-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span className="font-medium">{SPEAKER_LABEL[message.speaker]}</span>
                  {message.timecode ? (
                    <span className="font-mono tabular-nums">{message.timecode}</span>
                  ) : null}
                </div>
                <div
                  className={[
                    'whitespace-pre-wrap break-words rounded-2xl border px-3.5 py-2.5 text-sm leading-6 shadow-sm',
                    BUBBLE_STYLES[message.speaker],
                    isCommercial ? 'rounded-br-sm' : 'rounded-bl-sm',
                  ].join(' ')}
                >
                  {message.text}
                </div>
              </div>
              {isCommercial ? <SpeakerAvatar speaker={message.speaker} /> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SpeakerAvatar({ speaker }) {
  return (
    <span
      aria-hidden="true"
      className={[
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
        AVATAR_STYLES[speaker],
      ].join(' ')}
    >
      {SPEAKER_INITIAL[speaker]}
    </span>
  )
}

export default React.memo(ChatTranscript)
