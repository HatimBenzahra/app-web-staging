import React, { useState, useEffect } from 'react'
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
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  MapPin,
  Building2,
  ArrowUp,
  Key,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  X,
} from 'lucide-react'

const STEPS = [
  {
    id: 'address',
    title: 'Adresse',
    description: "Localisation de l'immeuble",
    icon: MapPin,
  },
  {
    id: 'details',
    title: 'Détails',
    description: 'Configuration du bâtiment',
    icon: Building2,
  },
  {
    id: 'access',
    title: 'Accès',
    description: "Informations d'accès",
    icon: Key,
  },
]



export default function AddImmeubleModal({ open, onOpenChange, onSave }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [addressSuggestions, setAddressSuggestions] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [isAddressSelected, setIsAddressSelected] = useState(false)
  const [formData, setFormData] = useState({
    adresse: '',
    complementAdresse: '',
    nbEtages: '',
    nbPortesParEtage: '',
    ascenseurPresent: false,
    digitalCode: '',
    latitude: null,
    longitude: null,
  })
  const [errors, setErrors] = useState({})

  // Mapbox access token - should be in env file
  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN


  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      setCurrentStep(0)
      setFormData({
        adresse: '',
        complementAdresse: '',
        nbEtages: '',
        nbPortesParEtage: '',
        ascenseurPresent: false,
        digitalCode: '',
        latitude: null,
        longitude: null,
      })
      setErrors({})
      setAddressSuggestions([])
      setIsAddressSelected(false)
    }
  }, [open])

  // Nettoyer les suggestions d'adresse lors du changement d'étape
  // pour éviter les erreurs de manipulation DOM
  useEffect(() => {
    // Toujours nettoyer les suggestions quand on quitte l'étape 0 (adresse)
    if (currentStep !== 0) {
      setAddressSuggestions([])
    }
  }, [currentStep])

  // Debounced address search with Mapbox
  useEffect(() => {
    // Ne pas rechercher si l'adresse vient d'être sélectionnée
    if (isAddressSelected) {
      return
    }

    const timeoutId = setTimeout(() => {
      if (formData.adresse && formData.adresse.length > 2 && MAPBOX_TOKEN) {
        searchAddresses(formData.adresse)
      } else {
        setAddressSuggestions([])
      }
    }, 300)

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.adresse])

  const searchAddresses = async query => {
    if (!MAPBOX_TOKEN) {
      console.warn('⚠️ VITE_MAPBOX_ACCESS_TOKEN not found in environment variables')
      return
    }

    setLoadingSuggestions(true)
    try {
      // Pour l'Île-de-France : country=fr, types pour avoir adresses + lieux
      // proximity pour favoriser les résultats autour de Paris (2.3522, 48.8566)
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?access_token=${MAPBOX_TOKEN}&country=fr&proximity=2.3522,48.8566&types=address,poi&limit=8&language=fr`

      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Error details:', errorData)
        setAddressSuggestions([])
        return
      }

      const data = await response.json()

      setAddressSuggestions(data.features || [])
    } catch (error) {
      console.error('❌ Error fetching address suggestions:', error)
      setAddressSuggestions([])
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))

    // Si l'utilisateur modifie l'adresse manuellement, on réinitialise la sélection
    if (field === 'adresse') {
      setIsAddressSelected(false)
    }

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null,
      }))
    }
  }

  const selectAddress = address => {
    // Marquer que l'adresse a été sélectionnée pour éviter une nouvelle recherche
    setIsAddressSelected(true)
    setAddressSuggestions([])

    // Extraire les coordonnées de Mapbox (format: [longitude, latitude])
    const coordinates = address.geometry?.coordinates
    const longitude = coordinates?.[0] || null
    const latitude = coordinates?.[1] || null

    // Modifier directement formData sans passer par handleInputChange
    setFormData(prev => ({
      ...prev,
      adresse: address.place_name,
      latitude,
      longitude,
    }))

    // Effacer l'erreur si elle existe
    if (errors.adresse) {
      setErrors(prev => ({
        ...prev,
        adresse: null,
      }))
    }
  }

  const validateStep = stepIndex => {
    const newErrors = {}

    switch (stepIndex) {
      case 0: // Address step
        if (!formData.adresse.trim()) {
          newErrors.adresse = "L'adresse est requise"
        } else if (MAPBOX_TOKEN && !isAddressSelected) {
          newErrors.adresse = 'Veuillez sélectionner une adresse depuis les suggestions'
        }
        break

      case 1: // Details step
        if (!formData.nbEtages || parseInt(formData.nbEtages) < 1) {
          newErrors.nbEtages = "Le nombre d'étages doit être supérieur à 0"
        }
        if (!formData.nbPortesParEtage || parseInt(formData.nbPortesParEtage) < 1) {
          newErrors.nbPortesParEtage = 'Le nombre de portes par étage doit être supérieur à 0'
        }
        break

      case 2: // Access step - no required validation needed
        break

      default:
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      // Nettoyer les suggestions d'adresse avant de changer d'étape
      // pour éviter les erreurs DOM lors du démontage
      setAddressSuggestions([])
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1))
    }
  }

  const prevStep = () => {
    // Nettoyer les suggestions d'adresse avant de changer d'étape
    setAddressSuggestions([])
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return

    setLoading(true)
    try {
      // Combiner l'adresse et le complément
      const adresseComplete = formData.complementAdresse.trim()
        ? `${formData.adresse}, ${formData.complementAdresse.trim()}`
        : formData.adresse

      const immeubleData = {
        adresse: adresseComplete,
        latitude: formData.latitude,
        longitude: formData.longitude,
        nbEtages: parseInt(formData.nbEtages),
        nbPortesParEtage: parseInt(formData.nbPortesParEtage),
        ascenseurPresent: formData.ascenseurPresent,
        digitalCode: formData.digitalCode.trim() || null,
      }

      await onSave(immeubleData)
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving immeuble:', error)
    } finally {
      setLoading(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Address step
        return (
          <div className="space-y-6">
            <div className="space-y-2 relative">
              <Label
                htmlFor="adresse"
                className="text-black font-semibold text-gray-900"
              >
                Adresse de l'immeuble *
              </Label>
              <div className="relative">
                <Input
                  id="adresse"
                  value={formData.adresse}
                  onChange={e => handleInputChange('adresse', e.target.value)}
                  placeholder="Tapez une adresse..."
                  className={`h-12 text-black ${errors.adresse ? 'border-red-500' : 'border-gray-300'} ${formData.adresse ? 'pr-10' : ''}`}
                  autoComplete="off"
                />
                {/* Bouton pour effacer */}
                {formData.adresse && !loadingSuggestions && (
                  <button
                    type="button"
                    onClick={() => {
                      handleInputChange('adresse', '')
                      setAddressSuggestions([])
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-full transition-colors z-10"
                    aria-label="Effacer l'adresse"
                  >
                    <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
                {loadingSuggestions && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  </div>
                )}
              </div>
              {errors.adresse && <p className="text-sm text-red-500 mt-1">{errors.adresse}</p>}

              {/* Address suggestions dropdown */}
              {addressSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1">
                  <div className="bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
                    {/* Header with result count */}
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">
                        {addressSuggestions.length} résultat{addressSuggestions.length > 1 ? 's' : ''}
                      </span>
                      <span className="text-[10px] text-gray-400">Sélectionnez une adresse</span>
                    </div>
                    
                    {/* Scrollable list */}
                    <div className="max-h-[200px] overflow-y-auto">
                      {addressSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors flex items-center gap-3"
                          onClick={() => selectAddress(suggestion)}
                        >
                          <MapPin className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate text-sm">
                              {suggestion.text}
                            </div>
                            <div className="text-gray-500 truncate text-xs">
                              {suggestion.place_name}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!MAPBOX_TOKEN && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-lg text-sm border border-amber-200">
                  <span className="text-lg">⚠️</span>
                  Configuration Mapbox manquante - saisie manuelle uniquement
                </div>
              )}
            </div>

            {/* Complément d'adresse (optionnel) */}
            <div className="space-y-2">
              <Label
                htmlFor="complementAdresse"
                className="text-black font-semibold text-gray-900"
              >
                Complément d'adresse (optionnel)
              </Label>
              <Input
                id="complementAdresse"
                value={formData.complementAdresse}
                onChange={e => handleInputChange('complementAdresse', e.target.value)}
                placeholder="Ex: Appartement 12, Bâtiment A, Porte 3..."
                className="h-12 text-black border-gray-300"
              />
              <p className="text-sm text-gray-500">
                Numéro d'appartement, bâtiment, étage, ou toute information complémentaire
              </p>
            </div>
          </div>
        )

      case 1: // Details step
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label
                  htmlFor="nbEtages"
                  className="text-black font-semibold text-gray-900"
                >
                  Nombre d'étages *
                </Label>
                <Input
                  id="nbEtages"
                  type="number"
                  min="1"
                  value={formData.nbEtages}
                  onChange={e => handleInputChange('nbEtages', e.target.value)}
                  placeholder="Ex: 5"
                  className={`h-12 text-black ${errors.nbEtages ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.nbEtages && <p className="text-sm text-red-500">{errors.nbEtages}</p>}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="nbPortesParEtage"
                  className="text-black font-semibold text-gray-900"
                >
                  Portes par étage *
                </Label>
                <Input
                  id="nbPortesParEtage"
                  type="number"
                  min="1"
                  value={formData.nbPortesParEtage}
                  onChange={e => handleInputChange('nbPortesParEtage', e.target.value)}
                  placeholder="Ex: 4"
                  className={`h-12 text-black ${errors.nbPortesParEtage ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.nbPortesParEtage && (
                  <p className="text-sm text-red-500">{errors.nbPortesParEtage}</p>
                )}
              </div>
            </div>

            {/* Summary card */}
            {formData.nbEtages && formData.nbPortesParEtage && (
              <div className="p-5 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                    Total estimé
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {parseInt(formData.nbEtages) * parseInt(formData.nbPortesParEtage)} <span className="text-lg font-normal text-gray-500">portes</span>
                  </p>
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                    <span>{formData.nbEtages} étages</span>
                    <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                    <span>{formData.nbPortesParEtage} portes/étage</span>
                  </p>
                </div>
                <div className="p-3 rounded-full bg-white border border-gray-200 shadow-sm">
                  <Building2 className="h-8 w-8 text-gray-400" />
                </div>
              </div>
            )}
          </div>
        )

      case 2: // Access step
        return (
          <div className="space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                <div className="space-y-1">
                  <Label className="text-black font-semibold text-gray-900">
                    Ascenseur présent
                  </Label>
                  <p className="text-sm text-gray-500">
                    Y a-t-il un ascenseur dans cet immeuble ?
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <ArrowUp className="h-6 w-6 text-gray-400" />
                  <input
                    type="checkbox"
                    id="ascenseurPresent"
                    checked={formData.ascenseurPresent}
                    onChange={e => handleInputChange('ascenseurPresent', e.target.checked)}
                    className="w-6 h-6 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="digitalCode"
                  className="text-black font-semibold text-gray-900"
                >
                  Code d'accès digital (optionnel)
                </Label>
                <div className="relative">
                  <Input
                    id="digitalCode"
                    value={formData.digitalCode}
                    onChange={e => handleInputChange('digitalCode', e.target.value)}
                    placeholder="Ex: 1234A"
                    className="h-12 pl-10 text-black border-gray-300"
                  />
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">
                  Laissez vide si aucun code d'accès
                </p>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const _currentStepData = STEPS[currentStep]
  const isLastStep = currentStep === STEPS.length - 1
  const isFirstStep = currentStep === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={`
          flex flex-col p-0 overflow-hidden bg-white border border-gray-200 shadow-xl rounded-xl transition-all duration-300
          !top-[1%] !translate-y-0 w-[98%] sm:w-[95%] md:w-[95%] lg:w-[90%] h-[60%]
        `}
      >
        <DialogHeader className="px-5 py-4 border-b border-gray-100 flex-shrink-0 bg-white">
          <DialogTitle className="text-xl font-bold text-gray-900 leading-tight">
            Ajouter un immeuble
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Remplissez les informations de l'immeuble en suivant les étapes
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="py-2 px-0 overflow-x-hidden flex-none bg-gray-50/50 border-b border-gray-100">
          <div className="flex items-start justify-between px-6">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon
              const isActive = index === currentStep
              const isCompleted = index < currentStep

              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center flex-1 min-w-0">
                    {/* Circle with icon */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-all ${
                        isCompleted
                          ? 'bg-green-600 border-green-600 text-white'
                          : isActive
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                            : 'border-gray-300 text-gray-400 bg-white'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <StepIcon className="h-5 w-5" />
                      )}
                    </div>

                    {/* Text labels */}
                    <div className="text-center mt-2 w-full">
                      <div
                        className={`text-xs font-bold uppercase tracking-wider ${
                          isActive
                            ? 'text-blue-600'
                            : 'text-gray-500'
                        }`}
                      >
                        {step.title}
                      </div>
                    </div>
                  </div>

                  {/* Connector line */}
                  {index < STEPS.length - 1 && (
                    <div className="flex items-center pt-5 flex-1 mx-2">
                      <div
                        className={`w-full h-0.5 transition-colors ${
                          index < currentStep
                            ? 'bg-green-600'
                            : 'bg-gray-200'
                        }`}
                      />
                    </div>
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {/* Step content - Prend tout l'espace disponible avec scroll */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0 bg-white">
          <div className="max-w-xl mx-auto w-full">
            {renderStepContent()}
          </div>
        </div>

        {/* Footer buttons */}
        <DialogFooter className="p-4 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
          <div className="flex w-full gap-3 flex-col-reverse sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              onClick={isFirstStep ? () => onOpenChange(false) : prevStep}
              className="h-12 px-6 text-black font-medium border-gray-300 hover:bg-white hover:text-gray-900"
            >
              {isFirstStep ? (
                'Annuler'
              ) : (
                <>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Précédent
                </>
              )}
            </Button>

            {isLastStep ? (
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="h-12 px-6 text-black font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Créer l'immeuble
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white shadow-md"
              >
                Suivant
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
