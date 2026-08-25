import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import CoachingDetail from './CoachingDetail'

/** Modal de détail d'une analyse (ouvert depuis « Voir » du tableau de gestion). */
export default function CoachingDetailModal({ open, onOpenChange, analysis }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94vh] w-[97vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-none lg:ml-[9.5rem] lg:w-[calc(100vw-19rem)] ">
        {analysis ? (
          <CoachingDetail analysis={analysis} onClose={() => onOpenChange?.(false)} />
        ) : (
          <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
            <DialogTitle className="sr-only">Analyse coaching</DialogTitle>
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
