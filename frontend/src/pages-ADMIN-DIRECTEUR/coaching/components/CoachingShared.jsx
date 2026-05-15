import React from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import EmptyState from '@/components/EmptyState'
import { cn } from '@/lib/utils'
import { COACHING_SECTIONS, STATUS_LABELS } from '../coaching.constants'
import {
  badgeToneClass,
  formatDate,
  numberOrZero,
  statusTone,
  statusVariant,
} from '../coaching.utils'

const TONE_STYLES = {
  primary: {
    card: 'border-primary/20 bg-primary/5',
    rail: 'bg-primary',
    chip: 'bg-primary/10 text-primary',
  },
  accent: {
    card: 'border-accent/30 bg-accent/10',
    rail: 'bg-accent',
    chip: 'bg-accent/15 text-accent-foreground',
  },
  success: {
    card: 'border-chart-2/25 bg-chart-2/10',
    rail: 'bg-chart-2',
    chip: 'bg-chart-2/15 text-foreground',
  },
  warning: {
    card: 'border-chart-5/25 bg-chart-5/10',
    rail: 'bg-chart-5',
    chip: 'bg-chart-5/15 text-foreground',
  },
  danger: {
    card: 'border-destructive/25 bg-destructive/8',
    rail: 'bg-destructive',
    chip: 'bg-destructive/10 text-destructive',
  },
  neutral: {
    card: 'border-border/70 bg-card',
    rail: 'bg-muted-foreground/50',
    chip: 'bg-muted text-muted-foreground',
  },
}

export function MetricCard({ label, value, hint, tone = 'neutral', icon: Icon }) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.neutral

  return (
    <Card className={cn('relative overflow-hidden', styles.card)}>
      <div className={cn('absolute inset-y-0 left-0 w-1', styles.rail)} />
      <CardHeader className="space-y-3 pb-4 pl-5">
        <div className="flex items-center justify-between gap-3">
          <CardDescription className="font-medium">{label}</CardDescription>
          {Icon ? (
            <span
              className={cn('flex h-8 w-8 items-center justify-center rounded-md', styles.chip)}
            >
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
        </div>
        <CardTitle className="text-3xl tabular-nums">{numberOrZero(value)}</CardTitle>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </CardHeader>
    </Card>
  )
}

export function ScorePill({ label, value, tone = 'neutral' }) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.neutral

  return (
    <div className={cn('rounded-lg border px-4 py-3', styles.card)}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{numberOrZero(value)}</div>
    </div>
  )
}

export function CompactScore({ label, value, strong = false, tone = 'neutral' }) {
  const score = numberOrZero(value)
  const numeric = Number(score)
  const width = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0
  const styles = TONE_STYLES[tone] || TONE_STYLES.neutral
  return (
    <div
      className={[
        'rounded-lg border px-3 py-3',
        strong ? 'border-primary/30 bg-primary/8' : styles.card,
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={
            strong ? 'text-2xl font-semibold tabular-nums' : 'text-xl font-semibold tabular-nums'
          }
        >
          {score}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', styles.rail)} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

export function InfoLine({ label, value, breakAll = false }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={breakAll ? 'max-w-[20rem] text-right break-all' : 'text-right'}>
        {value}
      </span>
    </div>
  )
}

export function FieldBlock({ label, children }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export function BulletBlock({ title, items, empty, compact = false }) {
  return (
    <div>
      <div
        className={
          compact
            ? 'text-xs font-semibold uppercase tracking-wide text-muted-foreground'
            : 'text-sm font-medium'
        }
      >
        {title}
      </div>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {items.map(item => (
          <li key={item}>• {item}</li>
        ))}
        {items.length === 0 ? <li>• {empty}</li> : null}
      </ul>
    </div>
  )
}

export function SectionNav({ currentSection }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {COACHING_SECTIONS.map(section => {
        const Icon = section.icon
        const active = currentSection === section.key
        return (
          <Link key={section.key} to={section.href}>
            <Card
              className={[
                'h-full overflow-hidden transition-all duration-150',
                active
                  ? 'border-primary/35 bg-primary/5 shadow-sm'
                  : 'border-border/70 bg-card hover:border-primary/20 hover:bg-muted/25',
              ].join(' ')}
            >
              <CardHeader className="gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={[
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                      active
                        ? 'border-primary/20 bg-primary/10 text-primary'
                        : 'border-border/60 bg-muted/45 text-muted-foreground',
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base">{section.label}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2 text-xs leading-5">
                      {section.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

export function SessionStrip({ title, description, sessions, emptyText, logic, tone }) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.map(session => (
          <button
            key={session.id}
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-3 py-3 text-left hover:bg-muted/40"
            onClick={() => logic.openSession(session.id)}
          >
            <span>
              <span className="block font-medium">
                #{session.id} · {session.commercialNom || 'Commercial inconnu'}
              </span>
              <span className="block text-xs text-muted-foreground">
                {tone === 'review'
                  ? session.reviewReason || session.failureReason || 'Validation demandée'
                  : formatDate(session.processedAt || session.updatedAt)}
              </span>
            </span>
            <Badge
              variant={tone === 'review' && session.status === 'FAILED' ? 'destructive' : 'outline'}
            >
              {tone === 'done'
                ? `Score ${numberOrZero(session.overallScore)}`
                : STATUS_LABELS[session.status] || session.status}
            </Badge>
          </button>
        ))}
        {sessions.length === 0 ? (
          <EmptyState
            title={emptyText}
            className="rounded-lg border border-dashed border-border py-8"
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

export function InlineEmptyState({ text, compact = false }) {
  return (
    <EmptyState
      title={text}
      className={[
        'rounded-lg border border-dashed border-border py-0',
        compact ? 'px-4 py-6 text-sm' : 'px-4 py-8 text-sm',
      ].join(' ')}
    />
  )
}

export function SignalBlock({ title, items, empty, tone = 'neutral' }) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.neutral
  return (
    <div className={cn('rounded-lg border px-4 py-3', styles.card)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className={cn('h-2 w-2 rounded-full', styles.rail)} />
        {title}
      </div>
      <ul className="mt-2 space-y-1 text-sm leading-5 text-muted-foreground">
        {items.length > 0 ? items.map(item => <li key={item}>• {item}</li>) : <li>• {empty}</li>}
      </ul>
    </div>
  )
}

export function TableFrame({ children, className }) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[1180px] overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm',
        className
      )}
    >
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

export function ToneBadge({ status, children, className }) {
  return (
    <Badge variant="outline" className={cn(badgeToneClass(statusTone(status)), className)}>
      {children}
    </Badge>
  )
}

export function PipelineStep({ step }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-background px-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">{step.label}</span>
          <Badge variant={step.status === 'FAILED' ? 'destructive' : 'outline'}>
            {step.status}
          </Badge>
        </div>
      </div>
    </div>
  )
}

export function SessionStatusBadge({ status }) {
  return <Badge variant={statusVariant(status)}>{STATUS_LABELS[status] || status}</Badge>
}
