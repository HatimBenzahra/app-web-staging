import React from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, XCircle, Clock, Layers } from 'lucide-react'

const STEP_LABELS = {
  queued: 'En attente...',
  downloading: "Téléchargement de l'audio...",
  transcribing: 'Analyse de la parole...',
  cutting: 'Découpage audio...',
  uploading: 'Enregistrement...',
  done: 'Terminé',
  error: 'Échec',
}

function getFilename(key) {
  return key.split('/').pop() || key
}

function StatusIcon({ step }) {
  if (step === 'done') return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
  if (step === 'error') return <XCircle className="w-4 h-4 text-destructive shrink-0" />
  if (step === 'queued') return <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
  return <Loader2 className="w-4 h-4 text-primary shrink-0 animate-spin" />
}

function QueueItem({ item }) {
  const { key, step, current, total } = item
  const filename = getFilename(key)
  const isActive = step !== 'done' && step !== 'error' && step !== 'queued'
  const percent = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="flex flex-col gap-1.5 py-2.5 px-3 rounded-lg border border-border/50 bg-muted/20">
      <div className="flex items-center gap-2 min-w-0">
        <StatusIcon step={step} />
        <span className="text-xs font-medium truncate flex-1" title={filename}>
          {filename}
        </span>
      </div>
      <span className="text-[11px] text-muted-foreground pl-6">
        {STEP_LABELS[step] || step}
      </span>
      {isActive && (
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-0.5">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
            style={{ width: `${percent || 5}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function ExtractionQueueDrawer({ queue, open, onOpenChange }) {
  const activeCount = queue.filter(
    item => item.step !== 'done' && item.step !== 'error'
  ).length

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-3.5 py-2 rounded-full bg-background border border-border shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        aria-label="Voir la file d'extraction"
      >
        {activeCount > 0 && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
        )}
        <Layers className="w-4 h-4" />
        <span className="text-xs font-medium">Extractions</span>
        {queue.length > 0 && (
          <Badge
            variant={activeCount > 0 ? 'default' : 'secondary'}
            className="h-4 min-w-4 px-1 text-[10px] font-bold"
          >
            {queue.length}
          </Badge>
        )}
      </button>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-80 sm:max-w-sm flex flex-col gap-0 p-0">
          <SheetHeader className="px-4 pt-5 pb-3 border-b">
            <div className="flex items-center gap-2 pr-6">
              <Layers className="w-4 h-4 text-muted-foreground" />
              <SheetTitle className="text-sm font-semibold">File d'extraction</SheetTitle>
              {activeCount > 0 && (
                <Badge variant="default" className="h-4 px-1.5 text-[10px] ml-auto">
                  {activeCount} actif{activeCount > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <SheetDescription className="text-[11px]">
              Statut des extractions de conversation en cours
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Layers className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">
                  Aucune extraction en cours
                </p>
              </div>
            ) : (
              queue.map(item => (
                <QueueItem key={item.key} item={item} />
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
