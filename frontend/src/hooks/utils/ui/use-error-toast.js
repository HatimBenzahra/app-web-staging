/**
 * @fileoverview Hook pour gérer l'affichage des erreurs avec toast
 * Intègre la gestion d'erreurs centralisée avec les notifications visuelles
 */

import { useCallback } from 'react'
import { useToast } from '@/components/ui/toast'
import {
  isGraphQLClientError,
  getErrorMessage,
  logError,
  ErrorType,
} from '@/services/core'

/**
 * Hook personnalisé pour gérer les erreurs avec toast
 * @returns {Object} Fonctions pour gérer les erreurs
 */
export function useErrorToast() {
  const { toast } = useToast()

  /**
   * Affiche un toast d'erreur avec message convivial
   * @param {unknown} error - L'erreur à afficher
   * @param {string} context - Contexte de l'erreur (ex: 'Commerciaux.handleCreate')
   * @param {Object} options - Options supplémentaires
   */
  const showError = useCallback(
    (error, context, options = {}) => {
      // Logger l'erreur
      logError(error, context)

      // Obtenir le message utilisateur
      const message = getErrorMessage(error)

      // Déterminer le titre selon le type d'erreur
      let title = 'Erreur'
      if (isGraphQLClientError(error)) {
        switch (error.type) {
          case ErrorType.NETWORK:
            title = 'Problème de connexion'
            break
          case ErrorType.AUTHENTICATION:
            title = 'Authentification requise'
            break
          case ErrorType.AUTHORIZATION:
            title = 'Accès refusé'
            break
          case ErrorType.VALIDATION:
            title = 'Données invalides'
            break
          case ErrorType.NOT_FOUND:
            title = 'Ressource introuvable'
            break
          case ErrorType.SERVER:
            title = 'Erreur serveur'
            break
          default:
            title = 'Erreur'
        }
      }

      // Afficher le toast
      toast({
        title,
        description: message,
        variant: 'error',
        duration: options.duration || 5000,
        ...options,
      })
    },
    [toast]
  )

  /**
   * Affiche un toast de succès
   */
  const showSuccess = useCallback(
    (message, options = {}) => {
      toast({
        title: options.title || 'Succès',
        description: message,
        variant: 'success',
        duration: options.duration || 3000,
        ...options,
      })
    },
    [toast]
  )

  /**
   * Affiche un toast d'avertissement
   */
  const showWarning = useCallback(
    (message, options = {}) => {
      toast({
        title: options.title || 'Attention',
        description: message,
        variant: 'warning',
        duration: options.duration || 4000,
        ...options,
      })
    },
    [toast]
  )

  /**
   * Affiche un toast d'information
   */
  const showInfo = useCallback(
    (message, options = {}) => {
      toast({
        title: options.title || 'Information',
        description: message,
        variant: 'info',
        duration: options.duration || 4000,
        ...options,
      })
    },
    [toast]
  )

  return {
    showError,
    showSuccess,
    showWarning,
    showInfo,
  }
}
