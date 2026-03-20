import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import AudioPlayer from '@/components/AudioPlayer'
import { RecordingService } from '@/services/audio'
import { getStatusLabel, getStatusColor } from '@/constants/domain/porte-status'
import { SpeechScoreBar, formatDuration } from './EnregistrementComponents'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  X,
  MessageSquare,
  FileAudio,
  Sparkles,
  Building2,
  Play,
} from 'lucide-react'

export default function RecordingDetailModal({
  open,
  onOpenChange,
  recording,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
  currentIndex,
  totalCount,
  onDownload,
}) {
  const [streamingUrl, setStreamingUrl] = useState(null)
  const [conversationUrl, setConversationUrl] = useState(null)
  const [loadingUrl, setLoadingUrl] = useState(false)
  const [showConversationOnly, setShowConversationOnly] = useState(true)
  const [extractionTriggered, setExtractionTriggered] = useState(false)
  const [extractionProgress, setExtractionProgress] = useState(null)
  const [extractionError, setExtractionError] = useState(false)
  const [extractionLoading, setExtractionLoading] = useState(false)
  const [segments, setSegments] = useState([])
  const [loadingSegments, setLoadingSegments] = useState(false)
  const wavesurferRef = useRef(null)

  useEffect(() => {
    if (!recording?.key || !open) {
      setStreamingUrl(null)
      setConversationUrl(null)
      setShowConversationOnly(true)
      setExtractionTriggered(false)
      setExtractionProgress(null)
      setExtractionError(false)
      setExtractionLoading(false)
      setSegments([])
      return
    }
    let active = true
    setLoadingUrl(true)
    setStreamingUrl(null)
    setConversationUrl(null)
    setExtractionError(false)
    setExtractionLoading(false)
    setExtractionTriggered(false)
    setExtractionProgress(null)

    Promise.all([
      RecordingService.getStreamingUrl(recording.key),
      RecordingService.getConversationStreamingUrl(recording.key),
    ])
      .then(async ([fullUrl, convUrl]) => {
        if (!active) return
        setStreamingUrl(fullUrl)
        setConversationUrl(convUrl)
        setShowConversationOnly(!!convUrl)
        setLoadingUrl(false)

        if (!convUrl) {
          try {
            const progress = await RecordingService.getExtractionProgress(recording.key)
            if (!active) return
            if (progress) {
              setExtractionTriggered(true)
              setExtractionProgress(progress)
            }
          } catch {
            // Silently ignore — button will be shown
          }
        }
      })
      .catch(() => {
        if (active) setLoadingUrl(false)
      })

    return () => {
      active = false
    }
  }, [recording?.key, open])

  const handleExtractConversation = useCallback(async () => {
    if (!recording?.key || extractionTriggered || extractionLoading) return

    setExtractionLoading(true)
    setExtractionError(false)

    try {
      const started = await RecordingService.triggerConversationExtraction(recording.key)

      if (started) {
        setExtractionTriggered(true)
      } else {
        const progress = await RecordingService.getExtractionProgress(recording.key)
        if (progress) {
          setExtractionTriggered(true)
          setExtractionProgress(progress)
        } else {
          const convUrl = await RecordingService.getConversationStreamingUrl(recording.key)
          if (convUrl) {
            setConversationUrl(convUrl)
            setShowConversationOnly(true)
          }
        }
      }
    } catch (error) {
      console.error('Failed to trigger conversation extraction', error)
      setExtractionError(true)
    } finally {
      setExtractionLoading(false)
    }
  }, [recording?.key, extractionTriggered, extractionLoading])

  useEffect(() => {
    if (!extractionTriggered || !recording?.key || !open || conversationUrl) return

    let active = true
    let timerId

    const poll = async () => {
      if (!active) return

      if (document.visibilityState !== 'visible') {
        timerId = setTimeout(poll, 2000)
        return
      }

      try {
        const progress = await RecordingService.getExtractionProgress(recording.key)
        if (!active) return

        if (progress) {
          setExtractionProgress(progress)

          if (progress.step === 'error') {
            setExtractionTriggered(false)
            setExtractionProgress(null)
            setExtractionError(true)
            return
          }

          if (progress.step === 'done') {
            const convUrl = await RecordingService.getConversationStreamingUrl(recording.key)
            if (!active) return
            if (convUrl) {
              setConversationUrl(convUrl)
              setShowConversationOnly(true)
            } else {
              setExtractionError(true)
            }
            setExtractionTriggered(false)
            setExtractionProgress(null)
            return
          }
        } else {
          const convUrl = await RecordingService.getConversationStreamingUrl(recording.key)
          if (!active) return
          if (convUrl) {
            setConversationUrl(convUrl)
            setShowConversationOnly(true)
            setExtractionTriggered(false)
            setExtractionProgress(null)
            return
          }
        }
      } catch {
        // Network error — silently retry on next tick
      }

      if (active) timerId = setTimeout(poll, 2000)
    }

    timerId = setTimeout(poll, 2000)

    return () => {
      active = false
      clearTimeout(timerId)
    }
  }, [extractionTriggered, recording?.key, open, conversationUrl])

  useEffect(() => {
    if (!recording?.key || !open) return
    let active = true
    setLoadingSegments(true)
    RecordingService.getSegmentsByKey(recording.key)
      .then(data => {
        if (active) setSegments(data)
      })
      .finally(() => {
        if (active) setLoadingSegments(false)
      })
    return () => {
      active = false
    }
  }, [recording?.key, open])

  const handleSegmentSeek = useCallback(startTime => {
    const ws = wavesurferRef.current
    if (!ws) return
    const dur = ws.getDuration()
    if (dur > 0) {
      ws.seekTo(startTime / dur)
      ws.play()
    }
  }, [])

  const activeUrl = showConversationOnly && conversationUrl ? conversationUrl : streamingUrl

  if (!recording) return null

  const userName =
    recording.userName ||
    `${recording.userPrenom || ''} ${recording.userNom || ''}`.trim() ||
    'Utilisateur inconnu'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-start gap-2 flex-wrap">
            <DialogTitle className="text-base font-semibold truncate max-w-xs sm:max-w-sm flex-1">
              {recording.filename}
            </DialogTitle>
            <Badge
              variant={recording.userType === 'manager' ? 'secondary' : 'outline'}
              className="text-[10px] px-1.5 py-0 h-5 shrink-0 self-center"
            >
              {recording.userType === 'manager' ? 'Manager' : 'Commercial'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0 ml-auto"
              onClick={() => onOpenChange?.(false)}
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {userName}
            {recording.date && (
              <span className="ml-2 text-muted-foreground/60">
                · {recording.date} {recording.time && `à ${recording.time}`}
              </span>
            )}
          </p>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4 flex-1">
          {loadingUrl && (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Préparation de la lecture...</span>
            </div>
          )}
          {!loadingUrl && activeUrl && (
            <>
              {conversationUrl ? (
                <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 w-fit animate-in fade-in duration-300">
                  <button
                    onClick={() => setShowConversationOnly(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                      showConversationOnly
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Conversation
                  </button>
                  <button
                    onClick={() => setShowConversationOnly(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                      !showConversationOnly
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <FileAudio className="w-3.5 h-3.5" />
                    Audio complet
                  </button>
                </div>
              ) : extractionTriggered ? (
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/10 animate-in fade-in duration-300">
                  <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground">
                      {!extractionProgress && 'Extraction de la conversation...'}
                      {extractionProgress?.step === 'downloading' && "Téléchargement de l'audio..."}
                      {extractionProgress?.step === 'transcribing' && 'Analyse de la parole...'}
                      {extractionProgress?.step === 'cutting' && 'Découpage audio...'}
                      {extractionProgress?.step === 'uploading' && 'Enregistrement...'}
                    </span>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: extractionProgress
                            ? `${(extractionProgress.current / extractionProgress.total) * 100}%`
                            : '5%',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : extractionError ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/10 animate-in fade-in duration-300">
                  <span className="text-xs text-muted-foreground">
                    L'extraction a échoué. Le service de transcription est peut-être temporairement
                    indisponible.
                  </span>
                  <button
                    type="button"
                    onClick={handleExtractConversation}
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors shrink-0 ml-2"
                  >
                    Réessayer
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleExtractConversation}
                  disabled={extractionLoading}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/30 active:scale-[0.98] transition-all duration-200 text-xs font-medium text-primary disabled:opacity-60 disabled:cursor-not-allowed group"
                >
                  {extractionLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 group-hover:scale-110 transition-transform duration-200" />
                  )}
                  {extractionLoading ? 'Lancement...' : 'Extraire la conversation'}
                </button>
              )}
              <AudioPlayer
                key={showConversationOnly ? 'conv' : 'full'}
                src={activeUrl}
                title={recording.filename}
                onDownload={() => onDownload?.(recording)}
                onWavesurferReady={ws => {
                  wavesurferRef.current = ws
                }}
              />
            </>
          )}
          {!loadingUrl && !activeUrl && (
            <div className="flex items-center justify-center py-10">
              <p className="text-sm text-muted-foreground text-center">
                L'URL de streaming n'est pas disponible pour cet enregistrement.
              </p>
            </div>
          )}

          {!loadingSegments && segments.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Segments par porte</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 ml-auto">
                  {segments.length}
                </Badge>
              </div>
              <div className="divide-y max-h-56 overflow-y-auto">
                {segments.map(seg => (
                  <button
                    type="button"
                    key={seg.id}
                    onClick={() => handleSegmentSeek(seg.startTime)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-primary/5 cursor-pointer transition-colors group w-full text-left"
                  >
                    <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Play className="w-3 h-3" />
                    </div>
                    <div className="flex-shrink-0 w-20">
                      <span className="text-xs font-mono tabular-nums text-muted-foreground">
                        {formatDuration(seg.startTime)} → {formatDuration(seg.endTime)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium">Porte {seg.porteNumero}</span>
                        <span className="text-[10px] text-muted-foreground">
                          Ét. {seg.porteEtage}
                        </span>
                        {seg.statut && (
                          <Badge
                            className={`text-[10px] px-1.5 py-0 h-4 ${getStatusColor(seg.statut)}`}
                          >
                            {getStatusLabel(seg.statut)}
                          </Badge>
                        )}
                      </div>
                      {seg.transcription && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {seg.transcription}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {seg.speechScore != null && <SpeechScoreBar score={seg.speechScore} />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {loadingSegments && (
            <div className="flex items-center gap-2 justify-center py-3 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Chargement des segments...</span>
            </div>
          )}

          <div className="grid w-fit grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t mx-auto justify-items-center">
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Taille
              </p>
              <p className="text-sm font-medium">{recording.duration || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Date
              </p>
              <p className="text-sm font-medium">{recording.date || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Heure
              </p>
              <p className="text-sm font-medium">{recording.time || '—'}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t px-6 py-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevious}
              disabled={!hasPrevious}
              className="h-8 w-8 p-0"
              aria-label="Enregistrement précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums px-1">
              {(currentIndex ?? 0) + 1} / {totalCount ?? 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onNext}
              disabled={!hasNext}
              className="h-8 w-8 p-0"
              aria-label="Enregistrement suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownload?.(recording)}
            className="gap-1.5"
          >
            <Download className="w-4 h-4" />
            Télécharger
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
