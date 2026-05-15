import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertTriangle,
  ListOrdered,
  Loader2,
  PanelLeftOpen,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'
import SessionHeader from './SessionHeader'
import SessionAlerts from './SessionAlerts'
import SessionAudioBar from './SessionAudioBar'
import ConversationsList from './ConversationsList'
import ConversationDetail from './ConversationDetail'
import ContinuousReader from './ContinuousReader'
import RawTranscriptView from './RawTranscriptView'
import StepsDialog from './StepsDialog'
import { FieldBlock } from './CoachingShared'
import { useAudioSync } from './hooks/useAudioSync'

export default function SessionReviewView({ logic }) {
  const session = logic.selectedSession

  const {
    handleWavesurferReady,
    audioCurrentTime,
    isAudioPlaying,
    playingRangeId,
    togglePlayRange,
    resetAudio,
  } = useAudioSync()

  const conversations = React.useMemo(
    () => sortConversations(session?.conversationEvaluations),
    [session?.conversationEvaluations]
  )

  const [viewMode, setViewMode] = React.useState('split')
  const [selectedConversationId, setSelectedConversationId] = React.useState(null)
  const [stepsDialogOpen, setStepsDialogOpen] = React.useState(false)
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  // Reset transient UI state when switching session.
  React.useEffect(() => {
    setSelectedConversationId(null)
    setStepsDialogOpen(false)
    setDrawerOpen(false)
    resetAudio()
  }, [session?.id, resetAudio])

  // Default to first conversation on load.
  React.useEffect(() => {
    if (selectedConversationId === null && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id)
    }
  }, [conversations, selectedConversationId])

  // Compute which conversation contains the current audio timecode.
  const currentTimecodeConversationId = React.useMemo(() => {
    const match = conversations.find(conversation => {
      if (conversation.startTime === null || conversation.startTime === undefined) return false
      if (conversation.endTime === null || conversation.endTime === undefined) return false
      return audioCurrentTime >= conversation.startTime && audioCurrentTime <= conversation.endTime
    })
    return match ? match.id : null
  }, [audioCurrentTime, conversations])

  const selectedConversation = React.useMemo(
    () => conversations.find(conversation => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  )

  const activeRangeInfo = React.useMemo(
    () => buildActiveRangeInfo(playingRangeId, session, conversations),
    [playingRangeId, session, conversations]
  )

  const handleSelectConversation = React.useCallback(conversation => {
    setSelectedConversationId(conversation.id)
    setDrawerOpen(false)
  }, [])

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
      <SessionHeader session={session} onRefresh={logic.refreshAll} submitting={logic.submitting} />

      <SessionAlerts session={session} />

      <SessionAudioBar
        session={session}
        onWavesurferReady={handleWavesurferReady}
        activeRange={activeRangeInfo}
        isAudioPlaying={isAudioPlaying}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenSteps={() => setStepsDialogOpen(true)}
      />

      {viewMode === 'split' ? (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="hidden lg:block">
            <Card className="border-border/70">
              <CardHeader className="gap-1 py-4">
                <CardTitle className="text-base">Conversations</CardTitle>
                <CardDescription className="text-xs">
                  {conversations.length} échange(s) identifié(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ConversationsList
                  conversations={conversations}
                  selectedId={selectedConversationId}
                  currentTimecodeId={currentTimecodeConversationId}
                  isAudioPlaying={isAudioPlaying}
                  onSelect={handleSelectConversation}
                />
              </CardContent>
            </Card>
          </div>

          <div className="lg:hidden">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setDrawerOpen(true)}
            >
              <PanelLeftOpen className="mr-2 h-4 w-4" />
              Voir les {conversations.length} conversations
            </Button>
          </div>

          <ConversationDetail
            conversation={selectedConversation}
            sessionKeyMoments={session.keyMoments || []}
            audioAvailable={Boolean(session.audioUrl)}
            playingRangeId={playingRangeId}
            isAudioPlaying={isAudioPlaying}
            onToggleRange={togglePlayRange}
          />
        </div>
      ) : null}

      {viewMode === 'continuous' ? (
        <ContinuousReader
          conversations={conversations}
          playingRangeId={playingRangeId}
          isAudioPlaying={isAudioPlaying}
          audioAvailable={Boolean(session.audioUrl)}
          onToggleRange={togglePlayRange}
        />
      ) : null}

      {viewMode === 'raw' ? <RawTranscriptView session={session} /> : null}

      <ReviewDecisionCard logic={logic} session={session} />

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-[88vw] sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4" />
              Conversations
            </SheetTitle>
            <SheetDescription>
              {conversations.length} échange(s) identifié(s) sur la session.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <ConversationsList
              conversations={conversations}
              selectedId={selectedConversationId}
              currentTimecodeId={currentTimecodeConversationId}
              isAudioPlaying={isAudioPlaying}
              onSelect={handleSelectConversation}
            />
          </div>
        </SheetContent>
      </Sheet>

      <StepsDialog
        open={stepsDialogOpen}
        onOpenChange={setStepsDialogOpen}
        steps={session.stepEvaluations || []}
        audioAvailable={Boolean(session.audioUrl)}
        playingRangeId={playingRangeId}
        isAudioPlaying={isAudioPlaying}
        onToggleRange={togglePlayRange}
      />
    </div>
  )
}

