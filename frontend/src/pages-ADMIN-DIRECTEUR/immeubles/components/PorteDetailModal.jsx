import { useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DoorOpen, Loader2, Mic, X } from 'lucide-react'
import { getStatusColor, getStatusLabel } from '@/constants/domain/porte-status'
import { SpeechScoreBar } from '@/pages-ADMIN-DIRECTEUR/ecoutes/EnregistrementComponents'
import { formatDateTimeFr, formatDateFr } from '@/lib/format-date'
import { useRecordingSegmentsByPorte } from '@/hooks/metier/api/portes'
import RecordingSegmentPlayer from '@/components/RecordingSegmentPlayer'
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
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
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

          <div className="rounded-xl border border-border/60 bg-background p-4">
            <PorteHistoriqueTimeline porteId={door.porteId} porteNumero={door.number} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
