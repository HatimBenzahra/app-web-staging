/**
 * Hook pour gérer les erreurs dans les composants React
 * Permet de capturer et gérer les erreurs de manière élégante
 */

import { useCallback, useEffect } from 'react'
import { useToast } from '@/components/ui/toast'
import { errorHandler } from '@/utils/errorHandler'

export function useErrorHandler() {
  const { toast } = useToast()

  /**
   * Gérer une erreur avec affichage d'un toast
   */
  const handleError = useCallback(
    (error, options = {}) => {
      const {
        title = 'Une erreur est survenue',
        description = error?.message || 'Veuillez réessayer',
        showToast = true,
        logError = true,
      } = options

      // Logger l'erreur
      if (logError) {
        errorHandler.logError({
          type: 'handled',
          message: error?.message || error,
          error: error,
          stack: error?.stack,
          timestamp: new Date().toISOString(),
          url: window.location.href,
        })
      }

      // Afficher un toast
      if (showToast) {
        toast({
          title,
          description,
          variant: 'error',
        })
      }

      return error
    },
    [toast]
  )

  /**
   * Wrapper pour les fonctions async avec gestion d'erreur automatique
   */
  const withErrorHandler = useCallback(
    (asyncFn, options = {}) => {
      return async (...args) => {
        try {
          return await asyncFn(...args)
        } catch (error) {
          handleError(error, options)
          throw error // Re-throw pour permettre une gestion supplémentaire si nécessaire
        }
      }
    },
    [handleError]
  )

  /**
   * Wrapper pour les event handlers avec gestion d'erreur
   */
  const safeHandler = useCallback(
    (handler, options = {}) => {
      return (...args) => {
        try {
          return handler(...args)
        } catch (error) {
          handleError(error, options)
        }
      }
    },
    [handleError]
  )

  /**
   * Écouter les erreurs globales et afficher des toasts
   */
  useEffect(() => {
    const unsubscribe = errorHandler.addListener(error => {
      // Afficher un toast seulement pour les erreurs critiques
      if (error.type === 'promise' || error.type === 'javascript') {
        toast({
          title: 'Erreur détectée',
          description: "Une erreur inattendue s'est produite. L'équipe technique a été notifiée.",
          variant: 'error',
        })
      }
    })

    return unsubscribe
  }, [toast])

  return {
    handleError,
    withErrorHandler,
    safeHandler,
  }
}

/**
 * Hook simplifié pour gérer les erreurs async
 */
export function useAsyncError() {
  const { handleError, withErrorHandler } = useErrorHandler()

  return { handleError, withErrorHandler }
}
