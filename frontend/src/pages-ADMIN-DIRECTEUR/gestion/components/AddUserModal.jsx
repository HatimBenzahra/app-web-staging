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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateDirecteur, useCreateManager, useCreateCommercial } from '@/services'
import { useErrorToast } from '@/hooks/utils/ui/use-error-toast'
import { Crown, Briefcase, UserCircle, Loader2 } from 'lucide-react'

/**
 * Modal pour ajouter un nouvel utilisateur (directeur, manager ou commercial)
 */
export default function AddUserModal({
  isOpen,
  onClose,
  onSuccess,
  userType,
  parentId,
  directeurs,
  managers,
}) {
  const { showError, showSuccess } = useErrorToast()

  // Mutations
  const { mutate: createDirecteur, loading: creatingDirecteur } = useCreateDirecteur()
  const { mutate: createManager, loading: creatingManager } = useCreateManager()
  const { mutate: createCommercial, loading: creatingCommercial } = useCreateCommercial()

  // État du formulaire
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    numTelephone: '',
    numTel: '',
    age: '',
    adresse: '',
    directeurId: parentId ? parentId.toString() : 'none',
    managerId: parentId && userType === 'commercial' ? parentId.toString() : 'none',
  })

  const [errors, setErrors] = useState({})

  // Mettre à jour le formulaire quand parentId ou userType changent
  useEffect(() => {
    if (isOpen && parentId) {
      setFormData(prev => ({
        ...prev,
        directeurId: userType === 'manager' ? parentId.toString() : prev.directeurId,
        managerId: userType === 'commercial' ? parentId.toString() : prev.managerId,
      }))
    }
  }, [isOpen, parentId, userType])

  // Réinitialiser le formulaire quand on ouvre/ferme le modal
  const handleOpenChange = open => {
    if (!open) {
      setFormData({
        nom: '',
        prenom: '',
        email: '',
        numTelephone: '',
        numTel: '',
        age: '',
        adresse: '',
        directeurId: 'none',
        managerId: 'none',
      })
      setErrors({})
      onClose()
    }
  }

  // Valider le formulaire
  const validateForm = () => {
    const newErrors = {}

    if (!formData.nom.trim()) {
      newErrors.nom = 'Le nom est requis'
    }

    if (!formData.prenom.trim()) {
      newErrors.prenom = 'Le prénom est requis'
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide'
    }

    if (userType === 'commercial') {
      if (!formData.age || parseInt(formData.age) < 18 || parseInt(formData.age) > 65) {
        newErrors.age = "L'âge doit être entre 18 et 65 ans"
      }
    }

    if (userType === 'manager' && (!formData.directeurId || formData.directeurId === 'none')) {
      newErrors.directeurId = 'Un directeur doit être sélectionné'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Gérer la soumission
  const handleSubmit = async e => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      if (userType === 'directeur') {
        await createDirecteur({
          nom: formData.nom,
          prenom: formData.prenom,
          email: formData.email || undefined,
          numTelephone: formData.numTelephone || undefined,
          adresse: formData.adresse || undefined,
        })
        showSuccess('Directeur créé avec succès')
      } else if (userType === 'manager') {
        await createManager({
          nom: formData.nom,
          prenom: formData.prenom,
          email: formData.email || undefined,
          numTelephone: formData.numTelephone || undefined,
          directeurId: parseInt(formData.directeurId),
        })
        showSuccess('Manager créé avec succès')
      } else if (userType === 'commercial') {
        const commercialData = {
          nom: formData.nom,
          prenom: formData.prenom,
          email: formData.email || undefined,
          numTel: formData.numTel || undefined,
          age: parseInt(formData.age),
        }

        // Ajouter managerId seulement s'il est défini et pas "none"
        if (formData.managerId && formData.managerId !== 'none') {
          commercialData.managerId = parseInt(formData.managerId)
        }

        // Ajouter directeurId seulement s'il est défini et pas "none"
        if (formData.directeurId && formData.directeurId !== 'none') {
          commercialData.directeurId = parseInt(formData.directeurId)
        }

        await createCommercial(commercialData)
        showSuccess('Commercial créé avec succès')
      }

      onSuccess()
    } catch (error) {
      showError(error, 'AddUserModal.handleSubmit')
    }
  }

  const loading = creatingDirecteur || creatingManager || creatingCommercial

  // Icône et titre selon le type
  const TypeIcon =
    {
      directeur: Crown,
      manager: Briefcase,
      commercial: UserCircle,
    }[userType] || UserCircle

  const title =
    {
      directeur: 'Nouveau Directeur',
      manager: 'Nouveau Manager',
      commercial: 'Nouveau Commercial',
    }[userType] || 'Nouvel Utilisateur'

  const description =
    {
      directeur: "Ajoutez un nouveau directeur à l'organisation",
      manager: 'Ajoutez un nouveau manager',
      commercial: 'Ajoutez un nouveau commercial',
    }[userType] || 'Ajoutez un nouvel utilisateur'

  // Options pour les selects
  const directeurOptions = useMemo(() => {
    if (!directeurs) return []
    return directeurs.map(d => ({
      value: d.id.toString(),
      label: `${d.prenom} ${d.nom}`,
    }))
  }, [directeurs])

  const managerOptions = useMemo(() => {
    if (!managers) return []
    // Filtrer les managers selon le directeur sélectionné (pour les commerciaux)
    if (userType === 'commercial' && formData.directeurId && formData.directeurId !== 'none') {
      return managers
        .filter(m => m.directeurId === parseInt(formData.directeurId))
        .map(m => ({
          value: m.id.toString(),
          label: `${m.prenom} ${m.nom}`,
        }))
    }
    return managers.map(m => ({
      value: m.id.toString(),
      label: `${m.prenom} ${m.nom}`,
    }))
  }, [managers, formData.directeurId, userType])

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TypeIcon className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nom */}
          <div className="space-y-2">
            <Label htmlFor="nom">Nom *</Label>
            <Input
              id="nom"
              value={formData.nom}
              onChange={e => setFormData({ ...formData, nom: e.target.value })}
              placeholder="Nom de famille"
              className={errors.nom ? 'border-red-500' : ''}
            />
            {errors.nom && <p className="text-sm text-red-500">{errors.nom}</p>}
          </div>

          {/* Prénom */}
          <div className="space-y-2">
            <Label htmlFor="prenom">Prénom *</Label>
            <Input
              id="prenom"
              value={formData.prenom}
              onChange={e => setFormData({ ...formData, prenom: e.target.value })}
              placeholder="Prénom"
              className={errors.prenom ? 'border-red-500' : ''}
            />
            {errors.prenom && <p className="text-sm text-red-500">{errors.prenom}</p>}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemple.com"
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
          </div>

          {/* Téléphone */}
          <div className="space-y-2">
            <Label htmlFor="telephone">Téléphone</Label>
            <Input
              id="telephone"
              type="tel"
              value={userType === 'commercial' ? formData.numTel : formData.numTelephone}
              onChange={e =>
                setFormData({
                  ...formData,
                  [userType === 'commercial' ? 'numTel' : 'numTelephone']: e.target.value,
                })
              }
              placeholder="+33 XX XXX XXX"
            />
          </div>

          {/* Adresse (directeur seulement) */}
          {userType === 'directeur' && (
            <div className="space-y-2">
              <Label htmlFor="adresse">Adresse</Label>
              <Input
                id="adresse"
                value={formData.adresse}
                onChange={e => setFormData({ ...formData, adresse: e.target.value })}
                placeholder="Adresse complète"
              />
            </div>
          )}

          {/* Âge (commercial seulement) */}
          {userType === 'commercial' && (
            <div className="space-y-2">
              <Label htmlFor="age">Âge *</Label>
              <Input
                id="age"
                type="number"
                min="18"
                max="65"
                value={formData.age}
                onChange={e => setFormData({ ...formData, age: e.target.value })}
                placeholder="25"
                className={errors.age ? 'border-red-500' : ''}
              />
              {errors.age && <p className="text-sm text-red-500">{errors.age}</p>}
            </div>
          )}

          {/* Directeur (manager et commercial) */}
          {(userType === 'manager' || userType === 'commercial') && (
            <div className="space-y-2">
              <Label htmlFor="directeur">
                Directeur {userType === 'manager' ? '*' : '(optionnel)'}
              </Label>
              <Select
                value={formData.directeurId.toString()}
                onValueChange={value => {
                  setFormData({
                    ...formData,
                    directeurId: value,
                    managerId: value ? '' : formData.managerId,
                  })
                }}
                disabled={!!parentId && userType !== 'commercial'}
              >
                <SelectTrigger className={errors.directeurId ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Sélectionner un directeur" />
                </SelectTrigger>
                <SelectContent>
                  {userType === 'commercial' && <SelectItem value="none">Aucun</SelectItem>}
                  {directeurOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.directeurId && <p className="text-sm text-red-500">{errors.directeurId}</p>}
            </div>
          )}

          {/* Manager (commercial seulement) */}
          {userType === 'commercial' && (
            <div className="space-y-2">
              <Label htmlFor="manager">Manager (optionnel)</Label>
              <Select
                value={formData.managerId.toString()}
                onValueChange={value => setFormData({ ...formData, managerId: value })}
                disabled={!formData.directeurId || formData.directeurId === 'none' || !!parentId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun (commercial direct)</SelectItem>
                  {managerOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!formData.directeurId && (
                <p className="text-xs text-muted-foreground">
                  Sélectionnez d'abord un directeur pour voir les managers disponibles
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
