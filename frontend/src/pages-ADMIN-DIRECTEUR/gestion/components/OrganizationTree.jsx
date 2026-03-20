import { Card } from '@/components/ui/card'
import { Building2 } from 'lucide-react'
import { useDndContext } from '@dnd-kit/core'
import UserCard from './UserCard'
import DropZone from './DropZone'

/**
 * Composant d'arbre hiérarchique de l'organisation
 * Affiche la structure en colonnes: Directeurs | Managers | Commerciaux
 * Chaque directeur a son propre arbre vertical
 */
export default function OrganizationTree({ data, isDirecteur, currentUserId }) {
  // Filtrer les directeurs selon les permissions
  const visibleDirecteurs = isDirecteur ? data.filter(d => d.id === currentUserId) : data

  if (!visibleDirecteurs || visibleDirecteurs.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground text-lg mb-4">Aucun directeur dans l'organisation</p>
      </Card>
    )
  }

  // Afficher tous les directeurs pour permettre le drag and drop entre tous
  return (
    <div className="space-y-4">
      {/* En-tête simple */}
      <div className="text-sm text-muted-foreground">
        {visibleDirecteurs.length} directeur{visibleDirecteurs.length > 1 ? 's' : ''} dans
        l'organisation
      </div>

      {/* Afficher tous les directeurs en grille responsive - scroll naturel de la page */}
      <div
        className={`grid gap-6 ${visibleDirecteurs.length > 1 && typeof window !== 'undefined' && window.innerWidth >= 1280 ? 'grid-cols-2' : 'grid-cols-1'}`}
      >
        {visibleDirecteurs.map(directeur => (
          <DirecteurTree
            key={directeur.id}
            directeur={directeur}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Arbre vertical pour un directeur avec ses managers et commerciaux
 */
function DirecteurTree({ directeur }) {
  const hasManagers = directeur.managers && directeur.managers.length > 0
  const hasDirectCommercials = directeur.directCommercials && directeur.directCommercials.length > 0

  // Récupérer le contexte du drag pour savoir ce qui est en cours de drag
  const { active } = useDndContext()
  const draggedType = active?.id?.split('-')[0]

  return (
    <Card className="p-6 space-y-6 border-2">
      {/* Niveau 1: Directeur - Zone droppable pour les managers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Directeur</h3>
        </div>
        <div className="relative">
          <UserCard user={directeur} type="directeur" showGrip={false} />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Glissez un manager ici pour l'assigner à ce directeur
          </p>
        </div>
      </div>

      {/* Ligne de séparation */}
      <div className="border-t-2 border-dashed" />

      {/* Niveau 2 & 3: Managers et leurs Commerciaux */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-muted-foreground">
            Managers ({hasManagers ? directeur.managers.length : 0})
          </h4>
        </div>

        {/* Drop zone pour les managers */}
        <DropZone
          id={`dropzone-manager-${directeur.id}`}
          acceptedType="manager"
          emptyMessage="Glissez un manager ici"
          isDraggingWrongType={draggedType && draggedType !== 'manager'}
        >
          {hasManagers ? (
            <div className="space-y-4">
              {directeur.managers.map(manager => (
                <ManagerNode
                  key={manager.id}
                  manager={manager}
                  draggedType={draggedType}
                />
              ))}
            </div>
          ) : null}
        </DropZone>
      </div>

      {/* Commerciaux directs */}
      {hasDirectCommercials && (
        <>
          <div className="border-t-2 border-dashed" />
          <div className="space-y-3">
            <div className="space-y-1">
              <h4 className="font-semibold text-muted-foreground">
                Commerciaux directs ({directeur.directCommercials.length})
              </h4>
              <p className="text-xs text-muted-foreground">
                Commerciaux rattachés directement au directeur, sans manager intermédiaire
              </p>
            </div>
            <DropZone
              id={`dropzone-direct-commercial-${directeur.id}`}
              acceptedType="commercial"
              emptyMessage="Glissez un commercial ici"
              isDraggingWrongType={draggedType && draggedType !== 'commercial'}
            >
              <div className="space-y-2 pl-4 border-l-2">
                {directeur.directCommercials.map(commercial => (
                  <div key={commercial.id} className="flex items-center gap-2 min-w-0">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <UserCard user={commercial} type="commercial" />
                    </div>
                  </div>
                ))}
              </div>
            </DropZone>
          </div>
        </>
      )}
    </Card>
  )
}

/**
 * Nœud pour un manager avec ses commerciaux
 */
function ManagerNode({ manager, draggedType }) {
  const hasCommercials = manager.commercials && manager.commercials.length > 0

  return (
    <Card className="p-4 space-y-3 bg-card/50 border-l-4 border-l-primary/30">
      {/* Manager */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <UserCard user={manager} type="manager" />
          </div>
        </div>
      </div>

      {/* Commerciaux du manager avec drop zone */}
      <div className="space-y-2 pl-4 border-l-2 border-dashed">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            Commerciaux ({hasCommercials ? manager.commercials.length : 0})
          </p>
        </div>

        {/* Drop zone pour les commerciaux */}
        <DropZone
          id={`dropzone-commercial-${manager.id}`}
          acceptedType="commercial"
          emptyMessage="Glissez un commercial ici"
          isDraggingWrongType={draggedType && draggedType !== 'commercial'}
          className="min-h-[60px]"
        >
          {hasCommercials ? (
            <div className="space-y-2">
              {manager.commercials.map(commercial => (
                <div key={commercial.id} className="flex items-center gap-2">
                  <div className="flex-1">
                    <UserCard user={commercial} type="commercial" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </DropZone>
      </div>
    </Card>
  )
}
