import { Card } from '@/components/ui/card'
import { UserX, ArrowDownToLine } from 'lucide-react'
import { useDroppable, useDndContext } from '@dnd-kit/core'
import { cn } from '@/lib/utils.js'
import UserCard from './UserCard'
import { UNASSIGN_DROPZONE_ID } from '../useGestionLogic'

/**
 * Colonne des utilisateurs non assignés. Sert aussi de zone de dépôt pour
 * DÉSASSIGNER : glisser un manager ou un commercial ici le détache de sa hiérarchie.
 */
export default function UnassignedPanel({ managers, commercials }) {
  const hasUnassigned = managers.length > 0 || commercials.length > 0

  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGN_DROPZONE_ID })
  const { active } = useDndContext()
  const draggedType = active?.id?.split('-')[0]
  const canDropHere = draggedType === 'manager' || draggedType === 'commercial'
  const isValidOver = isOver && canDropHere

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        'shrink-0 w-72 flex flex-col max-h-[70vh] transition-all duration-200',
        isValidOver && 'ring-2 ring-primary'
      )}
    >
      <div className="flex items-center gap-2 p-3 border-b">
        <UserX className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">Non assignés</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          ({managers.length + commercials.length})
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Indice de dépôt pendant un drag d'élément assignable */}
        {canDropHere && (
          <div
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-lg border border-dashed p-4 text-center transition-colors',
              isValidOver ? 'border-foreground/30 bg-muted' : 'border-muted-foreground/30'
            )}
          >
            <ArrowDownToLine className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">
              Déposez ici pour désassigner
            </p>
          </div>
        )}

        {managers.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground">
              Managers ({managers.length})
            </h4>
            <div className="space-y-2">
              {managers.map(manager => (
                <UserCard key={manager.id} user={manager} type="manager" />
              ))}
            </div>
          </div>
        )}

        {commercials.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground">
              Commerciaux ({commercials.length})
            </h4>
            <div className="space-y-2">
              {commercials.map(commercial => (
                <UserCard key={commercial.id} user={commercial} type="commercial" />
              ))}
            </div>
          </div>
        )}

        {!hasUnassigned && !canDropHere && (
          <p className="text-xs text-muted-foreground py-6 text-center">
            Aucun utilisateur non assigné. Glissez un manager ou un commercial ici pour le détacher.
          </p>
        )}
      </div>
    </Card>
  )
}
