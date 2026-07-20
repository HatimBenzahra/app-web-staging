import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  Mail,
  Phone,
  GripVertical,
  MoreVertical,
  ArrowRightLeft,
  UserMinus,
  ChevronRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { aggregateStats } from '@/utils/business/ranks'
import { cn } from '@/lib/utils.js'

/**
 * Carte d'utilisateur draggable + droppable, utilisée dans les colonnes master-détail.
 *
 * Interactions découplées :
 *  - le drag se déclenche uniquement via le GRIP (le corps de la carte reste cliquable) ;
 *  - clic sur le corps → sélection (navigation entre colonnes) si `selectable` ;
 *  - menu ⋮ → « Réassigner » / « Retirer » (managers & commerciaux).
 *
 * @param {Function} [onSelect]   - sélection de la carte (colonnes)
 * @param {Function} [onReassign] - (type, user) → ouvre le modal de réassignation
 * @param {Function} [onUnassign] - (type, id) → désassigne
 */
export default function UserCard({
  user,
  type,
  isDragging = false,
  showGrip = true,
  selectable = false,
  selected = false,
  onSelect,
  onReassign,
  onUnassign,
}) {
  const id = `${type}-${user.id}`

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging: isDraggingThis,
  } = useDraggable({ id, data: { type, user } })

  // Directeurs et managers peuvent recevoir un drop ; les commerciaux non.
  const canReceiveDrop = type === 'directeur' || type === 'manager'
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id,
    data: { type, user },
    disabled: !canReceiveDrop,
  })

  const setNodeRef = node => {
    setDragRef(node)
    setDropRef(node)
  }

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  const typeLabel = { directeur: 'Directeur', manager: 'Manager', commercial: 'Commercial' }[type]
  const badgeVariant = { directeur: 'default', manager: 'secondary', commercial: 'outline' }[type]
  const detailsPath = {
    directeur: '/directeurs',
    manager: '/managers',
    commercial: '/commerciaux',
  }[type]

  const showActions =
    !isDragging && (type === 'manager' || type === 'commercial') && (onReassign || onUnassign)

  const handleBodyClick = () => {
    if (selectable && onSelect) onSelect(user.id)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'transition-all duration-200 border rounded-lg select-none',
        isDraggingThis && 'opacity-50',
        // Feedback transitoire de drop (ring, non persistant) — pas une bordure sémantique
        isOver && 'ring-2 ring-primary shadow-lg',
        isDragging && 'cursor-grabbing shadow-2xl relative z-50',
        !isDragging && 'hover:shadow-md',
        selected && 'bg-muted border-foreground/25 shadow-sm',
        selectable && !selected && 'cursor-pointer'
      )}
    >
      <Card className="p-3 bg-transparent shadow-none border-0 select-none">
        <div className="flex items-start gap-2 select-none">
          {/* Grip = poignée de drag (seul déclencheur du drag) */}
          {showGrip && !isDragging && (
            <div
              className="pt-1 text-muted-foreground cursor-grab touch-none"
              {...listeners}
              {...attributes}
              onClick={e => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}

          {/* Corps cliquable (sélection) */}
          <div
            className="flex-1 min-w-0 space-y-2"
            onClick={handleBodyClick}
            role={selectable ? 'button' : undefined}
          >
            {/* Nom et badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to={`${detailsPath}/${user.id}`}
                onClick={e => e.stopPropagation()}
                className="font-semibold hover:underline truncate"
              >
                {user.prenom} {user.nom}
              </Link>
              <Badge variant={badgeVariant} className="text-xs flex-shrink-0">
                {typeLabel}
              </Badge>
            </div>

            {/* Contact */}
            <div className="space-y-1 text-xs text-muted-foreground">
              {user.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
              )}
              {(user.numTelephone || user.numTel) && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 flex-shrink-0" />
                  <span>{user.numTelephone || user.numTel}</span>
                </div>
              )}
            </div>

            {/* Stats commerciaux */}
            {type === 'commercial' &&
              user.statistics &&
              user.statistics.length > 0 &&
              (() => {
                const { contratsSignes, immeublesVisites } = aggregateStats(user.statistics)
                return (
                  <div className="pt-2 border-t">
                    <div className="flex gap-3 text-xs">
                      <div>
                        <span className="font-semibold text-foreground">{contratsSignes}</span>
                        <span className="text-muted-foreground"> contrats</span>
                      </div>
                      <div>
                        <span className="font-semibold text-foreground">{immeublesVisites}</span>
                        <span className="text-muted-foreground"> bâtiments</span>
                      </div>
                    </div>
                  </div>
                )
              })()}

            {/* Compteur managers */}
            {type === 'manager' && (
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground">
                  {user.commercials?.length || 0} commercial
                  {(user.commercials?.length || 0) > 1 ? 'aux' : ''}
                </div>
              </div>
            )}

            {/* Compteurs directeur */}
            {type === 'directeur' && (
              <div className="pt-2 border-t">
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <div>
                    <span className="font-semibold text-foreground">
                      {user.managers?.length || 0}
                    </span>{' '}
                    manager{(user.managers?.length || 0) > 1 ? 's' : ''}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">
                      {(user.managers?.reduce((sum, m) => sum + (m.commercials?.length || 0), 0) ||
                        0) + (user.directCommercials?.length || 0)}
                    </span>{' '}
                    commerciaux
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Menu d'action + chevron de navigation */}
          <div className="flex items-center gap-0.5 shrink-0">
            {showActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                    aria-label="Actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                  {onReassign && (
                    <DropdownMenuItem onClick={() => onReassign(type, user)}>
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      Réassigner…
                    </DropdownMenuItem>
                  )}
                  {onUnassign && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onUnassign(type, user.id)}
                    >
                      <UserMinus className="mr-2 h-4 w-4" />
                      Retirer (désassigner)
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {selectable && (
              <ChevronRight
                className={cn(
                  'h-4 w-4 shrink-0',
                  selected ? 'text-foreground' : 'text-muted-foreground/50'
                )}
              />
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
