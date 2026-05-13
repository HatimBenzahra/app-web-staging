import React from 'react'
import { Link } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Pagination } from '@/components/Pagination'
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
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

function ScorePill({ label, value }) {
  return (
    <div className="rounded-lg border border-border/70 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value ?? 'n/a'}</div>
    </div>
  )
}

export default function Coaching() {
  const logic = useCoachingLogic()

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Coaching IA</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {logic.isSessionDetail
              ? 'Page cœur du MVP: rapport détaillé, scores, étapes évaluées, transcript et review humaine.'
              : 'MVP de validation pour créer un plan de vente, lancer une analyse depuis un enregistrement complet et relire un rapport exploitable côté admin/directeur.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {logic.isSessionDetail && (
            <Button type="button" variant="outline" className="mt-6" asChild>
              <Link to="/coaching">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux analyses
              </Link>
            </Button>
          )}
          <div className="min-w-72">
            <Label htmlFor="plan-version-select">Version publiée utilisée pour les analyses</Label>
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
          <Button
            type="button"
            variant="outline"
            className="mt-6"
            onClick={logic.refreshAll}
            disabled={logic.submitting}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualiser
          </Button>
        </div>
      </div>

      {logic.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Le module coaching a rencontré une erreur</AlertTitle>
          <AlertDescription>
            {logic.error.message || 'Une erreur est survenue pendant le chargement du MVP.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Versions publiées</CardDescription>
            <CardTitle className="text-3xl">{logic.publishedVersions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Enregistrements exploitables</CardDescription>
            <CardTitle className="text-3xl">{logic.recordings.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Analyses lancées</CardDescription>
            <CardTitle className="text-3xl">{logic.sessions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Reviews à traiter</CardDescription>
            <CardTitle className="text-3xl">
              {logic.sessions.filter(session => session.reviewStatus === 'PENDING').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs value={logic.activeTab} onValueChange={logic.setActiveTab}>
        <TabsList>
          <TabsTrigger value="analyses">
            <Mic className="h-4 w-4" />
            Analyses coaching
          </TabsTrigger>
          <TabsTrigger value="plans">
            <Target className="h-4 w-4" />
            Plans de vente
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analyses" className="space-y-6">
          {!logic.isSessionDetail && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Flow MVP 1: lancer une analyse</CardTitle>
                  <CardDescription>
                    Recherche serveur et pagination backend: on ne charge que 20 enregistrements
                    par page pour éviter les listes de 900 lignes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div className="w-full md:max-w-md">
                      <Label htmlFor="recordings-search">Rechercher un enregistrement</Label>
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Commercial</TableHead>
                          <TableHead>Enregistrement</TableHead>
                          <TableHead>Dernière mise à jour</TableHead>
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
                              <div className="max-w-[26rem] truncate text-sm">{recording.key}</div>
                            </TableCell>
                            <TableCell>{formatDate(recording.lastModified)}</TableCell>
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
                        {logic.recordings.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                              Aucun enregistrement commercial disponible pour cette recherche.
                            </TableCell>
                          </TableRow>
                        )}
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

              <Card>
                <CardHeader>
                  <CardTitle>Flow MVP 2: relire les analyses</CardTitle>
                  <CardDescription>
                    Clique sur une session pour ouvrir la page cœur: rapport complet, scores,
                    étapes évaluées, transcript et review.
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
                      {logic.sessions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                            Aucune session coaching pour le moment.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}

          {logic.isSessionDetail && !logic.selectedSession && (
            <Card>
              <CardContent className="flex min-h-[260px] items-center justify-center text-muted-foreground">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Chargement du rapport d’analyse...
                </div>
              </CardContent>
            </Card>
          )}

          {logic.selectedSession && (
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle>
                        Détail session #{logic.selectedSession.id}
                      </CardTitle>
                      <CardDescription>
                        {logic.selectedSession.commercialNom || 'Commercial inconnu'} ·{' '}
                        {logic.selectedSession.salesPlanNom || 'Plan non trouvé'}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(logic.selectedSession.status)}>
                        {STATUS_LABELS[logic.selectedSession.status] ||
                          logic.selectedSession.status}
                      </Badge>
                      <Badge variant="outline">
                        {REVIEW_LABELS[logic.selectedSession.reviewStatus] ||
                          logic.selectedSession.reviewStatus}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {logic.selectedSession.reviewReason && (
                    <Alert>
                      <Bot className="h-4 w-4" />
                      <AlertTitle>Cette analyse demande une validation humaine</AlertTitle>
                      <AlertDescription>{logic.selectedSession.reviewReason}</AlertDescription>
                    </Alert>
                  )}

                  {logic.selectedSession.failureReason && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Le pipeline a échoué</AlertTitle>
                      <AlertDescription>{logic.selectedSession.failureReason}</AlertDescription>
                    </Alert>
                  )}

                  <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <ScorePill label="Global" value={logic.selectedSession.overallScore} />
                    <ScorePill
                      label="Couverture plan"
                      value={logic.selectedSession.planCoverageScore}
                    />
                    <ScorePill
                      label="Exécution"
                      value={logic.selectedSession.executionQualityScore}
                    />
                    <ScorePill
                      label="Objections"
                      value={logic.selectedSession.objectionHandlingScore}
                    />
                    <ScorePill
                      label="Écoute / parole"
                      value={logic.selectedSession.listeningRatioScore}
                    />
                    <ScorePill label="Closing" value={logic.selectedSession.closingScore} />
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Bilan IA
                      </h3>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                        {logic.selectedSession.summary || 'Synthèse indisponible pour le moment.'}
                      </p>
                    </div>
                    <div className="grid gap-4">
                      <div>
                        <div className="text-sm font-medium">Points forts</div>
                        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {logic.selectedSession.strengths.map(item => (
                            <li key={item}>• {item}</li>
                          ))}
                          {logic.selectedSession.strengths.length === 0 && <li>• Aucun point fort remonté</li>}
                        </ul>
                      </div>
                      <div>
                        <div className="text-sm font-medium">Axes d’amélioration</div>
                        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {logic.selectedSession.improvements.map(item => (
                            <li key={item}>• {item}</li>
                          ))}
                          {logic.selectedSession.improvements.length === 0 && (
                            <li>• Aucun axe d’amélioration remonté</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <div className="text-sm font-medium">Actions recommandées</div>
                        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {logic.selectedSession.recommendations.map(item => (
                            <li key={item}>• {item}</li>
                          ))}
                          {logic.selectedSession.recommendations.length === 0 && (
                            <li>• Aucune recommandation générée</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          Conversations détectées
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Un même enregistrement peut contenir plusieurs clients: chaque bloc est évalué séparément.
                        </p>
                      </div>
                      <Badge variant="outline">
                        {(logic.selectedSession.conversationEvaluations || []).length} bloc(s)
                      </Badge>
                    </div>
                    <div className="space-y-4">
                      {(logic.selectedSession.conversationEvaluations || []).map(conversation => (
                        <div key={conversation.id} className="rounded-xl border border-border/70 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="font-medium">
                                {conversation.title || `Conversation ${conversation.ordre}`}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {formatSeconds(conversation.startTime)} → {formatSeconds(conversation.endTime)}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={conversation.status === 'FAILED' ? 'destructive' : 'outline'}>
                                {CONVERSATION_LABELS[conversation.status] || conversation.status}
                              </Badge>
                              <Badge variant="secondary">
                                Score {conversation.overallScore ?? 'n/a'}
                              </Badge>
                            </div>
                          </div>

                          {conversation.reviewReason && (
                            <Alert className="mt-4">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle>Bloc à relire</AlertTitle>
                              <AlertDescription>{conversation.reviewReason}</AlertDescription>
                            </Alert>
                          )}

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <ScorePill label="Plan" value={conversation.planCoverageScore} />
                            <ScorePill label="Exécution" value={conversation.executionQualityScore} />
                            <ScorePill label="Closing" value={conversation.closingScore} />
                          </div>

                          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                            {conversation.summary || 'Aucune synthèse disponible pour ce bloc.'}
                          </p>

                          <div className="mt-4 grid gap-4 md:grid-cols-3">
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Forces
                              </div>
                              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                                {(conversation.strengths || []).map(item => (
                                  <li key={item}>• {item}</li>
                                ))}
                                {(conversation.strengths || []).length === 0 && <li>• n/a</li>}
                              </ul>
                            </div>
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                À améliorer
                              </div>
                              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                                {(conversation.improvements || []).map(item => (
                                  <li key={item}>• {item}</li>
                                ))}
                                {(conversation.improvements || []).length === 0 && <li>• n/a</li>}
                              </ul>
                            </div>
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Recos
                              </div>
                              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                                {(conversation.recommendations || []).map(item => (
                                  <li key={item}>• {item}</li>
                                ))}
                                {(conversation.recommendations || []).length === 0 && <li>• n/a</li>}
                              </ul>
                            </div>
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
                          {conversation.readableTranscriptText && conversation.transcriptText && (
                            <details className="mt-3 rounded-lg border border-border/60 p-3 text-sm">
                              <summary className="cursor-pointer text-muted-foreground">
                                Voir le transcript brut Whisper
                              </summary>
                              <Textarea
                                readOnly
                                value={conversation.transcriptText}
                                className="mt-3 min-h-[120px] font-mono text-xs"
                              />
                            </details>
                          )}
                        </div>
                      ))}
                      {(logic.selectedSession.conversationEvaluations || []).length === 0 && (
                        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                          Aucune conversation séparée n’a encore été produite pour cette session.
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Évaluation par étape
                      </h3>
                      <div className="text-xs text-muted-foreground">
                        Modèle: {logic.selectedSession.llmModel || 'n/a'}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {logic.selectedSession.stepEvaluations.map(step => (
                        <div key={step.id} className="rounded-lg border border-border/70 p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="font-medium">
                              {step.ordre}. {step.titre}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{step.coverageStatus}</Badge>
                              <Badge variant="outline">{step.score ?? 'n/a'}</Badge>
                            </div>
                          </div>
                          {step.verbatim && (
                            <div className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
                              {step.verbatim}
                            </div>
                          )}
                          {step.feedback && (
                            <p className="mt-3 text-sm text-muted-foreground">{step.feedback}</p>
                          )}
                          {step.recommendation && (
                            <p className="mt-2 text-sm">{step.recommendation}</p>
                          )}
                        </div>
                      ))}
                      {logic.selectedSession.stepEvaluations.length === 0 && (
                        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                          Les étapes détaillées n’ont pas encore été produites.
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Transcript
                    </h3>
                    <Textarea
                      readOnly
                      value={
                        logic.selectedSession.readableTranscriptText ||
                        logic.selectedSession.transcriptText ||
                        'Transcript indisponible'
                      }
                      className="mt-3 min-h-[220px] font-mono text-xs"
                    />
                    {logic.selectedSession.readableTranscriptText &&
                      logic.selectedSession.transcriptText && (
                        <details className="mt-3 rounded-lg border border-border/60 p-3 text-sm">
                          <summary className="cursor-pointer text-muted-foreground">
                            Voir le transcript brut Whisper
                          </summary>
                          <Textarea
                            readOnly
                            value={logic.selectedSession.transcriptText}
                            className="mt-3 min-h-[180px] font-mono text-xs"
                          />
                        </details>
                      )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Informations session</CardTitle>
                    <CardDescription>
                      Métadonnées utiles pour la revue et le diagnostic.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">S3 key</span>
                      <span className="max-w-[20rem] text-right break-all">
                        {logic.selectedSession.s3KeyOriginal}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">Lancée le</span>
                      <span>{formatDate(logic.selectedSession.launchedAt)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">Traitée le</span>
                      <span>{formatDate(logic.selectedSession.processedAt)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">Confiance</span>
                      <span>{logic.selectedSession.confidenceScore ?? 'n/a'}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">Source identification</span>
                      <span>{logic.selectedSession.identificationSource || 'n/a'}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">Segments Whisper</span>
                      <span>{logic.selectedSession.whisperSegmentsCount ?? 'n/a'}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground">Durée transcript</span>
                      <span>{logic.selectedSession.transcriptDurationSec ?? 'n/a'}</span>
                    </div>
                    {logic.selectedSession.audioUrl && (
                      <audio
                        controls
                        className="mt-4 w-full"
                        src={logic.selectedSession.audioUrl}
                      />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Review humaine</CardTitle>
                    <CardDescription>
                      Flow MVP pour valider le rapport, corriger le commercial ou relancer
                      l’analyse.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="commercial-review-select">Commercial identifié</Label>
                      <Select
                        value={logic.reviewCommercialId}
                        onValueChange={logic.setReviewCommercialId}
                      >
                        <SelectTrigger id="commercial-review-select">
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
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="review-notes">Notes de revue</Label>
                      <Textarea
                        id="review-notes"
                        value={logic.reviewNotes}
                        onChange={event => logic.setReviewNotes(event.target.value)}
                        placeholder="Ajouter un commentaire de validation ou de rejet"
                        className="min-h-[120px]"
                      />
                    </div>

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
                        onClick={() => logic.relaunchSession(logic.selectedSession.id)}
                        disabled={logic.submitting}
                      >
                        <UploadCloud className="mr-2 h-4 w-4" />
                        Relancer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Flow MVP 0: créer un plan libre</CardTitle>
                    <CardDescription>
                      Les étapes sont totalement dynamiques: crée la trame métier que tu veux,
                      courte ou très longue, puis l’IA évaluera cette liste exacte.
                    </CardDescription>
                  </div>
                  {logic.canUseDevPrefill && (
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
                  )}
                </div>
                {logic.canUseDevPrefill && (
                  <p className="text-xs text-muted-foreground">
                    Le préremplissage est seulement une aide de dev: la création normale part
                    d’un plan vierge.
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="plan-name">Nom du plan</Label>
                  <Input
                    id="plan-name"
                    value={logic.planForm.nom}
                    onChange={event =>
                      logic.setPlanForm(current => ({ ...current, nom: event.target.value }))
                    }
                    placeholder="Plan vente terrain énergie, fibre, closing manager..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-description">Description</Label>
                  <Textarea
                    id="plan-description"
                    value={logic.planForm.description}
                    onChange={event =>
                      logic.setPlanForm(current => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Objectif du plan, cible, contexte, variantes utiles"
                    className="min-h-[84px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-prompt">Consigne LLM</Label>
                  <Textarea
                    id="plan-prompt"
                    value={logic.planForm.promptInstructions}
                    onChange={event =>
                      logic.setPlanForm(current => ({
                        ...current,
                        promptInstructions: event.target.value,
                      }))
                    }
                    placeholder="Précisions d’évaluation métier: ton attendu, règles de conformité, critères propres à ce plan..."
                    className="min-h-[96px]"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Étapes libres du plan</Label>
                      <p className="text-xs text-muted-foreground">
                        {logic.planForm.steps.length} ligne(s). Chaque titre rempli devient une
                        étape évaluée, sans section imposée.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={logic.addStep}>
                      Ajouter une étape
                    </Button>
                  </div>
                  {logic.planForm.steps.map((step, index) => (
                    <div key={index} className="rounded-lg border border-border/70 p-4">
                      <div className="grid gap-3 md:grid-cols-[1fr_120px]">
                        <div className="space-y-2">
                          <Label>Titre étape {index + 1}</Label>
                          <Input
                            value={step.titre}
                            onChange={event => logic.updateStep(index, 'titre', event.target.value)}
                            placeholder="Ex: Validation du décideur, pitch tarif, preuve sociale..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Poids</Label>
                          <Input
                            type="number"
                            min="1"
                            max="100"
                            value={step.poids}
                            onChange={event => logic.updateStep(index, 'poids', event.target.value)}
                          />
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={step.description}
                          onChange={event =>
                            logic.updateStep(index, 'description', event.target.value)
                          }
                          placeholder="Ce que le commercial doit réussir dans cette étape."
                          className="min-h-[72px]"
                        />
                      </div>
                      <div className="mt-3 space-y-2">
                        <Label>Signaux attendus</Label>
                        <Textarea
                          value={step.expectedSignals}
                          onChange={event =>
                            logic.updateStep(index, 'expectedSignals', event.target.value)
                          }
                          placeholder="Mots clés, questions, preuves, objections, comportements observables"
                          className="min-h-[72px]"
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => logic.duplicateStep(index)}
                        >
                          Dupliquer
                        </Button>
                        {logic.planForm.steps.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => logic.removeStep(index)}
                          >
                            Retirer cette étape
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  className="w-full"
                  onClick={logic.createPlan}
                  disabled={
                    logic.submitting ||
                    !logic.planForm.nom.trim() ||
                    !logic.planHasNamedStep
                  }
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

            <Card>
              <CardHeader>
                <CardTitle>Plans disponibles</CardTitle>
                <CardDescription>
                  Liste des plans déjà créés, avec leurs versions et leurs étapes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {logic.plans.map(plan => (
                  <div key={plan.id} className="rounded-lg border border-border/70 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-base font-semibold">{plan.nom}</div>
                        {plan.description && (
                          <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                        )}
                      </div>
                      <Badge variant="outline">{plan.status}</Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                      {plan.versions.map(version => (
                        <div key={version.id} className="rounded-md bg-muted/35 p-3">
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
                              <div key={step.id} className="rounded border border-border/60 bg-background px-3 py-3">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="text-sm font-medium">
                                    {step.ordre}. {step.titre}
                                  </div>
                                  <Badge variant="secondary">poids {step.poids}</Badge>
                                </div>
                                {step.description && (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {step.description}
                                  </p>
                                )}
                                {step.expectedSignals && (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {step.expectedSignals}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {logic.plans.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                    Aucun plan de vente n’a encore été créé pour le MVP.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
