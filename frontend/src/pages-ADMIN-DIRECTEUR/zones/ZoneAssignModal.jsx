import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MultiSelect } from '@/components/ui/multi-select'
import { Users } from 'lucide-react'

/**
 * Modal léger de réassignation d'une zone : ajoute/retire des commerciaux et
 * managers assignés sans toucher au tracé de la zone. Réutilise le même
 * MultiSelect + format d'options (`${role}-${id}`) que ZoneCreatorModal.
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

  // Réinitialise la sélection à chaque ouverture / changement de zone ciblée
  useEffect(() => {
    if (isOpen) {
      setSelectedUserIds(initialSelectedUserIds)
    }
  }, [isOpen, zone?.id, initialSelectedUserIds])

  const handleValidate = () => {
    onValidate(selectedUserIds)
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-left">Réassigner la zone</DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <DialogDescription className="text-left">
            Choisissez les managers et commerciaux assignés à{' '}
            <span className="font-medium text-foreground">{zone?.nom}</span>. Les personnes retirées
            de la sélection seront désassignées.
          </DialogDescription>

          <div className="space-y-2">
            <Label htmlFor="reassign-users" className="text-sm font-medium">
              Membres assignés
            </Label>
            <MultiSelect
              id="reassign-users"
              options={assignableUsers.map(user => ({
                value: `${user.role}-${user.id}`,
                label: `${user.name} (${user.role})`,
                group: user.role === 'manager' ? 'Managers' : 'Commerciaux',
              }))}
              selected={selectedUserIds}
              onChange={setSelectedUserIds}
              placeholder="Sélectionner des membres..."
              emptyText="Aucun membre disponible"
            />
          </div>
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
