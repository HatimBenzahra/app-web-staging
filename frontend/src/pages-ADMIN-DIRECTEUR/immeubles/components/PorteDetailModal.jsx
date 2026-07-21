import { useMemo, useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DoorOpen, Loader2, Mic, X, Star, GraduationCap, Sparkles } from 'lucide-react'
import { getStatusColor, getStatusLabel } from '@/constants/domain/porte-status'
import { SpeechScoreBar } from '@/pages-ADMIN-DIRECTEUR/ecoutes/EnregistrementComponents'
import { formatDateTimeFr, formatDateFr } from '@/lib/format-date'
import { useRecordingSegmentsByPorte } from '@/hooks/metier/api/portes'
import RecordingSegmentPlayer from '@/components/RecordingSegmentPlayer'
import CoachingService from '@/services/coaching/coaching.service'
import CoachingResultPanel from '@/pages-ADMIN-DIRECTEUR/coaching/CoachingResultPanel'
import { cn } from '@/lib/utils'
import PorteHistoriqueTimeline from './PorteHistoriqueTimeline'

/**
 * Détail d'une porte en modale centrée — même pattern que la modale de la page
 * Enregistrements (Dialog sm:max-w-3xl) pour que l'AudioPlayer ait toute la
 * largeur et que l'UX reste cohérente dans toute l'app.
 */
export default function PorteDetailModal({ door, open, onOpenChange, address = '' }) {
  const { data: segments = [], loading } = useRecordingSegmentsByPorte(door?.porteId)
  const statusUpper = (door?.status || '').toUpperCase()

  const primarySegment = useMemo(() => {
    if (!segments.length) return null
    return segments.reduce((longest, seg) =>
      (seg.durationSec || 0) > (longest.durationSec || 0) ? seg : longest
    )
  }, [segments])

  // Coaching de la porte (analyse la plus récente) + favori.
  const [analysis, setAnalysis] = useState(null)
  const [coachingLoading, setCoachingLoading] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [favori, setFavori] = useState(false)

  const loadCoaching = useCallback(async () => {
    if (!door?.porteId) return
    setCoachingLoading(true)
    const a = await CoachingService.byPorte(door.porteId)
    setAnalysis(a)
    setCoachingLoading(false)
  }, [door?.porteId])

  useEffect(() => {
    if (open && door?.porteId) {
      setFavori(door.coachingFavori ?? false)
      loadCoaching()
    } else {
      setAnalysis(null)
    }
  }, [open, door?.porteId, door?.coachingFavori, loadCoaching])

  const s3Key = primarySegment?.s3KeyOriginal || analysis?.s3KeyOriginal || null
  const launchCoaching = async () => {
    if (!s3Key) return
    setLaunching(true)
    try {
      await CoachingService.launchMany([s3Key])
      await loadCoaching()
    } finally {
      setLaunching(false)
    }
  }
  const toggleFavori = async () => {
    if (!door?.porteId) return
    const next = !favori
    setFavori(next)
    try {
      await CoachingService.setFavori(door.porteId, next)
    } catch {
      setFavori(!next)
    }
  }

  const coachInProgress =
    analysis && ['PENDING', 'TRANSCRIBING', 'ANALYZING'].includes(analysis.status)

  if (!door) return null

  const derniereVisite = formatDateTimeFr(door.lastVisit)
  const rdvDateLabel = formatDateFr(door.rdvDate)
  const rdvLabel = rdvDateLabel
    ? door.rdvTime
      ? `${rdvDateLabel} à ${door.rdvTime}`
      : rdvDateLabel
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b p-6 pb-4">
          <div className="flex flex-wrap items-start gap-2">
            <div className="flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-primary" />
              <DialogTitle className="text-base font-semibold">Porte {door.number}</DialogTitle>
            </div>
            <Badge className={`self-center ${getStatusColor(statusUpper)}`}>
              {getStatusLabel(statusUpper)}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 w-7 shrink-0 p-0"
              onClick={() => onOpenChange?.(false)}
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {door.floorLabel}
            {address ? ` · ${address}` : ''}
            {door.nomPersonnalise ? ` · ${door.nomPersonnalise}` : ''}
          </p>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Dernière visite
              </p>
              <p className="mt-1 text-sm font-medium tabular-nums">{derniereVisite || '-'}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">RDV</p>
              <p className="mt-1 text-sm font-medium tabular-nums">{rdvLabel || '-'}</p>
            </div>
          </div>

          {door.comment && (
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Commentaire
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{door.comment}</p>
            </div>
          )}

          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold">Enregistrement</h4>
              </div>
              {!loading && primarySegment?.speechScore != null && (
                <SpeechScoreBar score={primarySegment.speechScore} />
              )}
            </div>

            {loading ? (
              <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Chargement de l'enregistrement...
              </div>
            ) : segments.length > 0 ? (
              <div className="space-y-2">
                {segments.map(segment => (
                  <RecordingSegmentPlayer key={segment.id} segment={segment} autoLoad />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border/40 bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
                Aucun enregistrement lié à cette porte.
              </div>
            )}
          </div>

          {/* Coaching IA de cet échange */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-indigo-600" />
                <h4 className="text-sm font-semibold">Coaching IA</h4>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleFavori}
                  className={cn(favori && 'border-amber-400 text-amber-600')}
                  aria-label={favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  <Star className={cn('h-4 w-4', favori && 'fill-amber-500 text-amber-500')} />
                  Favori
                </Button>
                {s3Key && !coachInProgress && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={launchCoaching}
                    disabled={launching}
                  >
                    {launching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {analysis ? 'Relancer' : "Lancer l'analyse"}
                  </Button>
                )}
              </div>
            </div>

            {coachingLoading ? (
              <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Chargement du coaching…
              </div>
            ) : coachInProgress ? (
              <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyse en cours…
              </div>
            ) : analysis &&
              (analysis.quality === 'INEXPLOITABLE' ||
                analysis.status === 'FAILED' ||
                typeof analysis.score !== 'number') ? (
              // Pas de coaching exploitable → on affiche juste la raison.
              <div className="rounded-lg border border-border/40 bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                {analysis.status === 'FAILED'
                  ? analysis.error
                    ? `Échec de l'analyse : ${analysis.error}`
                    : "Échec de l'analyse."
                  : 'Échange trop court ou inexploitable — pas de score fiable.'}
              </div>
            ) : analysis ? (
              <CoachingResultPanel
                analysis={analysis}
                showAudio={false}
                showScoreHeader
                showTranscript={false}
              />
            ) : (
              <div className="rounded-lg border border-border/40 bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
                Pas encore de coaching pour cet enregistrement.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-background p-4">
            <PorteHistoriqueTimeline porteId={door.porteId} porteNumero={door.number} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
