import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  CheckCircle2,
  Headphones,
  Lightbulb,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Sparkles,
  Target,
  Volume2,
} from 'lucide-react'
import { CONVERSATION_LABELS } from '../coaching.constants'
import { badgeToneClass, formatSeconds, numberOrZero } from '../coaching.utils'
import { ToneBadge } from './CoachingShared'
import ChatTranscript from './ChatTranscript'
import MiniScore from './MiniScore'
import PlanPipelineTable from './PlanPipelineTable'

const VERBATIM_BUDGET = 4

/**
 * Detail panel for a single candidate window. Renders header (status + range + play),
 * a compact score row, harmonised signal cards, key moments, verbatims and the
 * chat-style transcript.
 *
 * @param {Object} props
 * @param {Object|null} props.conversation
 * @param {Array} [props.sessionKeyMoments]            - global key moments used to filter conv-bound ones
 * @param {boolean} props.audioAvailable
 * @param {string|null} props.playingRangeId
 * @param {boolean} props.isAudioPlaying
 * @param {(id: string, start: number, end: number|null) => void} props.onToggleRange
 */
function ConversationDetail({
  conversation,
  sessionKeyMoments,
  audioAvailable,
  playingRangeId,
  isAudioPlaying,
  onToggleRange,
}) {
  if (!conversation) {
    return (
      <Card className="border-border/70">
        <CardContent className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
          Sélectionnez une fenêtre candidate dans la liste pour afficher son analyse détaillée.
        </CardContent>
      </Card>
    )
  }

  const conversationRangeId = `conversation-${conversation.id}`
  const isPlayingConv = isAudioPlaying && playingRangeId === conversationRangeId
  const canPlayConv =
    audioAvailable && conversation.startTime !== null && conversation.startTime !== undefined
  const keyMoments = filterMomentsForConversation(sessionKeyMoments, conversation)
  const transcript = conversation.readableTranscriptText || conversation.transcriptText || ''
  const verbatims = collectVerbatims(conversation, keyMoments).slice(0, VERBATIM_BUDGET)

  const strengths = (conversation.strengths || []).filter(Boolean).slice(0, 3)
  const improvements = (conversation.improvements || []).filter(Boolean).slice(0, 3)
  const recommendations = (conversation.recommendations || []).filter(Boolean).slice(0, 3)
  const criterionEvidences = (conversation.criterionEvidences || []).slice(0, 8)

  return (
    <div className="space-y-5">
      <Card className="border-primary/25 bg-primary/4">
        <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <ToneBadge status="conversation">Fenêtre candidate {conversation.ordre}</ToneBadge>
              <ToneBadge status={conversation.status}>
                {CONVERSATION_LABELS[conversation.status] || conversation.status}
              </ToneBadge>
              {isPlayingConv ? <ToneBadge status="PROCESSING">En écoute</ToneBadge> : null}
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatSeconds(conversation.startTime)} → {formatSeconds(conversation.endTime)}
              </span>
            </div>
            <CardTitle className="text-xl">
              {conversation.title || `Fenêtre candidate ${conversation.ordre}`}
            </CardTitle>
            {conversation.summary ? (
              <p className="text-sm leading-6 text-muted-foreground">{conversation.summary}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="flex flex-col items-end">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Score global
              </span>
              <span className="text-2xl font-semibold tabular-nums leading-none">
                {numberOrZero(conversation.overallScore)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">/100</span>
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant={isPlayingConv ? 'default' : 'outline'}
              onClick={() =>
                onToggleRange(conversationRangeId, conversation.startTime, conversation.endTime)
              }
              disabled={!canPlayConv}
            >
              {isPlayingConv ? (
                <PauseCircle className="mr-2 h-4 w-4" />
              ) : (
                <PlayCircle className="mr-2 h-4 w-4" />
              )}
              {isPlayingConv ? 'Pause' : 'Écouter fenêtre'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Détail des scores
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
              <MiniScore label="Global" value={conversation.overallScore} tone="primary" strong />
              <MiniScore label="Plan" value={conversation.planCoverageScore} tone="accent" />
              <MiniScore
                label="Exécution"
                value={conversation.executionQualityScore}
                tone="success"
              />
              <MiniScore
                label="Objections"
                value={conversation.objectionHandlingScore}
                tone="warning"
              />
              <MiniScore label="Écoute" value={conversation.listeningRatioScore} tone="accent" />
              <MiniScore label="Closing" value={conversation.closingScore} tone="warning" />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <SignalCard
              title="Forces"
              icon={CheckCircle2}
              items={strengths}
              tone="success"
              empty="Aucune force nette identifiée."
            />
            <SignalCard
              title="À corriger"
              icon={AlertTriangle}
              items={improvements}
              tone="warning"
              empty="Aucun axe d’amélioration remonté."
            />
            <SignalCard
              title="Actions"
              icon={Lightbulb}
              items={recommendations}
              tone="primary"
              empty="Aucune action générée."
            />
          </div>

          <PlanPipelineTable
            conversation={conversation}
            audioAvailable={audioAvailable}
            playingRangeId={playingRangeId}
            isAudioPlaying={isAudioPlaying}
            onToggleRange={onToggleRange}
            rangeIdPrefix={`dialogue-${conversation.id}`}
          />

          {conversation.usableForScoring === false ? (
            <div className="flex items-start gap-3 rounded-lg border border-chart-5/30 bg-chart-5/10 px-3 py-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-chart-5" />
              <div>
                <div className="font-semibold">Fenêtre non scorable automatiquement</div>
                <p className="mt-1 text-muted-foreground">
                  {conversation.scoreabilityReason ||
                    "La transcription finale n'a pas assez de passages prospect fiables."}
                </p>
              </div>
            </div>
          ) : null}

          {conversation.reviewReason ? (
            <div className="flex items-start gap-3 rounded-lg border border-chart-5/30 bg-chart-5/10 px-3 py-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-chart-5" />
              <div>
                <div className="font-medium">Validation requise</div>
                <p className="mt-0.5 text-muted-foreground">{conversation.reviewReason}</p>
              </div>
            </div>
          ) : null}

          {criterionEvidences.length > 0 ? (
            <EvidencePanel evidences={criterionEvidences} />
          ) : null}
        </CardContent>
      </Card>

      {keyMoments.length > 0 ? (
        <Card className="border-accent/25 bg-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-accent" />
              Moments clés
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {keyMoments.map(moment => {
              const id = `moment-${moment.id}`
              const playing = isAudioPlaying && playingRangeId === id
              const canPlay =
                audioAvailable && moment.startTime !== null && moment.startTime !== undefined
              return (
                <MomentCard
                  key={moment.id}
                  moment={moment}
                  playing={playing}
                  canPlay={canPlay}
                  onPlay={() => onToggleRange(id, moment.startTime, moment.endTime)}
                />
              )
            })}
          </CardContent>
        </Card>
      ) : null}

      {verbatims.length > 0 ? (
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Verbatims exploitables
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {verbatims.map(item => {
              const playing = isAudioPlaying && playingRangeId === item.id
              const canPlay =
                audioAvailable && item.startTime !== null && item.startTime !== undefined
              return (
                <VerbatimRow
                  key={item.id}
                  item={item}
                  playing={playing}
                  canPlay={canPlay}
                  onPlay={() => onToggleRange(item.id, item.startTime, item.endTime)}
                />
              )
            })}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            Transcription finale
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Version nettoyée et validée de cette fenêtre candidate avant toute analyse du plan de vente.
          </p>
        </CardHeader>
        <CardContent>
          <ChatTranscript
            transcript={transcript}
            dialogueTurns={conversation.dialogueTurns || []}
            audioAvailable={audioAvailable}
            playingRangeId={playingRangeId}
            isAudioPlaying={isAudioPlaying}
            onToggleRange={onToggleRange}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function EvidencePanel({ evidences }) {
  const foundCount = evidences.filter(item => item.found).length
  return (
    <div className="rounded-lg border border-border/70 bg-background px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Target className="h-3.5 w-3.5" />
          Pourquoi cette note ?
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {foundCount}/{evidences.length} preuve(s)
        </span>
      </div>
      <ul className="grid gap-2 md:grid-cols-2">
        {evidences.map(evidence => (
          <li
            key={evidence.id || `${evidence.stepOrder}-${evidence.criterionKey}`}
            className={cn(
              'rounded-md border px-2.5 py-2 text-xs',
              evidence.found
                ? 'border-chart-2/25 bg-chart-2/8'
                : 'border-border/70 bg-muted/15'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium">{evidence.criterionLabel}</span>
              <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                {evidence.quality}
              </Badge>
            </div>
            {evidence.verbatim ? (
              <p className="mt-1.5 line-clamp-2 text-muted-foreground">"{evidence.verbatim}"</p>
            ) : (
              <p className="mt-1.5 italic text-muted-foreground">
                Aucune preuve observable.
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SignalCard({ title, icon: Icon, items, tone, empty }) {
  const toneClasses = {
    success: 'border-chart-2/25 bg-chart-2/8',
    warning: 'border-chart-5/25 bg-chart-5/8',
    primary: 'border-primary/25 bg-primary/5',
  }
  const dotClasses = {
    success: 'bg-chart-2',
    warning: 'bg-chart-5',
    primary: 'bg-primary',
  }
  const isEmpty = items.length === 0

  return (
    <div
      className={cn(
        'flex h-full min-h-[140px] flex-col rounded-lg border px-3 py-3 transition-colors',
        isEmpty ? 'border-dashed border-border/70 bg-muted/15' : toneClasses[tone]
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        {Icon ? (
          <span
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md',
              isEmpty ? 'bg-muted text-muted-foreground' : 'bg-background/70'
            )}
          >
            <Icon
              className={cn('h-3.5 w-3.5', isEmpty ? 'text-muted-foreground' : 'text-foreground')}
            />
          </span>
        ) : null}
        <span className={isEmpty ? 'text-muted-foreground' : ''}>{title}</span>
        {!isEmpty ? (
          <Badge
            variant="outline"
            className="ml-auto border-border/60 bg-background/70 px-1.5 py-0 text-[10px] font-semibold tabular-nums"
          >
            {items.length}
          </Badge>
        ) : null}
      </div>
      {isEmpty ? (
        <p className="m-auto text-center text-xs italic leading-5 text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex-1 space-y-1.5 overflow-y-auto pr-1 text-sm leading-5">
          {items.map(item => (
            <li key={item} className="flex gap-2">
              <span className={cn('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', dotClasses[tone])} />
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StepCoverageStrip({ stepScores }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Target className="h-3.5 w-3.5" />
          Couverture des étapes
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {stepScores.length} étape(s)
        </span>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {stepScores.map((step, index) => {
          const score = numberOrZero(step.score)
          const numeric = Number(score)
          const clamped = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0
          const isLow = clamped < 40
          return (
            <li
              key={step.id || step.titre || `step-${index}`}
              className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/15 px-2.5 py-1.5"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-background text-[10px] font-semibold text-muted-foreground">
                {step.ordre || index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs">
                {step.titre || `Étape ${step.ordre || index + 1}`}
              </span>
              <div className="flex w-24 items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', isLow ? 'bg-chart-5' : 'bg-chart-2')}
                    style={{ width: `${clamped}%` }}
                  />
                </div>
                <span className="w-9 text-right text-[11px] font-medium tabular-nums">
                  {clamped}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function MomentCard({ moment, playing, canPlay, onPlay }) {
  return (
    <div
      className={[
        'flex flex-col gap-2 rounded-lg border px-3 py-3 transition-all',
        playing
          ? 'border-primary/45 bg-primary/8 ring-1 ring-primary/15'
          : 'border-border/70 bg-background',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Headphones className="h-4 w-4 text-muted-foreground" />
          <span className="min-w-0 truncate text-sm font-medium">
            {moment.title || moment.type || 'Moment clé'}
          </span>
        </div>
        <Button
          type="button"
          size="icon"
          variant={playing ? 'default' : 'outline'}
          onClick={onPlay}
          disabled={!canPlay}
          aria-label={playing ? 'Mettre en pause' : 'Écouter ce moment'}
          className="h-7 w-7"
        >
          {playing ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <ToneBadge status="moment">{moment.type || 'Moment'}</ToneBadge>
        <span className="font-mono tabular-nums">
          {formatSeconds(moment.startTime)} → {formatSeconds(moment.endTime)}
        </span>
        {moment.importance ? (
          <Badge variant="outline" className={badgeToneClass('primary')}>
            Impact {moment.importance}/100
          </Badge>
        ) : null}
      </div>
      {moment.summary ? (
        <p className="text-sm leading-5 text-muted-foreground">{moment.summary}</p>
      ) : null}
      {moment.verbatim ? (
        <p className="rounded-md bg-muted/35 px-3 py-2 text-sm leading-5">{moment.verbatim}</p>
      ) : null}
    </div>
  )
}

function VerbatimRow({ item, playing, canPlay, onPlay }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border px-3 py-3 transition-all',
        playing
          ? 'border-primary/45 bg-primary/8 ring-1 ring-primary/15'
          : 'border-border/70 bg-background'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ToneBadge status={item.tone}>{item.label}</ToneBadge>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatSeconds(item.startTime)} → {formatSeconds(item.endTime)}
          </span>
        </div>
        <Button
          type="button"
          size="icon"
          variant={playing ? 'default' : 'outline'}
          onClick={onPlay}
          disabled={!canPlay}
          aria-label={playing ? 'Mettre en pause' : 'Écouter ce verbatim'}
          className="h-7 w-7 shrink-0"
        >
          {playing ? <PauseCircle className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <p className="text-sm leading-5">{item.text}</p>
    </div>
  )
}

function filterMomentsForConversation(allMoments, conversation) {
  if (!Array.isArray(allMoments) || allMoments.length === 0) return []
  if (
    conversation.startTime === null ||
    conversation.startTime === undefined ||
    conversation.endTime === null ||
    conversation.endTime === undefined
  ) {
    return []
  }
  return allMoments.filter(moment => {
    if (moment.startTime === null || moment.startTime === undefined) return false
    return moment.startTime >= conversation.startTime && moment.startTime <= conversation.endTime
  })
}

function collectVerbatims(conversation, keyMoments) {
  const out = []
  ;(conversation.strengths || []).slice(0, 2).forEach((text, index) => {
    if (typeof text !== 'string' || !text.trim()) return
    out.push({
      id: `conv-${conversation.id}-strength-${index}`,
      label: 'Force',
      tone: 'success',
      text,
      startTime: conversation.startTime,
      endTime: conversation.endTime,
    })
  })
  ;(conversation.improvements || []).slice(0, 2).forEach((text, index) => {
    if (typeof text !== 'string' || !text.trim()) return
    out.push({
      id: `conv-${conversation.id}-improvement-${index}`,
      label: 'À corriger',
      tone: 'warning',
      text,
      startTime: conversation.startTime,
      endTime: conversation.endTime,
    })
  })
  ;(keyMoments || []).slice(0, 2).forEach(moment => {
    if (!moment.verbatim) return
    out.push({
      id: `moment-${moment.id}-verbatim`,
      label: moment.type || 'Moment',
      tone: 'primary',
      text: moment.verbatim,
      startTime: moment.startTime,
      endTime: moment.endTime,
    })
  })
  return out
}

export default React.memo(ConversationDetail)
