import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, Plus, Users2, ChevronRight } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils.js'
import UserCard from './UserCard'

/**
 * Layout master-détail en 3 colonnes : Directeurs → Managers → Commerciaux.
 * Chaque colonne scrolle indépendamment (la page ne grandit pas). Les cartes
 * elles-mêmes sont les cibles de drop (assignation), plus la colonne « Non assignés ».
 */
export default function OrganizationColumns({
  visibleTrees,
  selectedDirecteurId,
  onSelectDirecteur,
  selectedDirecteur,
  columnManagers,
  columnHasDirect,
  selectedManagerId,
  onSelectManager,
  columnCommercials,
  onAddManager,
  onAddCommercial,
  onAddDirectCommercial,
  onReassign,
  onUnassign,
}) {
  if (!visibleTrees || visibleTrees.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground text-lg">Aucun directeur dans l'organisation</p>
      </Card>
    )
  }

  const selectedManager =
    typeof selectedManagerId === 'number'
      ? columnManagers.find(m => m.id === selectedManagerId)
      : null
  const isDirectSelected = selectedManagerId === 'direct'

  return (
    <>
      {/* Colonne 1 — Directeurs */}
      <Column title="Directeurs" count={visibleTrees.length}>
        <div className="space-y-2">
          {visibleTrees.map(directeur => (
            <UserCard
              key={directeur.id}
              user={directeur}
              type="directeur"
              showGrip={false}
              selectable
              selected={directeur.id === selectedDirecteurId}
              onSelect={onSelectDirecteur}
            />
          ))}
        </div>
      </Column>

      {/* Colonne 2 — Managers du directeur sélectionné */}
      <Column
        title="Managers"
        count={columnManagers.length}
        action={
          selectedDirecteur && onAddManager ? (
            <AddButton label="Manager" onClick={() => onAddManager(selectedDirecteur.id)} />
          ) : null
        }
      >
        {!selectedDirecteur ? (
          <EmptyHint>Sélectionnez un directeur</EmptyHint>
        ) : (
          <div className="space-y-2">
            {columnManagers.map(manager => (
              <UserCard
                key={manager.id}
                user={manager}
                type="manager"
                selectable
                selected={manager.id === selectedManagerId}
                onSelect={onSelectManager}
                onReassign={onReassign}
                onUnassign={onUnassign}
              />
            ))}

            {/* Entrée « Commerciaux directs » (droppable) */}
            {(columnHasDirect || onAddDirectCommercial) && (
              <DirectRow
                directeurId={selectedDirecteur.id}
                count={selectedDirecteur.directCommercials?.length || 0}
                selected={isDirectSelected}
                onSelect={() => onSelectManager('direct')}
              />
            )}

            {columnManagers.length === 0 && !columnHasDirect && (
              <EmptyHint>Aucun manager — glissez-en un ici ou ajoutez-en</EmptyHint>
            )}
          </div>
        )}
      </Column>

      {/* Colonne 3 — Commerciaux du manager (ou directs) sélectionné */}
      <Column
        title={isDirectSelected ? 'Commerciaux directs' : 'Commerciaux'}
        count={columnCommercials.length}
        action={
          isDirectSelected && selectedDirecteur && onAddDirectCommercial ? (
            <AddButton
              label="Commercial"
              onClick={() => onAddDirectCommercial(selectedDirecteur.id)}
            />
          ) : selectedManager && onAddCommercial ? (
            <AddButton label="Commercial" onClick={() => onAddCommercial(selectedManager.id)} />
          ) : null
        }
        wide
      >
        {!selectedManager && !isDirectSelected ? (
          <EmptyHint>Sélectionnez un manager</EmptyHint>
        ) : columnCommercials.length === 0 ? (
          <EmptyHint>Aucun commercial</EmptyHint>
        ) : (
          <div className="space-y-2">
            {columnCommercials.map(commercial => (
              <UserCard
                key={commercial.id}
                user={commercial}
                type="commercial"
                onReassign={onReassign}
                onUnassign={onUnassign}
              />
            ))}
          </div>
        )}
      </Column>
    </>
  )
}

/** Coquille de colonne : header (titre + compteur + action) et liste scrollable interne. */
function Column({ title, count, action, children, wide = false }) {
  return (
    <Card className={cn('shrink-0 flex flex-col max-h-[70vh]', wide ? 'w-80' : 'w-72')}>
      <div className="flex items-center justify-between gap-2 p-3 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-semibold text-sm truncate">{title}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">({count})</span>
        </div>
        {action}
      </div>
      <div className="flex-1 overflow-y-auto p-3">{children}</div>
    </Card>
  )
}

function AddButton({ label, onClick }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 gap-1 text-xs shrink-0"
      onClick={onClick}
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </Button>
  )
}

function EmptyHint({ children }) {
  return <p className="text-xs text-muted-foreground py-6 text-center">{children}</p>
}

/** Ligne « Commerciaux directs » : sélectionnable + droppable (commercial → direct). */
function DirectRow({ directeurId, count, selected, onSelect }) {
  const { setNodeRef, isOver } = useDroppable({ id: `dropzone-direct-commercial-${directeurId}` })

  return (
    <button
      type="button"
      ref={setNodeRef}
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-2 rounded-lg border p-3 text-left transition-all',
        'hover:shadow-md',
        selected && 'bg-muted border-foreground/25 shadow-sm',
        isOver && 'ring-2 ring-primary'
      )}
    >
      <Users2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Commerciaux directs</p>
        <p className="text-xs text-muted-foreground">Sans manager intermédiaire</p>
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      <ChevronRight
        className={cn(
          'h-4 w-4 shrink-0',
          selected ? 'text-foreground' : 'text-muted-foreground/50'
        )}
      />
    </button>
  )
}
