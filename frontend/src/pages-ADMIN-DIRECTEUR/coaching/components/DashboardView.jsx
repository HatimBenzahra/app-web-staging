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
import { CalendarDays, CheckCircle2, Gauge, PlayCircle } from 'lucide-react'
import {
  EXPLOITABILITY_LABELS,
  PERIOD_OPTIONS,
  QUEUE_LABELS,
  STATUS_LABELS,
} from '../coaching.constants'
import { exploitabilityVariant, formatDate, formatDuration, formatWait } from '../coaching.utils'
import { InlineEmptyState, MetricCard, ScorePill, SessionStrip } from './CoachingShared'

export default function DashboardView({ logic }) {
  const reviewSessions = logic.sessions.filter(
    session =>
      ['FAILED', 'NEEDS_REVIEW'].includes(session.status) || session.reviewStatus === 'PENDING'
  )
  const completedSessions = logic.sessions.filter(session => session.status === 'COMPLETED')

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Candidats de la période" value={logic.prioritizedRecordings.length} />
        <MetricCard
          label="Jobs actifs"
          value={
            (logic.queueState?.summary?.queued || 0) + (logic.queueState?.summary?.processing || 0)
          }
        />
        <MetricCard label="Analyses lancées" value={logic.sessions.length} />
        <MetricCard label="Reviews à traiter" value={reviewSessions.length} />
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
                className="rounded-lg border border-border/70 bg-background px-5 py-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {recording.commercialNom || 'Commercial inconnu'}
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {recording.key}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={exploitabilityVariant(recording.exploitabilityStatus)}>
                      {EXPLOITABILITY_LABELS[recording.exploitabilityStatus] ||
                        recording.exploitabilityStatus}
                    </Badge>
                    <Badge variant="outline">
                      <Gauge className="mr-1 h-3 w-3" />
                      {recording.exploitabilityScore}/100
                    </Badge>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <div className="text-muted-foreground">Date</div>
                    <div>{formatDate(recording.lastModified)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Parole</div>
                    <div>
                      {recording.speechScore !== null && recording.speechScore !== undefined
                        ? `${recording.speechScore}%`
                        : recording.speechScoreStatus || 'n/a'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Durée</div>
                    <div>{formatDuration(recording.totalDurationSec)}</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(recording.exploitabilityReasons || []).slice(0, 3).map(reason => (
                    <Badge key={reason} variant="secondary">
                      {reason}
                    </Badge>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  {recording.latestSessionId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => logic.openSession(recording.latestSessionId)}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Ouvrir la fiche
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    onClick={() => logic.launchAnalysis(recording.key)}
                    disabled={logic.submitting || !logic.selectedPlanVersionId}
                  >
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Ajouter à la queue
                  </Button>
                </div>
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
            <CardTitle>État de la queue IA</CardTitle>
            <CardDescription>
              Vision opérationnelle des analyses en attente, en cours et échouées.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <ScorePill label="En file" value={logic.queueState?.summary?.queued || 0} />
              <ScorePill label="En cours" value={logic.queueState?.summary?.processing || 0} />
              <ScorePill label="Terminés" value={logic.queueState?.summary?.completed || 0} />
              <ScorePill label="Échecs" value={logic.queueState?.summary?.failed || 0} />
              <ScorePill label="Concurrence" value={logic.queueState?.summary?.concurrency || 1} />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Étape exacte</TableHead>
                    <TableHead>Attente</TableHead>
                    <TableHead>Dernier signal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(logic.queueState?.jobs || []).slice(0, 8).map(job => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">#{job.id}</TableCell>
                      <TableCell>
                        <Badge variant={job.status === 'FAILED' ? 'destructive' : 'outline'}>
                          {QUEUE_LABELS[job.status] || job.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{job.currentStep || 'n/a'}</TableCell>
                      <TableCell>{formatWait(job.waitSeconds)}</TableCell>
                      <TableCell>{formatDate(job.lastHeartbeatAt || job.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                  {(logic.queueState?.jobs || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        Aucun job d’analyse dans la queue.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
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
