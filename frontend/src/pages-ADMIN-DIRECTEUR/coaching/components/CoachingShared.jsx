import React from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import EmptyState from '@/components/EmptyState'
import { COACHING_SECTIONS, STATUS_LABELS } from '../coaching.constants'
import { formatDate, statusVariant } from '../coaching.utils'

export function MetricCard({ label, value, hint }) {
  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-1 pb-3">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value ?? 'n/a'}</CardTitle>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </CardHeader>
    </Card>
  )
}

export function ScorePill({ label, value }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value ?? 'n/a'}</div>
    </div>
  )
}

export function CompactScore({ label, value, strong = false }) {
  const score = value ?? 'n/a'
  const numeric = Number(value)
  const width = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0
  return (
    <div
      className={[
        'rounded-lg border px-3 py-3',
        strong ? 'border-primary/30 bg-primary/8' : 'border-border/70 bg-background',
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className={strong ? 'text-2xl font-semibold' : 'text-xl font-semibold'}>{score}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
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
    <div className="grid gap-3 lg:grid-cols-4">
      {COACHING_SECTIONS.map(section => {
        const Icon = section.icon
        const active = currentSection === section.key
        return (
          <Link key={section.key} to={section.href}>
            <Card
              className={[
                'h-full border-border/70 transition-all duration-150',
                active
                  ? 'border-primary/40 bg-primary/4 shadow-sm'
                  : 'hover:border-border hover:bg-muted/30',
              ].join(' ')}
            >
              <CardHeader className="gap-3 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={[
                      'flex h-10 w-10 items-center justify-center rounded-lg border',
                      active
                        ? 'border-primary/20 bg-primary/10 text-primary'
                        : 'border-border/60 bg-muted/40 text-muted-foreground',
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{section.label}</CardTitle>
                    <CardDescription className="mt-1 text-xs">
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
                  ? session.reviewReason || session.failureReason || 'Review demandée'
                  : formatDate(session.processedAt || session.updatedAt)}
              </span>
            </span>
            <Badge
              variant={tone === 'review' && session.status === 'FAILED' ? 'destructive' : 'outline'}
            >
              {tone === 'done'
                ? `Score ${session.overallScore ?? 'n/a'}`
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

export function SignalBlock({ title, items, empty }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
      <div className="text-sm font-medium">{title}</div>
      <ul className="mt-2 space-y-1 text-sm leading-5 text-muted-foreground">
        {items.length > 0 ? items.map(item => <li key={item}>• {item}</li>) : <li>• {empty}</li>}
      </ul>
    </div>
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
