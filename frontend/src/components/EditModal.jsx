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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Modal de modification réutilisable
 * @param {Object} props
 * @param {boolean} props.open - État d'ouverture du modal
 * @param {Function} props.onOpenChange - Fonction pour changer l'état d'ouverture
 * @param {string} props.title - Titre du modal
 * @param {string} props.description - Description du modal
 * @param {Object} props.data - Données à éditer
 * @param {Array} props.fields - Configuration des champs à afficher
 * @param {Function} props.onSave - Fonction appelée lors de la sauvegarde
 */
export default function EditModal({
  open,
  onOpenChange,
  title,
  description,
  data,
  fields,
  onSave,
}) {
  const [formData, setFormData] = useState({})
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (data) {
      setFormData(data)
    }
  }, [data])

  const handleChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      [key]: value,
    }))
    // Clear error when user starts typing
    if (errors[key]) {
      setErrors(prev => ({
        ...prev,
        [key]: null,
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}
    fields.forEach(field => {
      if (field.required && !formData[field.key]) {
        newErrors[field.key] = 'Ce champ est requis'
      }
      if (field.validate) {
        const error = field.validate(formData[field.key])
        if (error) {
          newErrors[field.key] = error
        }
      }
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData)
      onOpenChange(false)
    }
  }

  const handleCancel = () => {
    setFormData(data)
    setErrors({})
    onOpenChange(false)
  }

  const renderField = field => {
    const value = formData[field.key] || ''

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'number':
        return (
          <Input
            type={field.type}
            value={value}
            onChange={e => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={errors[field.key] ? 'border-red-500' : ''}
          />
        )

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={e => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              errors[field.key] ? 'border-red-500' : ''
            }`}
            rows={4}
          />
        )

      case 'select':
        return (
          <Select value={value} onValueChange={val => handleChange(field.key, val)}>
            <SelectTrigger className={errors[field.key] ? 'border-red-500' : ''}>
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={e => handleChange(field.key, e.target.value)}
            className={errors[field.key] ? 'border-red-500' : ''}
          />
        )

      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={e => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={errors[field.key] ? 'border-red-500' : ''}
          />
        )
    }
  }

  // Group fields by section if sections are defined
  const groupedFields = fields.reduce((acc, field) => {
    const section = field.section || 'default'
    if (!acc[section]) {
      acc[section] = []
    }
    acc[section].push(field)
    return acc
  }, {})

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <Separator className="my-4" />

        <div className="space-y-6 py-4">
          {Object.entries(groupedFields).map(([section, sectionFields]) => (
            <div key={section}>
              {section !== 'default' && (
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">{section}</h3>
                  <Separator className="mt-2" />
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                {sectionFields.map(field => (
                  <div key={field.key} className={field.fullWidth ? 'md:col-span-2' : ''}>
                    <Label htmlFor={field.key} className="mb-2">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {renderField(field)}
                    {errors[field.key] && (
                      <p className="text-xs text-red-500 mt-1">{errors[field.key]}</p>
                    )}
                    {field.hint && (
                      <p className="text-xs text-muted-foreground mt-1">{field.hint}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Separator className="my-4" />

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Annuler
          </Button>
          <Button onClick={handleSave}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
