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
import { Clock3, Eye, Loader2, Search, X } from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import { REVIEW_LABELS, STATUS_LABELS } from '../coaching.constants'
import { badgeToneClass, formatDate, formatScoreValue } from '../coaching.utils'
import { TableFrame, ToneBadge } from './CoachingShared'

export default function SessionsView({ logic }) {
  const activeFiltersCount = [
    logic.sessionsSearch.trim(),
    logic.sessionsStatus,
    logic.sessionsReviewStatus,
    logic.sessionsScoreLevel,
  ].filter(value => value && value !== 'ALL').length

  return (
    <Card className="mx-auto w-full max-w-[1500px] border-border/70">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Analyses coaching</CardTitle>
            <CardDescription className="mt-1">
              Historique des sessions lancées, avec suivi de traitement et validation.
            </CardDescription>
          </div>
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{logic.sessionsTotal}</span> analyse(s)
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/15 p-4">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_auto]">
            <div>
              <Label htmlFor="sessions-search">Recherche</Label>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="sessions-search"
                  value={logic.sessionsSearch}
                  onChange={event => logic.setSessionsSearch(event.target.value)}
                  placeholder="Commercial, plan, statut, #id..."
                  className="bg-background pl-9"
                />
              </div>
            </div>

            <div>
              <Label>Statut</Label>
              <Select value={logic.sessionsStatus} onValueChange={logic.setSessionsStatus}>
                <SelectTrigger className="mt-2 bg-background">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous statuts</SelectItem>
                  <SelectItem value="ACTIVE">En attente / cours</SelectItem>
                  <SelectItem value="COMPLETED">Terminées</SelectItem>
                  <SelectItem value="NEEDS_REVIEW">À vérifier</SelectItem>
                  <SelectItem value="FAILED">Échecs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Validation</Label>
              <Select
                value={logic.sessionsReviewStatus}
                onValueChange={logic.setSessionsReviewStatus}
              >
                <SelectTrigger className="mt-2 bg-background">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes validations</SelectItem>
                  <SelectItem value="PENDING">Validation requise</SelectItem>
                  <SelectItem value="VALIDATED">Validées</SelectItem>
                  <SelectItem value="REJECTED">Rejetées</SelectItem>
                  <SelectItem value="NOT_REQUIRED">Auto-validées</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Score</Label>
              <Select value={logic.sessionsScoreLevel} onValueChange={logic.setSessionsScoreLevel}>
                <SelectTrigger className="mt-2 bg-background">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous scores</SelectItem>
                  <SelectItem value="HIGH">Fort · 80+</SelectItem>
                  <SelectItem value="MEDIUM">Moyen · 50-79</SelectItem>
                  <SelectItem value="LOW">Faible · 0-49</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="w-full lg:w-auto"
                onClick={logic.resetSessionsFilters}
                disabled={activeFiltersCount === 0}
              >
                <X className="mr-2 h-4 w-4" />
                Réinitialiser
              </Button>
            </div>
          </div>

          <div className="mt-3 text-sm text-muted-foreground">
            {activeFiltersCount > 0
              ? `${activeFiltersCount} filtre(s) actif(s)`
              : 'Tous les rapports sont affichés.'}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex min-h-5 items-center justify-end text-xs text-muted-foreground">
          {logic.sessionsRefreshing ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Chargement des analyses...
            </span>
          ) : null}
        </div>
        <TableFrame
          className={[
            'max-w-none transition-opacity duration-150',
            logic.sessionsRefreshing ? 'opacity-60' : '',
          ].join(' ')}
        >
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Commercial</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Validation</TableHead>
                <TableHead>Créée le</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logic.sessions.map(session => {
                const treatment = getSessionTreatmentState(session)
                return (
                  <TableRow
                    key={session.id}
                    className={[
                      'cursor-pointer',
                      treatment.active ? 'bg-primary/5 hover:bg-primary/8' : '',
                    ].join(' ')}
                    onClick={() => logic.openSession(session.id)}
                  >
                    <TableCell>
                      <div className="font-medium">{session.commercialNom || 'Inconnu'}</div>
                    </TableCell>
                    <TableCell>
                      {treatment.active ? (
                        <span className="inline-flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1 text-sm text-muted-foreground">
                          {treatment.kind === 'queued' ? (
                            <Clock3 className="h-4 w-4" />
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          Rapport en préparation
                        </span>
                      ) : (
                        <ScoreBadge score={session.overallScore} />
                      )}
                    </TableCell>
                    <TableCell>
                      <ToneBadge
                        status={
                          treatment.active
                            ? session.analysisJob?.status || session.status
                            : session.status
                        }
                      >
                        {treatment.label}
                      </ToneBadge>
                      {treatment.hint ? (
                        <div className="mt-1 text-xs text-muted-foreground">{treatment.hint}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <ToneBadge status={session.reviewStatus}>
                        {REVIEW_LABELS[session.reviewStatus] || session.reviewStatus}
                      </ToneBadge>
                    </TableCell>
                    <TableCell>{formatDate(session.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={event => {
                          event.stopPropagation()
                          logic.openSession(session.id)
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Voir fiche
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {logic.sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {logic.sessionsTotal === 0 && activeFiltersCount === 0
                      ? 'Aucune session coaching pour le moment.'
                      : 'Aucune analyse ne correspond aux filtres.'}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableFrame>

        <Pagination
          currentPage={logic.sessionsPage}
          totalPages={logic.sessionsTotalPages}
          startIndex={logic.sessionsStartIndex}
          endIndex={logic.sessionsEndIndex}
          totalItems={logic.sessionsTotal}
          itemLabel="analyses"
          onPrevious={logic.goToPreviousSessionsPage}
          onNext={logic.goToNextSessionsPage}
          hasPreviousPage={logic.hasPreviousSessionsPage}
          hasNextPage={logic.hasNextSessionsPage}
        />
      </CardContent>
    </Card>
  )
}

function ScoreBadge({ score }) {
  const numericScore = score ?? 0
  const quality =
    numericScore >= 85
      ? 'Excellent'
      : numericScore >= 70
        ? 'Bon'
        : numericScore >= 50
          ? 'Moyen'
          : 'Faible'
  const variant = numericScore >= 70 ? 'default' : numericScore >= 50 ? 'secondary' : 'outline'
  const tone = numericScore >= 70 ? 'success' : numericScore >= 50 ? 'warning' : 'danger'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-medium tabular-nums">{formatScoreValue(score)}</span>
      <Badge variant={variant} className={badgeToneClass(tone)}>
        {quality}
      </Badge>
    </div>
  )
}

function getSessionTreatmentState(session) {
  const jobStatus = session.analysisJob?.status

  if (session.status === 'COMPLETED' || session.status === 'NEEDS_REVIEW') {
    return {
      active: false,
      kind: 'done',
      label: STATUS_LABELS[session.status] || session.status,
      hint: '',
    }
  }

  if (jobStatus === 'QUEUED' || session.status === 'PENDING') {
    return {
      active: true,
      kind: 'queued',
      label: 'En attente',
      hint: 'Analyse programmée',
    }
  }

  if (jobStatus === 'PROCESSING' || session.status === 'PROCESSING') {
    return {
      active: true,
      kind: 'processing',
      label: 'Analyse en cours',
      hint: session.analysisJob?.currentStep || 'Rapport en préparation',
    }
  }

  return {
    active: false,
    kind: 'done',
    label: STATUS_LABELS[session.status] || session.status,
    hint: '',
  }
}
