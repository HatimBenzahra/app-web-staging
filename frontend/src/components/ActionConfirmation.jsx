import React from 'react'
import { Check, X, AlertTriangle, Info, Plus, Edit3 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/ui/use-theme'
import { getErrorMessage, logError } from '@/services'

const actionTypes = {
  delete: {
    icon: AlertTriangle,
    iconColor: 'text-red-600 dark:text-red-400',
    iconBg: 'bg-red-100 dark:bg-red-900/20',
    confirmVariant: 'destructive',
  },
  add: {
    icon: Plus,
    iconColor: 'text-green-600 dark:text-green-400',
    iconBg: 'bg-green-100 dark:bg-green-900/20',
    confirmVariant: 'default',
  },
  edit: {
    icon: Edit3,
    iconColor: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900/20',
    confirmVariant: 'default',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900/20',
    confirmVariant: 'default',
  },
}

/**
 * Composant généraliste pour les confirmations d'actions
 *
 * Exemple d'utilisation:
 * ```jsx
 * function MyComponent() {
 *   const [isOpen, setIsOpen] = useState(false)
 *
 *   const handleAction = async () => {
 *     // Logic de l'action
 *     console.log('Action exécutée')
 *     setIsOpen(false)
 *   }
 *
 *   return (
 *     <>
 *       <button onClick={() => setIsOpen(true)}>Action</button>
 *       <ActionConfirmation
 *         isOpen={isOpen}
 *         onClose={() => setIsOpen(false)}
 *         onConfirm={handleAction}
 *         type="delete"
 *         title="Supprimer la zone"
 *         description="Cette action supprimera définitivement la zone."
 *         itemName="zone 'Marketing Nord'"
 *         confirmText="Supprimer"
 *         cancelText="Annuler"
 *       />
 *     </>
 *   )
 * }
 * ```
 */
export function ActionConfirmation({
  isOpen,
  onClose,
  onConfirm,
  type = 'info',
  title = "Confirmer l'action",
  description = 'Voulez-vous continuer ?',
  itemName,
  isLoading = false,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  showCancel = true,
  maxWidth = 'sm:max-w-md',
}) {
  const { isDark: _isDark } = useTheme()
  const actionConfig = actionTypes[type] || actionTypes.info
  const IconComponent = actionConfig.icon

  const handleConfirm = async () => {
    try {
      await onConfirm()
    } catch (error) {
      logError(error, 'ActionConfirmation.handleConfirm')
      throw new Error(getErrorMessage(error))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${maxWidth}`}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${actionConfig.iconBg}`}
            >
              <IconComponent className={`h-5 w-5 ${actionConfig.iconColor}`} />
            </div>
            <div>
              <DialogTitle className="text-left">{title}</DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <DialogDescription className="text-left">{description}</DialogDescription>

          {itemName && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium text-foreground">Élément concerné :</p>
              <p className="text-sm text-muted-foreground font-mono">{itemName}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {showCancel && (
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              {cancelText}
            </Button>
          )}
          <Button
            type="button"
            variant={actionConfig.confirmVariant}
            onClick={handleConfirm}
            disabled={isLoading}
            className="min-w-[100px]"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>En cours...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {type === 'delete' && <X className="h-4 w-4" />}
                {type === 'add' && <Plus className="h-4 w-4" />}
                {type === 'edit' && <Edit3 className="h-4 w-4" />}
                {(type === 'info' || !['delete', 'add', 'edit'].includes(type)) && (
                  <Check className="h-4 w-4" />
                )}
                <span>{confirmText}</span>
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
