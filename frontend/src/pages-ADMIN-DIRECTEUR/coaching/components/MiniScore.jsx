import React from 'react'
import { cn } from '@/lib/utils'
import { numberOrZero } from '../coaching.utils'

const TONE_RING = {
  primary: 'stroke-primary',
  accent: 'stroke-accent',
  success: 'stroke-chart-2',
  warning: 'stroke-chart-5',
  danger: 'stroke-destructive',
  neutral: 'stroke-muted-foreground',
}

const TONE_TRACK = {
  primary: 'stroke-primary/15',
  accent: 'stroke-accent/15',
  success: 'stroke-chart-2/15',
  warning: 'stroke-chart-5/15',
  danger: 'stroke-destructive/15',
  neutral: 'stroke-muted/40',
}

const TONE_CARD = {
  primary: 'border-primary/20 bg-primary/5',
  accent: 'border-accent/25 bg-accent/8',
  success: 'border-chart-2/25 bg-chart-2/8',
  warning: 'border-chart-5/25 bg-chart-5/8',
  danger: 'border-destructive/25 bg-destructive/5',
  neutral: 'border-border/70 bg-background',
}

const CIRCUMFERENCE = 2 * Math.PI * 18

/**
 * Compact score tile used in the conversation detail. Renders a small
 * progress ring (40px) next to the score value to fit 6 metrics in a single
 * compact row on desktop and 3x2 on tablets.
 *
 * When `value` is null/undefined/0, an `unavailable` flag changes the
 * presentation to a subtle "Non calculé" hint instead of a flat zero.
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {number|null|undefined} props.value
 * @param {'primary'|'accent'|'success'|'warning'|'danger'|'neutral'} [props.tone]
 * @param {boolean} [props.strong] - emphasise the global score
 */
function MiniScore({ label, value, tone = 'neutral', strong = false }) {
  const score = numberOrZero(value)
  const numeric = Number(score)
  const clamped = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0
  const isUnavailable = value === null || value === undefined || numeric === 0
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
        TONE_CARD[tone] || TONE_CARD.neutral,
        strong ? 'ring-1 ring-primary/25' : ''
      )}
    >
      <div className="relative h-10 w-10 shrink-0">
        <svg className="h-10 w-10 -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
          <circle
            cx="20"
            cy="20"
            r="18"
            fill="none"
            strokeWidth="3"
            className={TONE_TRACK[tone] || TONE_TRACK.neutral}
          />
          <circle
            cx="20"
            cy="20"
            r="18"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            className={TONE_RING[tone] || TONE_RING.neutral}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center font-semibold tabular-nums',
            strong ? 'text-sm' : 'text-[11px]',
            isUnavailable ? 'text-muted-foreground/70' : ''
          )}
        >
          {isUnavailable ? '—' : clamped}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div
          className={cn(
            'truncate text-xs',
            isUnavailable ? 'italic text-muted-foreground/70' : 'text-foreground/80'
          )}
        >
          {isUnavailable ? 'Non calculé' : `${clamped} / 100`}
        </div>
      </div>
    </div>
  )
}

export default React.memo(MiniScore)
