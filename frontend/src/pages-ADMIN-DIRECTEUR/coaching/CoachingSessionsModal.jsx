import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import CoachingManagementList from './CoachingManagementList'

/**
 * Modal ouvert depuis « N sessions analysées » d'une synthèse : liste des
 * enregistrements coachables du sujet (analysés → score + Voir ; non analysés →
 * Lancer), avec recherche/filtres/sélection multiple. Réutilise
 * CoachingManagementList verrouillé sur le sujet (pas de duplication).
 */
export default function CoachingSessionsModal({ open, onOpenChange, subjectId, subjectName }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b p-5">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base">
              Sessions analysées{subjectName ? ` — ${subjectName}` : ''}
            </DialogTitle>
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
          {subjectId != null && <CoachingManagementList initialSubjectId={subjectId} lockSubject />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
