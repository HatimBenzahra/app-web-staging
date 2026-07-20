import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Users, Check, Search, UserCog, Briefcase } from 'lucide-react'

/**
 * Modal léger de réassignation d'une zone : ajoute/retire des commerciaux et
 * managers assignés sans toucher au tracé de la zone.
 *
 * La sélection est une checklist EN LIGNE (pas un dropdown en portal) : un menu
 * porté vers document.body est vu comme « hors dialog » par Radix et referme le
 * modal au clic. Ici tout vit dans le DialogContent → sélection fiable + on voit
 * toutes les options d'un coup. Les valeurs gardent le format `${role}-${id}`.
 */
export default function ZoneAssignModal({
  isOpen,
  zone,
  assignableUsers = [],
  initialSelectedUserIds = [],
  onValidate,
  onClose,
  isSubmitting = false,
}) {
  const [selectedUserIds, setSelectedUserIds] = useState(initialSelectedUserIds)
  const [search, setSearch] = useState('')

  // Réinitialise la sélection à chaque ouverture / changement de zone ciblée
  useEffect(() => {
    if (isOpen) {
      setSelectedUserIds(initialSelectedUserIds)
      setSearch('')
    }
  }, [isOpen, zone?.id, initialSelectedUserIds])

  const options = useMemo(
    () =>
      assignableUsers.map(user => ({
        value: `${user.role}-${user.id}`,
        label: user.name,
        role: user.role,
      })),
    [assignableUsers]
  )

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options
    return [
      { key: 'Managers', icon: UserCog, items: filtered.filter(o => o.role === 'manager') },
      { key: 'Commerciaux', icon: Briefcase, items: filtered.filter(o => o.role !== 'manager') },
    ].filter(g => g.items.length > 0)
  }, [options, search])

  const toggle = value =>
    setSelectedUserIds(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    )

  const handleValidate = () => onValidate(selectedUserIds)

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="text-left">Réassigner la zone</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <DialogDescription className="text-left">
            Choisissez les managers et commerciaux assignés à{' '}
            <span className="font-medium text-foreground">{zone?.nom}</span>. Les personnes retirées
            de la sélection seront désassignées.
          </DialogDescription>

          {/* Recherche */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un membre..."
              className="h-9 pl-8"
            />
          </div>

          {/* Compteur de sélection */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {selectedUserIds.length > 0
                ? `${selectedUserIds.length} sélectionné${selectedUserIds.length > 1 ? 's' : ''}`
                : 'Aucun membre sélectionné'}
            </span>
            {selectedUserIds.length > 0 && (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedUserIds([])}
              >
                Tout retirer
              </button>
            )}
          </div>

          {/* Checklist en ligne */}
          <div className="max-h-64 overflow-y-auto rounded-md border">
            {groups.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Aucun membre disponible
              </div>
            ) : (
              groups.map(group => {
                const GroupIcon = group.icon
                return (
                  <div key={group.key} className="py-1">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <GroupIcon className="h-3.5 w-3.5" />
                      {group.key}
                    </div>
                    {group.items.map(option => {
                      const isSelected = selectedUserIds.includes(option.value)
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => toggle(option.value)}
                          className={cn(
                            'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                            isSelected && 'bg-accent/40'
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-input'
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </span>
                          <span className="flex-1 truncate text-foreground">{option.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>

          {/* Récap des sélectionnés */}
          {selectedUserIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {options
                .filter(o => selectedUserIds.includes(o.value))
                .map(o => (
                  <Badge key={o.value} variant="secondary" className="gap-1 px-2 py-0.5">
                    {o.label}
                    <button
                      type="button"
                      className="ml-0.5 text-muted-foreground hover:text-foreground"
                      onClick={() => toggle(o.value)}
                      aria-label={`Retirer ${o.label}`}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="button" onClick={handleValidate} disabled={isSubmitting}>
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>Enregistrement...</span>
              </div>
            ) : (
              'Enregistrer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
