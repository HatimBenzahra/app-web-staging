import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const ToastContext = React.createContext({})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([])

  const addToast = React.useCallback(toast => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast = { ...toast, id }
    setToasts(prev => [...prev, newToast])

    if (toast.duration !== Infinity) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, toast.duration || 5000)
    }

    return id
  }, [])

  const removeToast = React.useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }

  // Mémoïser l'objet retourné pour éviter les re-renders infinis
  return React.useMemo(
    () => ({
      toast: context.addToast,
      dismiss: context.removeToast,
    }),
    [context.addToast, context.removeToast]
  )
}

// Hook interne pour le Toaster qui accède directement au contexte
function useToastContext() {
  return React.useContext(ToastContext)
}

function Toaster() {
  const { toasts, removeToast } = useToastContext()

  return (
    <div className="fixed top-0 right-0 z-50 flex max-h-screen w-full flex-col gap-2 p-4 sm:top-auto sm:bottom-0 sm:right-0 sm:flex-col md:max-w-[420px]">
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

const toastVariants = {
  default: 'bg-background border-border',
  success: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
  error: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
  warning: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800',
  info: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
}

const toastTextVariants = {
  default: 'text-foreground',
  success: 'text-green-900 dark:text-green-100',
  error: 'text-red-900 dark:text-red-100',
  warning: 'text-yellow-900 dark:text-yellow-100',
  info: 'text-blue-900 dark:text-blue-100',
}

function Toast({ title, description, variant = 'default', onClose, action }) {
  return (
    <div
      className={cn(
        'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all',
        toastVariants[variant]
      )}
    >
      <div className="grid gap-1 flex-1">
        {title && (
          <div className={cn('text-sm font-semibold', toastTextVariants[variant])}>{title}</div>
        )}
        {description && (
          <div className={cn('text-sm opacity-90', toastTextVariants[variant])}>{description}</div>
        )}
        {action && <div className="mt-2">{action}</div>}
      </div>
      <button
        onClick={onClose}
        className={cn(
          'absolute right-2 top-2 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100',
          toastTextVariants[variant]
        )}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
