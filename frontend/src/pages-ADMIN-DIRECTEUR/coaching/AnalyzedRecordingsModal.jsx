import { useEffect, useState } from 'react'
import { ChevronRight, Loader2, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import CoachingService from '@/services/coaching/coaching.service'
import CoachingDetail from './CoachingDetail'
import { PorteStatutPill, parseRecordingKey, formatDateTime } from './CoachingComponents'

/**
 * Modal des enregistrements déjà analysés : liste → détail (vue unifiée
 * `CoachingDetail`), avec fil d'ariane « Analysés › … » et bouton retour.
 */
export default function AnalyzedRecordingsModal({ open, onOpenChange }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!open) {
      setSelected(null)
      return
    }
    let active = true
    setLoading(true)
    CoachingService.analyses({ status: 'READY', take: 100 }).then((res) => {
      if (!active) return
      setItems(res.items || [])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {selected ? (
          <CoachingDetail
            analysis={selected}
            backLabel="Analysés"
            onBack={() => setSelected(null)}
            onClose={() => onOpenChange?.(false)}
          />
        ) : (
          <>
            <DialogHeader className="border-b p-5">
              <div className="flex items-center justify-between gap-2">
                <DialogTitle className="text-base">Enregistrements analysés</DialogTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onOpenChange?.(false)}
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement…
                </div>
              ) : items.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Aucun enregistrement analysé.
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((a) => {
                    const meta = parseRecordingKey(a.s3KeyOriginal)
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(a)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/40',
                            a.favori && 'favori-glow',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {a.subjectName || meta.address || `audio_${a.id}`}
                              {a.subjectName && meta.address && (
                                <span className="ml-2 font-normal text-muted-foreground">
                                  {meta.address}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2">
                              <PorteStatutPill statut={a.statutPorte} />
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(meta.date)}
                              </span>
                            </div>
                          </div>
                          <span className="shrink-0 font-serif text-lg tabular-nums">
                            {typeof a.score === 'number' ? `${Math.round(a.score)}/100` : '—'}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