const ReviewDecisionCard = React.memo(function ReviewDecisionCard({ logic, session }) {
  return (
    <Card className="border-primary/25 bg-primary/5">
      <CardHeader>
        <CardTitle>Décision directeur</CardTitle>
        <CardDescription>
          Synthèse IA, note interne et validation finale du rapport.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-4">
          <div className="text-sm font-medium">Synthèse IA</div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {session.summary || 'Synthèse indisponible pour le moment.'}
          </p>
        </div>

        <FieldBlock label="Note de revue">
          <Textarea
            value={logic.reviewNotes}
            onChange={event => logic.setReviewNotes(event.target.value)}
            placeholder="Pourquoi valider, rejeter ou relancer cette analyse ?"
            className="min-h-[110px]"
          />
        </FieldBlock>

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
  )
})

function sortConversations(conversations) {
  if (!Array.isArray(conversations)) return []
  return [...conversations].sort((a, b) => {
    const aOrder = Number.isFinite(Number(a.ordre)) ? Number(a.ordre) : Number.POSITIVE_INFINITY
    const bOrder = Number.isFinite(Number(b.ordre)) ? Number(b.ordre) : Number.POSITIVE_INFINITY
    if (aOrder !== bOrder) return aOrder - bOrder
    const aStart = a.startTime ?? Number.POSITIVE_INFINITY
    const bStart = b.startTime ?? Number.POSITIVE_INFINITY
    return aStart - bStart
  })
}

function buildActiveRangeInfo(playingRangeId, session, conversations) {
  if (!playingRangeId || !session) return null

  if (playingRangeId.startsWith('conversation-')) {
    const id = Number(playingRangeId.slice('conversation-'.length))
    const conversation = conversations.find(item => item.id === id)
    if (!conversation) return null
    return {
      label: conversation.title || `Conversation ${conversation.ordre}`,
      startTime: conversation.startTime,
      endTime: conversation.endTime,
    }
  }

  if (playingRangeId.startsWith('moment-')) {
    const raw = playingRangeId.slice('moment-'.length)
    const id = Number(raw.endsWith('-verbatim') ? raw.replace('-verbatim', '') : raw)
    const moment = (session.keyMoments || []).find(item => item.id === id)
    if (!moment) return null
    return {
      label: moment.title || moment.type || 'Moment clé',
      startTime: moment.startTime,
      endTime: moment.endTime,
    }
  }

  if (playingRangeId.startsWith('step-')) {
    const id = Number(playingRangeId.slice('step-'.length))
    const step = (session.stepEvaluations || []).find(item => item.id === id)
    if (!step) return null
    return {
      label: step.titre || `Étape ${step.ordre}`,
      startTime: step.startTime,
      endTime: step.endTime,
    }
  }

  if (playingRangeId.startsWith('conv-')) {
    // verbatim derived from conversation strengths/improvements
    const match = playingRangeId.match(/^conv-(\d+)-/)
    if (!match) return null
    const id = Number(match[1])
    const conversation = conversations.find(item => item.id === id)
    if (!conversation) return null
    return {
      label: `Verbatim · Conversation ${conversation.ordre}`,
      startTime: conversation.startTime,
      endTime: conversation.endTime,
    }
  }

  return null
}
