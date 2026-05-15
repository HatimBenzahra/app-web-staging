import React from 'react'
import { Link } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import AudioPlayer from '@/components/AudioPlayer'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  FileText,
  Headphones,
  ListChecks,
  Loader2,
  MessageSquare,
  Mic,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'
import {
  CONVERSATION_LABELS,
  QUEUE_LABELS,
  REVIEW_LABELS,
  STATUS_LABELS,
} from '../coaching.constants'
import {
  badgeToneClass,
  buildSessionExcerpts,
  formatDate,
  formatDuration,
  formatSeconds,
  formatScoreValue,
  formatWait,
  numberOrZero,
} from '../coaching.utils'
import {
  CompactScore,
  FieldBlock,
  InfoLine,
  InlineEmptyState,
  SignalBlock,
  ToneBadge,
} from './CoachingShared'

const AUDIO_TIME_THROTTLE_MS = 200

export default function SessionReviewView({ logic }) {
  const session = logic.selectedSession
  const waveSurferRef = React.useRef(null)
  const waveSurferCleanupRef = React.useRef([])
  const audioCurrentTimeRef = React.useRef(0)
  const lastAudioSyncRef = React.useRef(0)
  const [activeExcerptId, setActiveExcerptId] = React.useState(null)
  const [playingExcerptId, setPlayingExcerptId] = React.useState(null)
  const [isAudioPlaying, setIsAudioPlaying] = React.useState(false)
  const [audioCurrentTime, setAudioCurrentTimeState] = React.useState(0)
  const [detailTab, setDetailTab] = React.useState('moments')
  const [transcriptMode, setTranscriptMode] = React.useState('readable')
  const [transcriptSearch, setTranscriptSearch] = React.useState('')
  const [technicalOpen, setTechnicalOpen] = React.useState(false)
  const [stepsDialogOpen, setStepsDialogOpen] = React.useState(false)

  const setAudioCurrentTime = React.useCallback((time, { force = false } = {}) => {
    audioCurrentTimeRef.current = time
    const now = performance.now()
    if (force || now - lastAudioSyncRef.current >= AUDIO_TIME_THROTTLE_MS) {
      lastAudioSyncRef.current = now
      setAudioCurrentTimeState(time)
    }
  }, [])

  const excerpts = React.useMemo(() => buildSessionExcerpts(session), [session])
  const activeExcerpt = excerpts.find(excerpt => excerpt.id === activeExcerptId) || excerpts[0]
  const activeExcerptPlaying = isAudioPlaying && activeExcerpt?.id === playingExcerptId
  const activeExcerptProgress = getExcerptProgress(activeExcerpt, audioCurrentTime)
  const readableTranscript = session?.readableTranscriptText || ''
  const rawTranscript = session?.transcriptText || ''
  const transcriptValue =
    transcriptMode === 'readable'
      ? readableTranscript || rawTranscript
      : rawTranscript || readableTranscript

  const cleanupWaveSurferEvents = React.useCallback(() => {
    waveSurferCleanupRef.current.forEach(cleanup => cleanup?.())
    waveSurferCleanupRef.current = []
  }, [])

  const handleWavesurferReady = React.useCallback(
    ws => {
      cleanupWaveSurferEvents()
      waveSurferRef.current = ws
      waveSurferCleanupRef.current = [
        ws.on('timeupdate', time => setAudioCurrentTime(time)),
        ws.on('interaction', time => setAudioCurrentTime(time, { force: true })),
        ws.on('play', () => setIsAudioPlaying(true)),
        ws.on('pause', () => setIsAudioPlaying(false)),
        ws.on('finish', () => {
          setIsAudioPlaying(false)
          setPlayingExcerptId(null)
        }),
      ]
    },
    [cleanupWaveSurferEvents, setAudioCurrentTime]
  )

  React.useEffect(() => cleanupWaveSurferEvents, [cleanupWaveSurferEvents])

  const pauseAudio = React.useCallback(() => {
    waveSurferRef.current?.pause()
    setIsAudioPlaying(false)
  }, [])

  const playExcerpt = React.useCallback(
    excerpt => {
      if (!excerpt || excerpt.startTime === null || excerpt.startTime === undefined) return
      setActiveExcerptId(excerpt.id)
      const startTime = Math.max(0, Number(excerpt.startTime) || 0)
      setAudioCurrentTime(startTime, { force: true })
      if (!waveSurferRef.current) {
        setPlayingExcerptId(null)
        setIsAudioPlaying(false)
        return
      }
      waveSurferRef.current.setTime(startTime)
      setPlayingExcerptId(excerpt.id)
      setIsAudioPlaying(true)
      void Promise.resolve(waveSurferRef.current.play()).catch(() => {
        setIsAudioPlaying(false)
        setPlayingExcerptId(null)
      })
    },
    [setAudioCurrentTime]
  )

  const toggleExcerptPlayback = React.useCallback(
    excerpt => {
      if (!excerpt) return
      if (isAudioPlaying && playingExcerptId === excerpt.id) {
        pauseAudio()
        return
      }
      playExcerpt(excerpt)
    },
    [isAudioPlaying, pauseAudio, playExcerpt, playingExcerptId]
  )

  React.useEffect(() => {
    setActiveExcerptId(null)
    setPlayingExcerptId(null)
    setIsAudioPlaying(false)
    setAudioCurrentTime(0, { force: true })
  }, [session?.id, setAudioCurrentTime])

  React.useEffect(() => {
    if (!activeExcerptId && excerpts.length > 0) setActiveExcerptId(excerpts[0].id)
  }, [activeExcerptId, excerpts])

  React.useEffect(() => {
    const current = excerpts.find(excerpt => {
      if (excerpt.startTime === null || excerpt.startTime === undefined) return false
      if (excerpt.endTime === null || excerpt.endTime === undefined) return false
      return audioCurrentTime >= excerpt.startTime && audioCurrentTime <= excerpt.endTime
    })
    if (current && current.id !== activeExcerptId) setActiveExcerptId(current.id)
  }, [activeExcerptId, audioCurrentTime, excerpts])

  React.useEffect(() => {
    const playingExcerpt = excerpts.find(excerpt => excerpt.id === playingExcerptId)
    if (!isAudioPlaying || !playingExcerpt || playingExcerpt.endTime === null) return
    if (audioCurrentTime < playingExcerpt.endTime - 0.05) return
    if (audioCurrentTime <= (playingExcerpt.startTime || 0) + 0.15) return
    waveSurferRef.current?.pause()
    waveSurferRef.current?.setTime(playingExcerpt.endTime)
    setAudioCurrentTime(playingExcerpt.endTime, { force: true })
    setIsAudioPlaying(false)
    setPlayingExcerptId(null)
  }, [audioCurrentTime, excerpts, isAudioPlaying, playingExcerptId, setAudioCurrentTime])

  const copyTranscript = React.useCallback(() => {
    if (transcriptValue) void navigator.clipboard?.writeText(transcriptValue)
  }, [transcriptValue])

  const copyExcerpt = React.useCallback(() => {
    if (activeExcerpt?.verbatim) void navigator.clipboard?.writeText(activeExcerpt.verbatim)
  }, [activeExcerpt])

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

  const treatment = getSessionDetailTreatment(session)

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-5 py-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" asChild>
                <Link to="/coaching/sessions">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour aux analyses
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={logic.refreshAll}
                disabled={logic.submitting}
              >
                <RefreshCw
                  className={['mr-2 h-4 w-4', logic.submitting ? 'animate-spin' : ''].join(' ')}
                />
                Actualiser
              </Button>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-tight">Analyse #{session.id}</h2>
                <ToneBadge status={session.status}>
                  {STATUS_LABELS[session.status] || session.status}
                </ToneBadge>
                <ToneBadge status={session.reviewStatus}>
                  {REVIEW_LABELS[session.reviewStatus] || session.reviewStatus}
                </ToneBadge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {session.commercialNom || 'Commercial inconnu'} ·{' '}
                {session.salesPlanNom || 'Plan non trouvé'} ·{' '}
                {formatDate(session.processedAt || session.launchedAt)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[520px]">
            <CompactScore label="Global" value={session.overallScore} strong tone="primary" />
            <CompactScore label="Plan" value={session.planCoverageScore} tone="accent" />
            <CompactScore label="Exécution" value={session.executionQualityScore} tone="success" />
            <CompactScore label="Closing" value={session.closingScore} tone="warning" />
          </div>
        </div>
      </div>

      {session.reviewReason ? (
        <Alert className="border-chart-5/30 bg-chart-5/10">
          <Bot className="h-4 w-4" />
          <AlertTitle>Validation humaine requise</AlertTitle>
          <AlertDescription>{session.reviewReason}</AlertDescription>
        </Alert>
      ) : null}

      {treatment.active ? (
        <Alert className="border-accent/35 bg-accent/10">
          {treatment.kind === 'queued' ? (
            <Clock className="h-4 w-4" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          <AlertTitle>{treatment.title}</AlertTitle>
          <AlertDescription>{treatment.description}</AlertDescription>
        </Alert>
      ) : null}

      {session.failureReason ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Le pipeline a échoué</AlertTitle>
          <AlertDescription>{session.failureReason}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-6">
        <Card className="border-accent/25 bg-accent/5">
          <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Headphones className="h-4 w-4" />
                Preuves terrain
              </div>
              <CardTitle className="text-xl">Écouter, lire, décider</CardTitle>
              <CardDescription>
                Les passages exploités par l’analyse sont regroupés avec leur verbatim et leur
                position dans l’enregistrement.
              </CardDescription>
            </div>
            <ToneBadge status="conversation">{excerpts.length} extraits exploitables</ToneBadge>
          </CardHeader>
          <CardContent className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.52fr)]">
            <div className="space-y-4">
              {session.audioUrl ? (
                <AudioPlayer
                  src={session.audioUrl}
                  title={`Enregistrement · ${session.commercialNom || 'Commercial inconnu'}`}
                  onWavesurferReady={handleWavesurferReady}
                />
              ) : (
                <InlineEmptyState
                  text="Aucun lien audio signé disponible pour cette session."
                  compact
                />
              )}

              <div
                className={[
                  'rounded-lg border px-4 py-4 transition-colors',
                  activeExcerptPlaying
                    ? 'border-primary/40 bg-primary/8'
                    : 'border-border/70 bg-muted/20',
                ].join(' ')}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <ToneBadge status={activeExcerpt?.source || 'neutral'}>
                        {activeExcerpt?.kindLabel || 'Extrait'}
                      </ToneBadge>
                      {activeExcerptPlaying ? (
                        <ToneBadge status="PROCESSING">En écoute</ToneBadge>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {formatSeconds(activeExcerpt?.startTime)} →{' '}
                        {formatSeconds(activeExcerpt?.endTime)}
                      </span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold">
                      {activeExcerpt?.title || 'Aucun extrait sélectionné'}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={activeExcerptPlaying ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleExcerptPlayback(activeExcerpt)}
                      disabled={
                        !session.audioUrl ||
                        !activeExcerpt ||
                        activeExcerpt.startTime === null ||
                        activeExcerpt.startTime === undefined
                      }
                    >
                      {activeExcerptPlaying ? (
                        <PauseCircle className="mr-2 h-4 w-4" />
                      ) : (
                        <PlayCircle className="mr-2 h-4 w-4" />
                      )}
                      {activeExcerptPlaying ? 'Pause' : 'Écouter'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={copyExcerpt}
                      disabled={!activeExcerpt?.verbatim}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copier
                    </Button>
                  </div>
                </div>
                {activeExcerpt?.summary ? (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {activeExcerpt.summary}
                  </p>
                ) : null}
                {activeExcerpt?.startTime !== null &&
                activeExcerpt?.startTime !== undefined &&
                activeExcerpt?.endTime !== null &&
                activeExcerpt?.endTime !== undefined ? (
                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Position dans l’extrait</span>
                      <span className="tabular-nums">{Math.round(activeExcerptProgress)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-background">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${activeExcerptProgress}%` }}
                      />
                    </div>
                  </div>
                ) : null}
                {activeExcerpt?.verbatim ? (
                  <div className="mt-4 max-h-56 overflow-y-auto rounded-lg bg-background px-4 py-3 text-sm leading-6">
                    {activeExcerpt.verbatim}
                  </div>
                ) : (
                  <InlineEmptyState
                    text="Aucun verbatim précis disponible pour cet extrait."
                    compact
                  />
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <SignalBlock
                  title="Forces"
                  items={(session.strengths || []).slice(0, 3)}
                  empty="Aucune force nette"
                  tone="success"
                />
                <SignalBlock
                  title="À corriger"
                  items={(session.improvements || []).slice(0, 3)}
                  empty="Aucun axe remonté"
                  tone="warning"
                />
                <SignalBlock
                  title="Actions"
                  items={(session.recommendations || []).slice(0, 3)}
                  empty="Aucune action générée"
                  tone="primary"
                />
              </div>
            </div>

            <EvidenceList
              excerpts={excerpts}
              activeExcerptId={activeExcerptId}
              playingExcerptId={playingExcerptId}
              isAudioPlaying={isAudioPlaying}
              onSelect={setActiveExcerptId}
              onPlay={toggleExcerptPlayback}
              audioAvailable={Boolean(session.audioUrl)}
            />
          </CardContent>
        </Card>

        <Card className="border-primary/25 bg-primary/5">
          <CardHeader>
            <CardTitle>Décision directeur</CardTitle>
            <CardDescription>
              Synthèse, correction éventuelle et validation après écoute des preuves.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-4">
              <div className="text-sm font-medium">Synthèse IA</div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {session.summary || 'Synthèse indisponible pour le moment.'}
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <CompactScore
                  label="Objections"
                  value={session.objectionHandlingScore}
                  tone="warning"
                />
                <CompactScore
                  label="Écoute / parole"
                  value={session.listeningRatioScore}
                  tone="accent"
                />
              </div>

              <div className="rounded-lg border border-border/70 bg-background/80 px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Contexte de l'appel
                </div>
                <div className="mt-3 space-y-3 text-sm">
                  <InfoLine label="Commercial" value={session.commercialNom || 'Non renseigné'} />
                  <InfoLine label="Plan" value={session.salesPlanNom || 'Non renseigné'} />
                </div>
              </div>
            </div>

            <div className="xl:col-span-2">
              <FieldBlock label="Note de revue">
                <Textarea
                  value={logic.reviewNotes}
                  onChange={event => logic.setReviewNotes(event.target.value)}
                  placeholder="Pourquoi valider, rejeter ou relancer cette analyse ?"
                  className="min-h-[110px]"
                />
              </FieldBlock>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 xl:col-span-2">
              <Button
                type="button"
                onClick={() => logic.reviewSession('APPROVE')}
                disabled={logic.submitting}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Valider le rapport
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

        <Card className="border-border/70 bg-card">
          <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle>Lecture détaillée</CardTitle>
              <CardDescription>
                Moments clés, conversations et étapes restent accessibles sans saturer la vue.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ['moments', 'Moments'],
                ['conversations', 'Conversations'],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={detailTab === value ? 'default' : 'outline'}
                  onClick={() => setDetailTab(value)}
                >
                  {label}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setStepsDialogOpen(true)}
              >
                <ListChecks className="mr-2 h-4 w-4" />
                Voir les étapes
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {detailTab === 'moments' ? (
              <DetailMoments
                moments={session.keyMoments || []}
                onPlay={moment =>
                  toggleExcerptPlayback(
                    excerpts.find(item => item.source === 'moment' && item.sourceId === moment.id)
                  )
                }
                audioAvailable={Boolean(session.audioUrl)}
                activeExcerptId={activeExcerptId}
                playingExcerptId={playingExcerptId}
                isAudioPlaying={isAudioPlaying}
              />
            ) : null}
            {detailTab === 'conversations' ? (
              <DetailConversations
                conversations={session.conversationEvaluations || []}
                onPlay={conversation =>
                  toggleExcerptPlayback(
                    excerpts.find(
                      item => item.source === 'conversation' && item.sourceId === conversation.id
                    )
                  )
                }
                audioAvailable={Boolean(session.audioUrl)}
                activeExcerptId={activeExcerptId}
                playingExcerptId={playingExcerptId}
                isAudioPlaying={isAudioPlaying}
              />
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-accent/25 bg-accent/5">
          <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle>Transcription</CardTitle>
              <CardDescription>
                Lecture complète avec recherche, version lisible et copie.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <TranscriptReader
              transcriptValue={transcriptValue}
              transcriptMode={transcriptMode}
              setTranscriptMode={setTranscriptMode}
              transcriptSearch={transcriptSearch}
              setTranscriptSearch={setTranscriptSearch}
              copyTranscript={copyTranscript}
              hasReadable={Boolean(readableTranscript)}
              hasRaw={Boolean(rawTranscript)}
            />
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="gap-3">
            <button
              type="button"
              className="flex items-center justify-between gap-3 text-left"
              onClick={() => setTechnicalOpen(value => !value)}
            >
              <span>
                <CardTitle>Détails de traitement</CardTitle>
                <CardDescription className="mt-1">
                  Suivi de l’analyse et informations de contrôle.
                </CardDescription>
              </span>
              {technicalOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          </CardHeader>
          {technicalOpen ? (
            <CardContent className="space-y-5">
              <div className="space-y-3 text-sm">
                <InfoLine label="Fichier source" value={session.s3KeyOriginal} breakAll />
                <InfoLine label="Lancée le" value={formatDate(session.launchedAt)} />
                <InfoLine label="Traitée le" value={formatDate(session.processedAt)} />
                <InfoLine label="Confiance" value={numberOrZero(session.confidenceScore)} />
                <InfoLine
                  label="Source d’identification"
                  value={session.identificationSource || 'Non renseignée'}
                />
                <InfoLine
                  label="Segments audio"
                  value={numberOrZero(session.whisperSegmentsCount)}
                />
                <InfoLine
                  label="Durée de transcription"
                  value={formatDuration(numberOrZero(session.transcriptDurationSec))}
                />
              </div>

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
                      <ToneBadge status={step.status}>{step.status}</ToneBadge>
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
          ) : null}
        </Card>
      </div>

      <StepsDialog
        open={stepsDialogOpen}
        onOpenChange={setStepsDialogOpen}
        steps={session.stepEvaluations || []}
        onPlay={step =>
          toggleExcerptPlayback(
            excerpts.find(item => item.source === 'step' && item.sourceId === step.id)
          )
        }
        audioAvailable={Boolean(session.audioUrl)}
        activeExcerptId={activeExcerptId}
        playingExcerptId={playingExcerptId}
        isAudioPlaying={isAudioPlaying}
      />
    </div>
  )
}

function getSessionDetailTreatment(session) {
  const jobStatus = session.analysisJob?.status

  if (session.status === 'COMPLETED' || session.status === 'NEEDS_REVIEW') {
    return {
      active: false,
      kind: 'done',
      title: '',
      description: '',
    }
  }

  if (jobStatus === 'QUEUED' || session.status === 'PENDING') {
    return {
      active: true,
      kind: 'queued',
      title: 'Analyse en attente',
      description:
        'La demande est bien lancée. Le rapport apparaîtra ici dès que le traitement commence.',
    }
  }

  if (jobStatus === 'PROCESSING' || session.status === 'PROCESSING') {
    return {
      active: true,
      kind: 'processing',
      title: 'Analyse en cours',
      description: session.analysisJob?.currentStep
        ? `Étape en cours: ${session.analysisJob.currentStep}.`
        : 'Le rapport est en train de se préparer. Les scores et les extraits vont arriver progressivement.',
    }
  }

  return {
    active: false,
    kind: 'done',
    title: '',
    description: '',
  }
}

function getExcerptProgress(excerpt, currentTime) {
  if (!excerpt || excerpt.startTime === null || excerpt.endTime === null) return 0
  if (excerpt.startTime === undefined || excerpt.endTime === undefined) return 0
  const duration = excerpt.endTime - excerpt.startTime
  if (duration <= 0) return 0
  return Math.max(0, Math.min(100, ((currentTime - excerpt.startTime) / duration) * 100))
}

const EvidenceList = React.memo(function EvidenceList({
  excerpts,
  activeExcerptId,
  playingExcerptId,
  isAudioPlaying,
  onSelect,
  onPlay,
  audioAvailable,
}) {
  if (excerpts.length === 0) {
    return <InlineEmptyState text="Aucun extrait timestampé disponible pour cette analyse." />
  }

  return (
    <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
      {excerpts.map(excerpt => {
        const active = excerpt.id === activeExcerptId
        const playing = isAudioPlaying && excerpt.id === playingExcerptId
        const canPlay =
          audioAvailable && excerpt.startTime !== null && excerpt.startTime !== undefined
        return (
          <button
            key={excerpt.id}
            type="button"
            className={[
              'w-full rounded-lg border px-3 py-3 text-left transition-all',
              playing
                ? 'border-primary/50 bg-primary/10 shadow-sm ring-2 ring-primary/15'
                : active
                  ? 'border-primary/35 bg-primary/6'
                  : 'border-border/70 bg-background hover:bg-muted/35',
            ].join(' ')}
            onClick={() => onSelect(excerpt.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <ToneBadge status={playing ? 'PROCESSING' : excerpt.status || excerpt.source}>
                    {playing ? 'En écoute' : excerpt.kindLabel}
                  </ToneBadge>
                  {playing && excerpt.kindLabel ? (
                    <ToneBadge status={excerpt.status || excerpt.source}>
                      {excerpt.kindLabel}
                    </ToneBadge>
                  ) : null}
                  {excerpt.score !== null && excerpt.score !== undefined ? (
                    <Badge variant="outline" className={badgeToneClass('primary')}>
                      {numberOrZero(excerpt.score)}/100
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-2 line-clamp-2 font-medium">{excerpt.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatSeconds(excerpt.startTime)} → {formatSeconds(excerpt.endTime)}
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                variant={playing ? 'default' : 'outline'}
                disabled={!canPlay}
                onClick={event => {
                  event.stopPropagation()
                  onPlay(excerpt)
                }}
                title={playing ? 'Mettre en pause' : 'Écouter cet extrait'}
                aria-label={playing ? 'Mettre en pause' : 'Écouter cet extrait'}
              >
                {playing ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
              </Button>
            </div>
            {excerpt.summary ? (
              <p
                className={[
                  'mt-2 line-clamp-3 text-sm leading-5',
                  playing ? 'text-foreground' : 'text-muted-foreground',
                ].join(' ')}
              >
                {excerpt.summary}
              </p>
            ) : null}
          </button>
        )
      })}
    </div>
  )
})

function DetailMoments({
  moments,
  onPlay,
  audioAvailable,
  activeExcerptId,
  playingExcerptId,
  isAudioPlaying,
}) {
  if (moments.length === 0) {
    return <InlineEmptyState text="Aucun moment clé généré pour cette analyse." />
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {moments.map(moment => {
        const excerptId = `moment-${moment.id}`
        return (
          <DetailRow
            key={moment.id}
            icon={Headphones}
            title={moment.title}
            meta={`${moment.type} · ${formatSeconds(moment.startTime)} → ${formatSeconds(moment.endTime)}`}
            badge={moment.importance ? `Impact ${moment.importance}/100` : null}
            body={moment.summary}
            verbatim={moment.verbatim}
            onPlay={() => onPlay(moment)}
            canPlay={audioAvailable && moment.startTime !== null && moment.startTime !== undefined}
            active={activeExcerptId === excerptId}
            playing={isAudioPlaying && playingExcerptId === excerptId}
          />
        )
      })}
    </div>
  )
}

function StepsDialog({
  open,
  onOpenChange,
  steps,
  onPlay,
  audioAvailable,
  activeExcerptId,
  playingExcerptId,
  isAudioPlaying,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-full max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border/70 px-6 py-5">
          <DialogTitle>Étapes du plan</DialogTitle>
          <DialogDescription>
            Ce que le commercial a dit, le score associé et la recommandation IA.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-6 py-5">
          {steps.length === 0 ? (
            <InlineEmptyState text="Les étapes détaillées n’ont pas encore été produites." />
          ) : (
            <div className="space-y-3">
              {steps.map(step => {
                const excerptId = `step-${step.id}`
                const playing = isAudioPlaying && playingExcerptId === excerptId
                const active = activeExcerptId === excerptId
                const canPlay =
                  audioAvailable && step.startTime !== null && step.startTime !== undefined
                return (
                  <div
                    key={step.id}
                    className={[
                      'rounded-lg border px-4 py-4 transition-all',
                      playing
                        ? 'border-primary/50 bg-primary/8 ring-2 ring-primary/15'
                        : active
                          ? 'border-primary/35 bg-primary/5'
                          : 'border-border/70 bg-background',
                    ].join(' ')}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                            {step.ordre}
                          </span>
                          <h3 className="font-semibold">{step.titre}</h3>
                          {playing ? <ToneBadge status="PROCESSING">En écoute</ToneBadge> : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <ToneBadge status={step.coverageStatus || 'neutral'}>
                            {step.coverageStatus || 'Non renseigné'}
                          </ToneBadge>
                          <Badge variant="outline" className={badgeToneClass('primary')}>
                            {formatScoreValue(step.score)}
                          </Badge>
                          <span>
                            {formatSeconds(step.startTime)} → {formatSeconds(step.endTime)}
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={playing ? 'default' : 'outline'}
                        onClick={() => onPlay(step)}
                        disabled={!canPlay}
                      >
                        {playing ? (
                          <PauseCircle className="mr-2 h-4 w-4" />
                        ) : (
                          <PlayCircle className="mr-2 h-4 w-4" />
                        )}
                        {playing ? 'Pause' : 'Écouter'}
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                      <div className="rounded-md border border-border/60 bg-muted/25 px-3 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Le commercial a dit
                        </div>
                        <p className="mt-2 max-h-44 overflow-y-auto whitespace-pre-wrap text-sm leading-6">
                          {step.verbatim || 'Aucun verbatim précis disponible pour cette étape.'}
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Feedback IA
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {step.feedback || 'Feedback non renseigné.'}
                          </p>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Recommandation
                          </div>
                          <p className="mt-2 text-sm font-medium">
                            {step.recommendation || 'Aucune recommandation générée.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DetailConversations({
  conversations,
  onPlay,
  audioAvailable,
  activeExcerptId,
  playingExcerptId,
  isAudioPlaying,
}) {
  if (conversations.length === 0) {
    return (
      <InlineEmptyState text="Aucune conversation séparée n’a encore été produite pour cette session." />
    )
  }

  return (
    <div className="space-y-3">
      {conversations.map(conversation => {
        const excerptId = `conversation-${conversation.id}`
        return (
          <DetailRow
            key={conversation.id}
            icon={MessageSquare}
            title={conversation.title || `Conversation ${conversation.ordre}`}
            meta={`${formatSeconds(conversation.startTime)} → ${formatSeconds(conversation.endTime)}`}
            badge={`${CONVERSATION_LABELS[conversation.status] || conversation.status} · Score ${numberOrZero(
              conversation.overallScore
            )}`}
            body={conversation.summary || conversation.reviewReason}
            verbatim={conversation.readableTranscriptText || conversation.transcriptText}
            onPlay={() => onPlay(conversation)}
            canPlay={
              audioAvailable &&
              conversation.startTime !== null &&
              conversation.startTime !== undefined
            }
            active={activeExcerptId === excerptId}
            playing={isAudioPlaying && playingExcerptId === excerptId}
          />
        )
      })}
    </div>
  )
}

const DetailRow = React.memo(function DetailRow({
  icon: Icon,
  title,
  meta,
  badge,
  body,
  verbatim,
  footer,
  onPlay,
  canPlay,
  active,
  playing,
}) {
  return (
    <div
      className={[
        'rounded-lg border px-4 py-4 transition-all',
        playing
          ? 'border-primary/50 bg-primary/8 shadow-sm ring-2 ring-primary/15'
          : active
            ? 'border-primary/35 bg-primary/5'
            : 'border-border/70 bg-background',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {React.createElement(Icon, {
              className: playing ? 'h-4 w-4 text-primary' : 'h-4 w-4 text-muted-foreground',
            })}
            <span className="font-medium">{title}</span>
            {playing ? <ToneBadge status="PROCESSING">En écoute</ToneBadge> : null}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{meta}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge ? (
            <Badge variant="outline" className={badgeToneClass('neutral')}>
              {badge}
            </Badge>
          ) : null}
          <Button
            type="button"
            size="icon"
            variant={playing ? 'default' : 'outline'}
            onClick={onPlay}
            disabled={!canPlay}
            aria-label={playing ? 'Mettre en pause' : 'Écouter cet extrait'}
          >
            {playing ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {body ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p> : null}
      {verbatim ? (
        <div
          className={[
            'mt-3 max-h-44 overflow-y-auto rounded-md px-3 py-2 text-sm leading-6',
            playing ? 'bg-background' : 'bg-muted/35',
          ].join(' ')}
        >
          {verbatim}
        </div>
      ) : null}
      {footer ? <p className="mt-3 text-sm font-medium">{footer}</p> : null}
    </div>
  )
})

const TranscriptReader = React.memo(function TranscriptReader({
  transcriptValue,
  transcriptMode,
  setTranscriptMode,
  transcriptSearch,
  setTranscriptSearch,
  copyTranscript,
  hasReadable,
  hasRaw,
}) {
  const allLines = transcriptValue ? transcriptValue.split('\n').filter(Boolean) : []
  const lines = transcriptValue
    ? transcriptValue
        .split('\n')
        .filter(line =>
          transcriptSearch
            ? line.toLowerCase().includes(transcriptSearch.trim().toLowerCase())
            : true
        )
    : []

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={transcriptMode === 'readable' ? 'default' : 'outline'}
            onClick={() => setTranscriptMode('readable')}
            disabled={!hasReadable && hasRaw}
          >
            <FileText className="mr-2 h-4 w-4" />
            Lisible
          </Button>
          <Button
            type="button"
            size="sm"
            variant={transcriptMode === 'raw' ? 'default' : 'outline'}
            onClick={() => setTranscriptMode('raw')}
            disabled={!hasRaw}
          >
            <Mic className="mr-2 h-4 w-4" />
            Originale
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={copyTranscript}>
            <Copy className="mr-2 h-4 w-4" />
            Copier
          </Button>
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={transcriptSearch}
            onChange={event => setTranscriptSearch(event.target.value)}
            placeholder="Rechercher dans la transcription"
            className="pl-9"
          />
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {lines.length} passage(s) affiché(s) sur {allLines.length}
      </div>

      {!hasReadable && transcriptMode === 'readable' ? (
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertTitle>Version lisible indisponible</AlertTitle>
          <AlertDescription>
            La transcription originale est affichée en attendant une version plus lisible.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="max-h-[560px] overflow-y-auto rounded-lg border border-border/70 bg-background">
        {lines.length > 0 ? (
          <div className="divide-y divide-border/60 text-sm leading-7">
            {lines.map((line, index) => (
              <p key={`${index}-${line.slice(0, 16)}`} className="whitespace-pre-wrap px-4 py-3">
                {line}
              </p>
            ))}
          </div>
        ) : (
          <InlineEmptyState text="Aucun passage ne correspond à cette recherche." compact />
        )}
      </div>
    </div>
  )
})
