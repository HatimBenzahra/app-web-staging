import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mail, Phone, GripVertical } from 'lucide-react'
import { Link } from 'react-router-dom'
import { aggregateStats } from '@/utils/business/ranks'

/**
 * Carte d'utilisateur draggable et droppable
 * Représente un directeur, manager ou commercial dans l'arbre hiérarchique
 */
export default function UserCard({ user, type, isDragging = false, showGrip = true }) {
  const id = `${type}-${user.id}`

  // Configuration du draggable
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging: isDraggingThis,
  } = useDraggable({
    id,
    data: { type, user },
  })

  // Configuration du droppable
  // Seuls les directeurs peuvent recevoir des managers
  // Les managers peuvent recevoir des commerciaux
  // Les commerciaux ne peuvent rien recevoir
  const canReceiveDrop = type === 'directeur' || type === 'manager'

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id,
    data: { type, user },
    disabled: !canReceiveDrop,
  })

  // Combiner les refs
  const setNodeRef = (node) => {
    setDragRef(node)
    setDropRef(node)
  }

  // Styles de transformation pour le drag
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined

  // Labels selon le type
  const typeLabel = {
    directeur: 'Directeur',
    manager: 'Manager',
    commercial: 'Commercial',
  }[type]

  // Variantes de badge
  const badgeVariant = {
    directeur: 'default',
    manager: 'secondary',
    commercial: 'outline',
  }[type]

  // Classes CSS conditionnelles
  const cardClasses = [
    'transition-all',
    'duration-200',
    'border',
    isDraggingThis && 'opacity-50',
    isOver && 'ring-2 ring-primary shadow-lg scale-105',
    isDragging && 'cursor-grabbing shadow-2xl',
    !isDragging && showGrip && 'cursor-grab',
    !isDragging && 'hover:shadow-md',
  ]
    .filter(Boolean)
    .join(' ')

  // Lien vers la page de détails
  const detailsPath = {
    directeur: '/directeurs',
    manager: '/managers',
    commercial: '/commerciaux',
  }[type]

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${cardClasses} ${isDragging ? 'relative z-50' : ''} select-none`}
      {...(showGrip && !isDragging ? { ...listeners, ...attributes } : {})}
    >
      <Card className="p-3 bg-card shadow-none border-0 select-none">
        <div className="flex items-start gap-3 select-none">
          {/* Grip handle pour drag */}
          {showGrip && !isDragging && (
            <div className="pt-1 text-muted-foreground">
              <GripVertical className="h-4 w-4" />
            </div>
          )}

          {/* Informations */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Nom et badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to={`${detailsPath}/${user.id}`}
                className="font-semibold hover:underline truncate"
              >
                {user.prenom} {user.nom}
              </Link>
              <Badge variant={badgeVariant} className="text-xs flex-shrink-0">
                {typeLabel}
              </Badge>
            </div>

            {/* Détails de contact */}
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

            {/* Statistiques pour commerciaux */}
            {type === 'commercial' && user.statistics && user.statistics.length > 0 && (() => {
              const { contratsSignes, immeublesVisites } = aggregateStats(user.statistics)
              return (
                <div className="pt-2 border-t">
                  <div className="flex gap-3 text-xs">
                    <div>
                      <span className="font-semibold text-foreground">
                        {contratsSignes}
                      </span>
                      <span className="text-muted-foreground"> contrats</span>
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">
                        {immeublesVisites}
                      </span>
                      <span className="text-muted-foreground"> immeubles</span>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Compteurs pour managers */}
            {type === 'manager' && (
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground">
                  {user.commercials?.length || 0} commercial
                  {(user.commercials?.length || 0) > 1 ? 'aux' : ''}
                </div>
              </div>
            )}

            {/* Compteurs pour directeurs */}
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
        </div>
      </Card>
    </div>
  )
}
