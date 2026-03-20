import { useDroppable } from '@dnd-kit/core'
import { Card } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils.js'

/**
 * Zone de dépôt visuelle avec bordures pointillées
 * Affiche un feedback visuel en fonction de la validité du drop
 */
export default function DropZone({
  id,
  acceptedType, // 'manager' ou 'commercial'
  children,
  className = '',
  emptyMessage = 'Glissez un élément ici',
  isDraggingWrongType = false
}) {
  const { setNodeRef, isOver, active } = useDroppable({
    id,
    data: { acceptedType }
  })

  // Vérifier si le type draggé est accepté
  const draggedType = active?.id?.split('-')[0]
  const isValidDrop = draggedType === acceptedType
  const showError = isOver && !isValidDrop && isDraggingWrongType

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative transition-all duration-200',
        className
      )}
    >
      {children ? (
        <div
          className={cn(
            'transition-all duration-200',
            isOver && isValidDrop && 'ring-2 ring-primary scale-[1.02]',
            showError && 'ring-2 ring-destructive scale-[0.98]'
          )}
        >
          {children}
        </div>
      ) : (
        <Card
          className={cn(
            'p-6 text-center border-2 border-dashed transition-all duration-200',
            'hover:border-primary/50 hover:bg-accent/5',
            isOver && isValidDrop && 'border-primary bg-primary/5 ring-2 ring-primary/20',
            showError && 'border-destructive bg-destructive/10 ring-2 ring-destructive/20'
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                'w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center transition-colors',
                isOver && isValidDrop && 'border-primary bg-primary/10',
                showError && 'border-destructive bg-destructive/10',
                !isOver && 'border-muted-foreground/30'
              )}
            >
              <Plus
                className={cn(
                  'h-6 w-6 transition-colors',
                  isOver && isValidDrop && 'text-primary',
                  showError && 'text-destructive',
                  !isOver && 'text-muted-foreground'
                )}
              />
            </div>
            <p
              className={cn(
                'text-sm font-medium transition-colors',
                isOver && isValidDrop && 'text-primary',
                showError && 'text-destructive',
                !isOver && 'text-muted-foreground'
              )}
            >
              {showError ? 'Type invalide!' : emptyMessage}
            </p>
            {showError && (
              <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1">
                Vous ne pouvez pas déposer un {draggedType} ici
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
