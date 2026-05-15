import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FileAudio,
  Gauge,
  Loader2,
  PlayCircle,
  ShieldCheck,
} from 'lucide-react'
import {
  EXPLOITABILITY_LABELS,
  PERIOD_OPTIONS,
  QUEUE_LABELS,
  STATUS_LABELS,
} from '../coaching.constants'
import { Pagination } from '@/components/Pagination'
import {
  badgeToneClass,
  formatDate,
  formatDuration,
  formatWait,
  numberOrZero,
} from '../coaching.utils'
import {
  InlineEmptyState,
  MetricCard,
  ScorePill,
  SessionStrip,
  TableFrame,
  ToneBadge,
} from './CoachingShared'

export default function DashboardView({ logic }) {
  const reviewSessions = logic.dashboardSessions.filter(
    session =>
      ['FAILED', 'NEEDS_REVIEW'].includes(session.status) || session.reviewStatus === 'PENDING'
  )
  const completedSessions = logic.dashboardSessions.filter(
    session => session.status === 'COMPLETED'
  )

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Candidats de la période"
          value={logic.prioritizedRecordings.length}
          tone="primary"
          icon={FileAudio}
        />
        <MetricCard
          label="Analyses actives"
          value={
            (logic.queueState?.summary?.queued || 0) + (logic.queueState?.summary?.processing || 0)
          }
          tone="warning"
          icon={Activity}
        />
        <MetricCard
          label="Analyses lancées"
          value={logic.dashboardSessionsTotal}
          tone="accent"
          icon={Gauge}
        />
        <MetricCard
          label="Validations à traiter"
          value={reviewSessions.length}
          tone={reviewSessions.length > 0 ? 'danger' : 'success'}
          icon={ShieldCheck}
        />
      </div>

      <Card className="border-border/70">
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <CardTitle>Enregistrements les plus exploitables</CardTitle>
            <CardDescription>
              Vue directeur. On remonte les meilleurs candidats de la période avec les signaux
              utiles.
            </CardDescription>
          </div>
          <div className="w-full sm:w-64">
            <Label htmlFor="dashboard-period">Période</Label>
            <Select value={logic.dashboardPeriod} onValueChange={logic.setDashboardPeriod}>
              <SelectTrigger id="dashboard-period" className="mt-2">
                <CalendarDays className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            {logic.prioritizedRecordings.map(recording => (
              <div
                key={recording.key}
                className="rounded-lg border border-border/70 bg-muted/15 px-5 py-4 transition-colors hover:border-primary/20 hover:bg-primary/5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="text-base font-semibold">
                      {recording.commercialNom || 'Commercial inconnu'}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Dernière activité · {formatDate(recording.lastModified)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <DashboardRecordingState recording={recording} logic={logic} />
                    <Badge variant="outline" className={badgeToneClass('primary')}>
                      <Gauge className="mr-1 h-3 w-3" />
                      {numberOrZero(recording.exploitabilityScore)}/100
                    </Badge>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Date
                    </div>
                    <div className="mt-1">{formatDate(recording.lastModified)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Parole
                    </div>
                    <div className="mt-1">{formatDashboardSpeechState(recording)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Durée
                    </div>
                    <div className="mt-1">
                      {formatDuration(numberOrZero(recording.totalDurationSec))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(recording.exploitabilityReasons || []).slice(0, 3).map(reason => (
                    <Badge key={reason} variant="outline" className={badgeToneClass('accent')}>
                      {reason}
                    </Badge>
                  ))}
                </div>
                <DashboardRecordingActions recording={recording} logic={logic} />
              </div>
            ))}
          </div>
          {logic.prioritizedRecordings.length === 0 ? (
            <InlineEmptyState text="Aucun enregistrement exploitable sur cette période pour le moment." />
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Suivi des analyses IA</CardTitle>
            <CardDescription>
              Vision opérationnelle des analyses en attente, en cours et échouées.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <ScorePill
                label="En file"
                value={logic.queueState?.summary?.queued || 0}
                tone="warning"
              />
              <ScorePill
                label="En cours"
                value={logic.queueState?.summary?.processing || 0}
                tone="accent"
              />
              <ScorePill
                label="Terminés"
                value={logic.queueState?.summary?.completed || 0}
                tone="success"
              />
              <ScorePill
                label="Échecs"
                value={logic.queueState?.summary?.failed || 0}
                tone="danger"
              />
              <ScorePill
                label="Concurrence"
                value={logic.queueState?.summary?.concurrency || 1}
                tone="neutral"
              />
            </div>
            <TableFrame className="max-w-none">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Analyse</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Étape en cours</TableHead>
                    <TableHead>Attente</TableHead>
                    <TableHead>Dernière activité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(logic.queueState?.jobs || []).map(job => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">#{job.id}</TableCell>
                      <TableCell>
                        <ToneBadge status={job.status}>
                          {QUEUE_LABELS[job.status] || job.status}
                        </ToneBadge>
                      </TableCell>
                      <TableCell>{job.currentStep || 'Non renseignée'}</TableCell>
                      <TableCell>{formatWait(numberOrZero(job.waitSeconds))}</TableCell>
                      <TableCell>{formatDate(job.lastHeartbeatAt || job.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                  {(logic.queueState?.jobs || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        Aucune analyse en attente pour le moment.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableFrame>
            <Pagination
              currentPage={logic.queuePage}
              totalPages={logic.queueTotalPages}
              startIndex={logic.queueStartIndex}
              endIndex={logic.queueEndIndex}
              totalItems={logic.queueTotal}
              itemLabel="analyses"
              onPrevious={logic.goToPreviousQueuePage}
              onNext={logic.goToNextQueuePage}
              hasPreviousPage={logic.hasPreviousQueuePage}
              hasNextPage={logic.hasNextQueuePage}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <SessionStrip
            title="À revoir"
            description="Analyses bloquées, échouées ou à validation humaine."
            sessions={reviewSessions.slice(0, 5)}
            emptyText="Aucune analyse à revoir."
            logic={logic}
            tone="review"
          />
          <SessionStrip
            title="Déjà analysés récemment"
            description="Rapports terminés à consulter plutôt que relancer."
            sessions={completedSessions.slice(0, 5)}
            emptyText="Aucune analyse terminée récemment."
            logic={logic}
            tone="done"
          />
        </div>
      </div>
    </div>
  )
}

function formatDashboardSpeechState(recording) {
  if (recording.speechScore !== null && recording.speechScore !== undefined) {
    return `${recording.speechScore}%`
  }
  if (recording.speechScoreStatus === 'analyzing' || recording.speechScoreStatus === 'pending') {
    return 'Calcul parole'
  }
  return '0%'
}

function DashboardRecordingState({ recording, logic }) {
  const status = getDashboardRecordingStatus(recording, logic)

  if (status.kind === 'launching' || status.kind === 'queued' || status.kind === 'processing') {
    return (
      <ToneBadge status={status.kind === 'queued' ? 'QUEUED' : 'PROCESSING'} className="gap-1.5">
        {status.kind === 'queued' ? (
          <Clock3 className="h-3 w-3" />
        ) : (
          <Loader2 className="h-3 w-3 animate-spin" />
        )}
        {status.label}
      </ToneBadge>
    )
  }

  if (status.kind === 'done') {
    return (
      <ToneBadge status="ALREADY_ANALYZED" className="gap-1.5">
        <CheckCircle2 className="h-3 w-3" />
        Déjà analysé
      </ToneBadge>
    )
  }

  return (
    <ToneBadge status={recording.exploitabilityStatus}>
      {EXPLOITABILITY_LABELS[recording.exploitabilityStatus] || recording.exploitabilityStatus}
    </ToneBadge>
  )
}

function DashboardRecordingActions({ recording, logic }) {
  const status = getDashboardRecordingStatus(recording, logic)
  const canLaunch = status.canLaunch && logic.selectedPlanVersionId

  if (recording.latestSessionId && !canLaunch) {
    return (
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => logic.openSession(recording.latestSessionId)}
        >
          <Eye className="mr-2 h-4 w-4" />
          Voir fiche
        </Button>
      </div>
    )
  }

  return (
    <div className="mt-5 flex flex-wrap justify-end gap-2">
      <Button size="sm" onClick={() => logic.launchAnalysis(recording.key)} disabled={!canLaunch}>
        {status.kind === 'launching' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <PlayCircle className="mr-2 h-4 w-4" />
        )}
        {status.kind === 'launching' ? 'Lancement...' : 'Lancer l’analyse'}
      </Button>
      {status.canLaunch ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => logic.launchAnalysis(recording.key, { openAfterLaunch: true })}
          disabled={!logic.selectedPlanVersionId || status.kind === 'launching'}
        >
          <Eye className="mr-2 h-4 w-4" />
          Lancer et ouvrir
        </Button>
      ) : null}
    </div>
  )
}

function getDashboardRecordingStatus(recording, logic) {
  if (logic.launchingRecordingKeys?.has(recording.key)) {
    return { kind: 'launching', label: 'Lancement...', canLaunch: false }
  }
  if (recording.analysisJobStatus === 'QUEUED' || recording.latestSessionStatus === 'PENDING') {
    return { kind: 'queued', label: 'En attente', canLaunch: false }
  }
  if (
    recording.analysisJobStatus === 'PROCESSING' ||
    recording.latestSessionStatus === 'PROCESSING'
  ) {
    return { kind: 'processing', label: 'Analyse en cours', canLaunch: false }
  }
  if (recording.latestSessionStatus === 'COMPLETED') {
    return { kind: 'done', label: 'Déjà analysé', canLaunch: false }
  }
  if (recording.analysisJobStatus && recording.analysisJobStatus !== 'FAILED') {
    return {
      kind: 'locked',
      label: QUEUE_LABELS[recording.analysisJobStatus] || recording.analysisJobStatus,
      canLaunch: false,
    }
  }
  return { kind: 'ready', label: 'Prêt', canLaunch: true }
}
