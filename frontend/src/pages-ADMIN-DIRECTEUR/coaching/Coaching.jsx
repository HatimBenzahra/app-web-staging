import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { Textarea } from '@/components/ui/textarea'
import { Pagination } from '@/components/Pagination'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileAudio,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Mic,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
} from 'lucide-react'
import { useCoachingLogic } from './useCoachingLogic'

const STATUS_LABELS = {
  PENDING: 'En attente',
  PROCESSING: 'Analyse en cours',
  COMPLETED: 'Terminé',
  FAILED: 'Échec',
  NEEDS_REVIEW: 'À vérifier',
}

const REVIEW_LABELS = {
  NOT_REQUIRED: 'Auto-validé',
  PENDING: 'Review requise',
  VALIDATED: 'Validé',
  REJECTED: 'Rejeté',
}

const CONVERSATION_LABELS = {
  COMPLETED: 'Évaluée',
  NEEDS_REVIEW: 'À vérifier',
  SKIPPED: 'Non exploitable',
  FAILED: 'Échec',
}

const EXPLOITABILITY_LABELS = {
  PRIORITY: 'Prioritaire',
  GOOD: 'Correct',
  LOW_VALUE: 'Faible valeur',
  ALREADY_ANALYZED: 'Déjà analysé',
  REVIEW: 'À revoir',
}

const QUEUE_LABELS = {
  QUEUED: 'En file',
  PROCESSING: 'En cours',
  COMPLETED: 'Terminé',
  FAILED: 'Échec',
  CANCELLED: 'Annulé',
}

const PERIOD_OPTIONS = [
  { value: 'TODAY', label: "Aujourd'hui" },
  { value: 'LAST_7_DAYS', label: '7 derniers jours' },
  { value: 'LAST_30_DAYS', label: '30 derniers jours' },
]

const COACHING_SECTIONS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Priorisation, queue et alertes de revue.',
    href: '/coaching/dashboard',
    icon: LayoutDashboard,
  },
  {
    key: 'recordings',
    label: 'Enregistrements',
    description: 'Stock complet et lancement des analyses.',
    href: '/coaching/recordings',
    icon: FileAudio,
  },
  {
    key: 'sessions',
    label: 'Analyses',
    description: 'Historique des rapports et suivi des sessions.',
    href: '/coaching/sessions',
    icon: ListChecks,
  },
  {
    key: 'plans',
    label: 'Plans',
    description: 'Trames de vente et consignes d’évaluation.',
    href: '/coaching/plans',
    icon: Target,
  },
]

function formatDate(value) {
  if (!value) return 'n/a'
  return new Date(value).toLocaleString('fr-FR')
}

