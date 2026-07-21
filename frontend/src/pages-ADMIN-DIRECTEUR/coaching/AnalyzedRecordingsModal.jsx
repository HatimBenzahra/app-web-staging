import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronRight, Loader2, RotateCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import CoachingService from '@/services/coaching/coaching.service'
import CoachingResultPanel from './CoachingResultPanel'
import { PorteStatutPill, parseRecordingKey, formatDateTime } from './CoachingComponents'

// Libellé court d'un enregistrement pour le fil d'ariane.
function crumbLabel(a) {
  if (!a) return ''
  const meta = parseRecordingKey(a.s3KeyOriginal)
  return a.subjectName || meta.address || `audio_${a.id}`
}

/**
 * Modal des enregistrements déjà analysés : liste → détail (même modal), avec
 * fil d'ariane « Analysés › audio_xxx » et bouton retour.
 */
export default function AnalyzedRecordingsModal({ open, onOpenChange }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [relaunching, setRelaunching] = useState(false)

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

  const relaunch = async () => {
    if (!selected) return
    setRelaunching(true)
    try {
      const updated = await CoachingService.relaunch(selected.id)
      if (updated) setSelected(updated)
    } finally {
      setRelaunching(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b p-4">
          {selected ? (
            <div className="flex items-center gap-2 pr-8 text-sm">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2"
                onClick={() => setSelected(null)}
              >
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Button>
              <span className="text-muted-foreground">Analysés</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate font-medium">{crumbLabel(selected)}</span>
            </div>
          ) : (
            <DialogTitle className="text-base">Enregistrements analysés</DialogTitle>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {selected ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={relaunch}
                  disabled={relaunching}
                >
                  {relaunching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCw className="h-4 w-4" />
                  )}
                  Relancer
                </Button>
              </div>
              <CoachingResultPanel analysis={selected} recordingKey={selected.s3KeyOriginal} showAudio showScoreHeader />
            </div>
          ) : loading ? (
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
                      className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
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
      </DialogContent>
    </Dialog>
  )
}
