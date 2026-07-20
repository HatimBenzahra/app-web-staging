import { useState, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowRightLeft } from 'lucide-react'

const NONE = 'none'

/**
 * Modal de réassignation d'un manager ou d'un commercial vers une cible arbitraire
 * (hors colonnes visibles). Le payload est déterministe :
 *  - commercial + manager choisi → directeur dérivé du manager
 *  - commercial + directeur seul  → commercial direct (managerId null)
 *  - « Aucun » partout            → désassignation
 */
export default function ReassignModal({
  isOpen,
  onClose,
  user,
  userType,
  directeurs = [],
  managers = [],
  onReassignCommercial,
  onReassignManager,
}) {
  const [directeurId, setDirecteurId] = useState(NONE)
  const [managerId, setManagerId] = useState(NONE)

  useEffect(() => {
    if (isOpen && user) {
      setDirecteurId(user.directeurId ? user.directeurId.toString() : NONE)
      setManagerId(user.managerId ? user.managerId.toString() : NONE)
    }
  }, [isOpen, user])

  const directeurOptions = useMemo(
    () => directeurs.map(d => ({ value: d.id.toString(), label: `${d.prenom} ${d.nom}` })),
    [directeurs]
  )

  // Managers proposés : filtrés par directeur sélectionné (le cas échéant).
  const managerOptions = useMemo(() => {
    const source =
      directeurId !== NONE
        ? managers.filter(m => m.directeurId === parseInt(directeurId, 10))
        : managers
    return source.map(m => ({ value: m.id.toString(), label: `${m.prenom} ${m.nom}` }))
  }, [managers, directeurId])

  const handleOpenChange = open => {
    if (!open) onClose()
  }

  const handleSubmit = e => {
    e.preventDefault()
    if (!user) return

    if (userType === 'commercial') {
      if (managerId !== NONE) {
        // Directeur dérivé du manager choisi (cohérent avec le backend).
        const mgr = managers.find(m => m.id === parseInt(managerId, 10))
        onReassignCommercial(user.id, {
          managerId: parseInt(managerId, 10),
          directeurId: mgr?.directeurId ?? null,
        })
      } else {
        onReassignCommercial(user.id, {
          managerId: null,
          directeurId: directeurId !== NONE ? parseInt(directeurId, 10) : null,
        })
      }
    } else if (userType === 'manager') {
      onReassignManager(user.id, {
        directeurId: directeurId !== NONE ? parseInt(directeurId, 10) : null,
      })
    }

    onClose()
  }

  const fullName = user ? `${user.prenom} ${user.nom}` : ''

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Réassigner {fullName}
          </DialogTitle>
          <DialogDescription>
            {userType === 'commercial'
              ? 'Choisissez un directeur et/ou un manager. « Aucun » désassigne.'
              : 'Choisissez le directeur de rattachement. « Aucun » désassigne.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reassign-directeur">Directeur</Label>
            <Select
              value={directeurId}
              onValueChange={value => {
                setDirecteurId(value)
                setManagerId(NONE) // le manager dépend du directeur
              }}
            >
              <SelectTrigger id="reassign-directeur">
                <SelectValue placeholder="Sélectionner un directeur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Aucun</SelectItem>
                {directeurOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {userType === 'commercial' && (
            <div className="space-y-2">
              <Label htmlFor="reassign-manager">Manager</Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger id="reassign-manager">
                  <SelectValue placeholder="Sélectionner un manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Aucun (commercial direct)</SelectItem>
                  {managerOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">Réassigner</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