function formatSeconds(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a'
  const totalSeconds = Math.max(0, Math.floor(Number(value)))
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function formatDuration(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a'
  const totalSeconds = Math.max(0, Math.floor(Number(value)))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  return `${minutes}m ${String(totalSeconds % 60).padStart(2, '0')}s`
}

function formatWait(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a'
  const seconds = Math.max(0, Math.floor(Number(value)))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function formatSize(value) {
  if (!value || Number.isNaN(Number(value))) return 'n/a'
  const bytes = Number(value)
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function statusVariant(status) {
  if (status === 'FAILED') return 'destructive'
  if (status === 'NEEDS_REVIEW') return 'secondary'
  return 'outline'
}

function exploitabilityVariant(status) {
  if (status === 'PRIORITY') return 'default'
  if (status === 'REVIEW') return 'secondary'
  if (status === 'LOW_VALUE') return 'outline'
  return 'outline'
}

function MetricCard({ label, value, hint }) {
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

function ScorePill({ label, value }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value ?? 'n/a'}</div>
    </div>
  )
}

function SectionNav({ currentSection }) {
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

function DashboardView({ logic }) {
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
                  <InfoLine label="Date" value={formatDate(recording.lastModified)} />
                  <InfoLine
                    label="Parole"
                    value={
                      recording.speechScore !== null && recording.speechScore !== undefined
                        ? `${recording.speechScore}%`
                        : recording.speechScoreStatus || 'n/a'
                    }
                  />
                  <InfoLine label="Durée" value={formatDuration(recording.totalDurationSec)} />
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
            <EmptyState text="Aucun enregistrement exploitable sur cette période pour le moment." />
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

function RecordingsView({ logic }) {
  return (
    <Card className="border-border/70">
      <CardHeader className="gap-4">
        <div className="space-y-1">
          <CardTitle>Liste complète des enregistrements</CardTitle>
          <CardDescription>
            Stock accessible, recherche rapide, pagination et mise en file à la demande.
          </CardDescription>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="w-full md:max-w-md">
            <Label htmlFor="recordings-search">Recherche</Label>
            <Input
              id="recordings-search"
              value={logic.recordingsSearch}
              onChange={event => logic.setRecordingsSearch(event.target.value)}
              placeholder="Commercial, room, adresse, clé S3..."
              className="mt-2"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {logic.recordingsTotal} enregistrements trouvés
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Commercial</TableHead>
                <TableHead>Enregistrement</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Parole</TableHead>
                <TableHead>Exploitabilité</TableHead>
                <TableHead>Taille</TableHead>
                <TableHead>Dernière analyse</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logic.recordings.map(recording => (
                <TableRow key={recording.key}>
                  <TableCell>
                    <div className="font-medium">{recording.commercialNom || 'Inconnu'}</div>
                    <div className="text-xs text-muted-foreground">{recording.roomName}</div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-104 truncate text-sm">{recording.key}</div>
                  </TableCell>
                  <TableCell>{formatDate(recording.lastModified)}</TableCell>
                  <TableCell>
                    {recording.speechScore !== null && recording.speechScore !== undefined
                      ? `${recording.speechScore}%`
                      : recording.speechScoreStatus || 'n/a'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={exploitabilityVariant(recording.exploitabilityStatus)}>
                      {EXPLOITABILITY_LABELS[recording.exploitabilityStatus] ||
                        recording.exploitabilityStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatSize(recording.size)}</TableCell>
                  <TableCell>
                    {recording.latestSessionId ? (
                      <button
                        type="button"
                        className="text-left text-sm text-primary hover:underline"
                        onClick={() => logic.openSession(recording.latestSessionId)}
                      >
                        {STATUS_LABELS[recording.latestSessionStatus] ||
                          recording.latestSessionStatus}
                      </button>
                    ) : (
                      <span className="text-sm text-muted-foreground">Aucune</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => logic.launchAnalysis(recording.key)}
                      disabled={logic.submitting || !logic.selectedPlanVersionId}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Lancer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {logic.recordings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Aucun enregistrement commercial disponible pour cette recherche.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <Pagination
          currentPage={logic.recordingsPage}
          totalPages={logic.recordingsTotalPages}
          startIndex={logic.recordingsStartIndex}
          endIndex={logic.recordingsEndIndex}
          totalItems={logic.recordingsTotal}
          itemLabel="enregistrements"
          onPrevious={logic.goToPreviousRecordingsPage}
          onNext={logic.goToNextRecordingsPage}
          hasPreviousPage={logic.hasPreviousRecordingsPage}
          hasNextPage={logic.hasNextRecordingsPage}
        />
      </CardContent>
    </Card>
  )
}

function SessionsView({ logic }) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Analyses coaching</CardTitle>
        <CardDescription>
          Historique des sessions lancées. Ouvre une fiche pour lire le rapport détaillé et la
          revue.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Commercial</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Review</TableHead>
              <TableHead>Créée le</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logic.sessions.map(session => (
              <TableRow
                key={session.id}
                className="cursor-pointer"
                onClick={() => logic.openSession(session.id)}
              >
                <TableCell className="font-medium">#{session.id}</TableCell>
                <TableCell>{session.commercialNom || 'Inconnu'}</TableCell>
                <TableCell>
                  <div className="text-sm">{session.salesPlanNom || 'Plan supprimé'}</div>
                  <div className="text-xs text-muted-foreground">
                    {session.salesPlanVersionLabel || 'Version sans label'}
                  </div>
                </TableCell>
                <TableCell>{session.overallScore ?? 'n/a'}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(session.status)}>
                    {STATUS_LABELS[session.status] || session.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {REVIEW_LABELS[session.reviewStatus] || session.reviewStatus}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(session.createdAt)}</TableCell>
              </TableRow>
            ))}
            {logic.sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Aucune session coaching pour le moment.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function PlansView({ logic }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <Card className="border-border/70">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Créer un plan de vente</CardTitle>
              <CardDescription>
                Chaque étape saisie devient un critère évalué dans le rapport coaching.
              </CardDescription>
            </div>
            {logic.canUseDevPrefill ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={logic.fillDevSalesPlan}
                disabled={logic.submitting}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Préremplir dev
              </Button>
            ) : null}
          </div>
          {logic.canUseDevPrefill ? (
            <div className="text-xs text-muted-foreground">
              Le préremplissage sert uniquement au staging et au test rapide du flow.
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-5">
          <FieldBlock label="Nom du plan">
            <Input
              value={logic.planForm.nom}
              onChange={event =>
                logic.setPlanForm(current => ({ ...current, nom: event.target.value }))
              }
              placeholder="Plan vente terrain énergie, fibre, closing manager..."
            />
          </FieldBlock>

          <FieldBlock label="Description">
            <Textarea
              value={logic.planForm.description}
              onChange={event =>
                logic.setPlanForm(current => ({ ...current, description: event.target.value }))
              }
              placeholder="Objectif du plan, cible, contexte, variantes utiles"
              className="min-h-[84px]"
            />
          </FieldBlock>

          <FieldBlock label="Consigne LLM">
            <Textarea
              value={logic.planForm.promptInstructions}
              onChange={event =>
                logic.setPlanForm(current => ({
                  ...current,
                  promptInstructions: event.target.value,
                }))
              }
              placeholder="Précisions d’évaluation métier, ton attendu, règles internes..."
              className="min-h-[96px]"
            />
          </FieldBlock>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Étapes du plan</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {logic.planForm.steps.length} étape(s). Chaque titre rempli sera évalué.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={logic.addStep}>
                Ajouter une étape
              </Button>
            </div>

            {logic.planForm.steps.map((step, index) => (
              <div
                key={index}
                className="rounded-lg border border-border/70 bg-background px-4 py-4"
              >
                <div className="grid gap-4 md:grid-cols-[1fr_120px]">
                  <FieldBlock label={`Titre étape ${index + 1}`}>
                    <Input
                      value={step.titre}
                      onChange={event => logic.updateStep(index, 'titre', event.target.value)}
                      placeholder="Validation du décideur, pitch tarif, preuve sociale..."
                    />
                  </FieldBlock>
                  <FieldBlock label="Poids">
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={step.poids}
                      onChange={event => logic.updateStep(index, 'poids', event.target.value)}
                    />
                  </FieldBlock>
                </div>

                <div className="mt-4">
                  <FieldBlock label="Description">
                    <Textarea
                      value={step.description}
                      onChange={event => logic.updateStep(index, 'description', event.target.value)}
                      placeholder="Ce que le commercial doit réussir dans cette étape."
                      className="min-h-[72px]"
                    />
                  </FieldBlock>
                </div>

                <div className="mt-4">
                  <FieldBlock label="Signaux attendus">
                    <Textarea
                      value={step.expectedSignals}
                      onChange={event =>
                        logic.updateStep(index, 'expectedSignals', event.target.value)
                      }
                      placeholder="Mots clés, preuves, objections, comportements observables"
                      className="min-h-[72px]"
                    />
                  </FieldBlock>
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logic.duplicateStep(index)}
                  >
                    Dupliquer
                  </Button>
                  {logic.planForm.steps.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => logic.removeStep(index)}
                    >
                      Retirer
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={logic.createPlan}
            disabled={logic.submitting || !logic.planForm.nom.trim() || !logic.planHasNamedStep}
          >
            {logic.submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Target className="mr-2 h-4 w-4" />
            )}
            Créer et publier le plan
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Plans disponibles</CardTitle>
          <CardDescription>
            Versions existantes, statut de publication et étapes actuellement exploitées.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {logic.plans.map(plan => (
            <div
              key={plan.id}
              className="rounded-lg border border-border/70 bg-background px-4 py-4"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-base font-semibold">{plan.nom}</div>
                  {plan.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                  ) : null}
                </div>
                <Badge variant="outline">{plan.status}</Badge>
              </div>

              <div className="mt-4 space-y-3">
                {plan.versions.map(version => (
                  <div key={version.id} className="rounded-lg bg-muted/35 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">
                        {version.label || `Version ${version.versionNumber}`}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{version.status}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {version.steps.length} étapes
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {version.steps.map(step => (
                        <div
                          key={step.id}
                          className="rounded-md border border-border/60 bg-background px-3 py-3"
                        >
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <div className="text-sm font-medium">
                              {step.ordre}. {step.titre}
                            </div>
                            <Badge variant="secondary">poids {step.poids}</Badge>
                          </div>
                          {step.description ? (
                            <p className="mt-2 text-xs text-muted-foreground">{step.description}</p>
                          ) : null}
                          {step.expectedSignals ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {step.expectedSignals}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {logic.plans.length === 0 ? (
            <EmptyState text="Aucun plan de vente n’a encore été créé." />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function SessionDetailView({ logic }) {
  const session = logic.selectedSession

  if (!session) {
    return (
      <Card className="border-border/70">
        <CardContent className="flex min-h-[280px] items-center justify-center text-muted-foreground">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            Chargement du rapport d’analyse...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/coaching/sessions">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux analyses
            </Link>
          </Button>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Session #{session.id}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {session.commercialNom || 'Commercial inconnu'} ·{' '}
              {session.salesPlanNom || 'Plan non trouvé'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusVariant(session.status)}>
            {STATUS_LABELS[session.status] || session.status}
          </Badge>
          <Badge variant="outline">
            {REVIEW_LABELS[session.reviewStatus] || session.reviewStatus}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          {session.reviewReason ? (
            <Alert>
              <Bot className="h-4 w-4" />
              <AlertTitle>Validation humaine requise</AlertTitle>
              <AlertDescription>{session.reviewReason}</AlertDescription>
            </Alert>
          ) : null}

          {session.failureReason ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Le pipeline a échoué</AlertTitle>
              <AlertDescription>{session.failureReason}</AlertDescription>
            </Alert>
          ) : null}

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Synthèse coaching</CardTitle>
              <CardDescription>
                Les indicateurs principaux avant de descendre dans le transcript complet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <ScorePill label="Global" value={session.overallScore} />
                <ScorePill label="Couverture plan" value={session.planCoverageScore} />
                <ScorePill label="Exécution" value={session.executionQualityScore} />
                <ScorePill label="Objections" value={session.objectionHandlingScore} />
                <ScorePill label="Écoute / parole" value={session.listeningRatioScore} />
                <ScorePill label="Closing" value={session.closingScore} />
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Bilan IA
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                    {session.summary || 'Synthèse indisponible pour le moment.'}
                  </p>
                </div>
                <div className="grid gap-4">
                  <BulletBlock
                    title="Points forts"
                    items={session.strengths}
                    empty="Aucun point fort remonté"
                  />
                  <BulletBlock
                    title="Axes d’amélioration"
                    items={session.improvements}
                    empty="Aucun axe d’amélioration remonté"
                  />
                  <BulletBlock
                    title="Actions recommandées"
                    items={session.recommendations}
                    empty="Aucune recommandation générée"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Conversations détectées</CardTitle>
              <CardDescription>
                Un enregistrement peut contenir plusieurs échanges. Chaque bloc est évalué
                séparément.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(session.conversationEvaluations || []).map(conversation => (
                <div
                  key={conversation.id}
                  className="rounded-lg border border-border/70 bg-background px-4 py-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="font-medium">
                        {conversation.title || `Conversation ${conversation.ordre}`}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatSeconds(conversation.startTime)} →{' '}
                        {formatSeconds(conversation.endTime)}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={conversation.status === 'FAILED' ? 'destructive' : 'outline'}>
                        {CONVERSATION_LABELS[conversation.status] || conversation.status}
                      </Badge>
                      <Badge variant="secondary">Score {conversation.overallScore ?? 'n/a'}</Badge>
                    </div>
                  </div>

                  {conversation.reviewReason ? (
                    <Alert className="mt-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Bloc à relire</AlertTitle>
                      <AlertDescription>{conversation.reviewReason}</AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <ScorePill label="Plan" value={conversation.planCoverageScore} />
                    <ScorePill label="Exécution" value={conversation.executionQualityScore} />
                    <ScorePill label="Closing" value={conversation.closingScore} />
                  </div>

                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {conversation.summary || 'Aucune synthèse disponible pour ce bloc.'}
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <BulletBlock
                      title="Forces"
                      items={conversation.strengths || []}
                      empty="n/a"
                      compact
                    />
                    <BulletBlock
                      title="À améliorer"
                      items={conversation.improvements || []}
                      empty="n/a"
                      compact
                    />
                    <BulletBlock
                      title="Recos"
                      items={conversation.recommendations || []}
                      empty="n/a"
                      compact
                    />
                  </div>

                  <Textarea
                    readOnly
                    value={
                      conversation.readableTranscriptText ||
                      conversation.transcriptText ||
                      'Transcript indisponible'
                    }
                    className="mt-4 min-h-[140px] font-mono text-xs"
                  />
                </div>
              ))}
              {(session.conversationEvaluations || []).length === 0 ? (
                <EmptyState text="Aucune conversation séparée n’a encore été produite pour cette session." />
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Évaluation par étape</CardTitle>
              <CardDescription>
                Lecture détaillée du plan de vente appliqué à cette session.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {session.stepEvaluations.map(step => (
                <div
                  key={step.id}
                  className="rounded-lg border border-border/70 bg-background px-4 py-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="font-medium">
                      {step.ordre}. {step.titre}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{step.coverageStatus}</Badge>
                      <Badge variant="outline">{step.score ?? 'n/a'}</Badge>
                    </div>
                  </div>
                  {step.verbatim ? (
                    <div className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
                      {step.verbatim}
                    </div>
                  ) : null}
                  {step.feedback ? (
                    <p className="mt-3 text-sm text-muted-foreground">{step.feedback}</p>
                  ) : null}
                  {step.recommendation ? (
                    <p className="mt-2 text-sm">{step.recommendation}</p>
                  ) : null}
                </div>
              ))}
              {session.stepEvaluations.length === 0 ? (
                <EmptyState text="Les étapes détaillées n’ont pas encore été produites." />
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>État exact de l’analyse</CardTitle>
              <CardDescription>
                Pipeline, job queue et dernier point connu du traitement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(session.pipelineSteps || []).map(step => (
                <div
                  key={step.key}
                  className="flex items-start gap-3 rounded-lg border border-border/70 bg-background px-3 py-3"
                >
                  <div className="mt-0.5">
                    {step.status === 'PROCESSING' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : step.status === 'COMPLETED' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : step.status === 'FAILED' ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{step.label}</span>
                      <Badge variant={step.status === 'FAILED' ? 'destructive' : 'outline'}>
                        {step.status}
                      </Badge>
                    </div>
                    {step.detail || step.timestamp ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {step.detail || formatDate(step.timestamp)}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {session.analysisJob ? (
                <div className="rounded-lg bg-muted/35 px-4 py-3">
                  <div className="flex items-center gap-2 font-medium">
                    <Activity className="h-4 w-4" />
                    Job #{session.analysisJob.id}
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <span>
                      Statut:{' '}
                      {QUEUE_LABELS[session.analysisJob.status] || session.analysisJob.status}
                    </span>
                    <span>
                      Tentatives: {session.analysisJob.attempts}/{session.analysisJob.maxAttempts}
                    </span>
                    <span>Attente: {formatWait(session.analysisJob.waitSeconds)}</span>
                    <span>Heartbeat: {formatDate(session.analysisJob.lastHeartbeatAt)}</span>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Informations session</CardTitle>
              <CardDescription>Métadonnées utiles pour la revue et le diagnostic.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoLine label="S3 key" value={session.s3KeyOriginal} breakAll />
              <InfoLine label="Lancée le" value={formatDate(session.launchedAt)} />
              <InfoLine label="Traitée le" value={formatDate(session.processedAt)} />
              <InfoLine label="Confiance" value={session.confidenceScore ?? 'n/a'} />
              <InfoLine
                label="Source identification"
                value={session.identificationSource || 'n/a'}
              />
              <InfoLine label="Segments Whisper" value={session.whisperSegmentsCount ?? 'n/a'} />
              <InfoLine label="Durée transcript" value={session.transcriptDurationSec ?? 'n/a'} />
              {session.audioUrl ? (
                <audio controls className="mt-4 w-full" src={session.audioUrl} />
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Review humaine</CardTitle>
              <CardDescription>
                Valider le rapport, corriger le commercial ou relancer l’analyse.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldBlock label="Commercial identifié">
                <Select
                  value={logic.reviewCommercialId}
                  onValueChange={logic.setReviewCommercialId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Conserver l’identification actuelle" />
                  </SelectTrigger>
                  <SelectContent>
                    {logic.commercialOptions.map(option => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldBlock>

              <FieldBlock label="Notes de revue">
                <Textarea
                  value={logic.reviewNotes}
                  onChange={event => logic.setReviewNotes(event.target.value)}
                  placeholder="Ajouter un commentaire de validation ou de rejet"
                  className="min-h-[120px]"
                />
              </FieldBlock>

              <div className="grid gap-3 sm:grid-cols-3">
                <Button
                  type="button"
                  onClick={() => logic.reviewSession('APPROVE')}
                  disabled={logic.submitting}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Valider
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => logic.reviewSession('REJECT')}
                  disabled={logic.submitting}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Rejeter
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => logic.relaunchSession(session.id)}
                  disabled={logic.submitting}
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Relancer
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Transcript</CardTitle>
              <CardDescription>
                Version lisible d’abord, brute Whisper ensuite si besoin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                readOnly
                value={
                  session.readableTranscriptText ||
                  session.transcriptText ||
                  'Transcript indisponible'
                }
                className="min-h-[260px] font-mono text-xs"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function InfoLine({ label, value, breakAll = false }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={breakAll ? 'max-w-[20rem] text-right break-all' : 'text-right'}>
        {value}
      </span>
    </div>
  )
}

function FieldBlock({ label, children }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function BulletBlock({ title, items, empty, compact = false }) {
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
      <ul
        className={
          compact
            ? 'mt-2 space-y-1 text-sm text-muted-foreground'
            : 'mt-2 space-y-1 text-sm text-muted-foreground'
        }
      >
        {items.map(item => (
          <li key={item}>• {item}</li>
        ))}
        {items.length === 0 ? <li>• {empty}</li> : null}
      </ul>
    </div>
  )
}

function SessionStrip({ title, description, sessions, emptyText, logic, tone }) {
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
        {sessions.length === 0 ? <EmptyState text={emptyText} compact /> : null}
      </CardContent>
    </Card>
  )
}

function EmptyState({ text, compact = false }) {
  return (
    <div
      className={[
        'rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground',
        compact ? 'px-4 py-6' : 'px-4 py-8',
      ].join(' ')}
    >
      {text}
    </div>
  )
}

export default function Coaching() {
  const logic = useCoachingLogic()
  const location = useLocation()

  const currentSection = React.useMemo(() => {
    if (/\/coaching\/sessions\/\d+/.test(location.pathname)) return 'session-detail'
    if (location.pathname.startsWith('/coaching/recordings')) return 'recordings'
    if (location.pathname.startsWith('/coaching/sessions')) return 'sessions'
    if (location.pathname.startsWith('/coaching/plans')) return 'plans'
    return 'dashboard'
  }, [location.pathname])

  if (logic.loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Chargement du module coaching...
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Bot className="h-3.5 w-3.5" />
              Espace coaching directeur
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Coaching IA</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                Une navigation claire par usage: prioriser les bons enregistrements, piloter la
                queue, relire les analyses, et faire évoluer les plans sans tout mélanger.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {currentSection !== 'plans' ? (
              <div className="min-w-72">
                <Label htmlFor="plan-version-select">
                  Version publiée utilisée pour les analyses
                </Label>
                <Select
                  value={logic.selectedPlanVersionId}
                  onValueChange={logic.setSelectedPlanVersionId}
                >
                  <SelectTrigger id="plan-version-select" className="mt-2">
                    <SelectValue placeholder="Choisir une version publiée" />
                  </SelectTrigger>
                  <SelectContent>
                    {logic.publishedVersions.map(version => (
                      <SelectItem key={version.id} value={String(version.id)}>
                        {version.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <Button
              type="button"
              variant="outline"
              onClick={logic.refreshAll}
              disabled={logic.submitting}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
          </div>
        </div>

        {logic.error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Le module coaching a rencontré une erreur</AlertTitle>
            <AlertDescription>
              {logic.error.message || 'Une erreur est survenue pendant le chargement.'}
            </AlertDescription>
          </Alert>
        ) : null}

        {currentSection !== 'session-detail' ? (
          <SectionNav currentSection={currentSection} />
        ) : null}
      </div>

      {currentSection === 'dashboard' ? <DashboardView logic={logic} /> : null}
      {currentSection === 'recordings' ? <RecordingsView logic={logic} /> : null}
      {currentSection === 'sessions' ? <SessionsView logic={logic} /> : null}
      {currentSection === 'plans' ? <PlansView logic={logic} /> : null}
      {currentSection === 'session-detail' ? <SessionDetailView logic={logic} /> : null}
    </div>
  )
}
