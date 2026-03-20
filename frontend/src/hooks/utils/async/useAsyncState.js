/**
 * Hook générique pour gérer les états asynchrones (loading/error/data)
 * Élimine la duplication dans use-api.ts, use-page-loading.js, useActiveRooms.js
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { logger } from '@/services/core'
import { useErrorToast } from '../ui/use-error-toast'

/**
 * Configuration pour useAsyncState
 * @typedef {Object} AsyncStateConfig
 * @property {string} [namespace] - Namespace pour les logs
 * @property {boolean} [retryEnabled] - Activer le retry automatique
 * @property {number[]} [retryDelays] - Délais de retry en ms [1000, 2000, 4000]
 * @property {Function} [onSuccess] - Callback de succès
 * @property {Function} [onError] - Callback d'erreur
 * @property {boolean} [resetOnExecute] - Reset data/error avant nouvelle exécution
 * @property {boolean} [showToasts] - Afficher les toasts d'erreur/succès
 * @property {string} [successMessage] - Message de succès personnalisé
 */

/**
 * Hook pour gérer les états asynchrones avec retry et callbacks
 * @param {AsyncStateConfig} config - Configuration
 * @returns {Object} État et actions
 */
export function useAsyncState(config = {}) {
  const {
    namespace = 'AsyncState',
    retryEnabled = false,
    retryDelays = [1000, 2000, 4000],
    onSuccess,
    onError,
    resetOnExecute = true,
    showToasts = false,
    successMessage,
  } = config

  const [state, setState] = useState({
    data: null,
    loading: false,
    error: null,
  })

  const retryCountRef = useRef(0)
  const abortControllerRef = useRef(null)

  // Hook pour les toasts - toujours appelé
  const { showError, showSuccess } = useErrorToast()

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  /**
   * Exécute une fonction asynchrone avec gestion d'état
   */
  const execute = useCallback(
    async (asyncFn, ...args) => {
      // Annuler la requête précédente
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      // Reset état si demandé
      if (resetOnExecute) {
        setState(prev => ({
          ...prev,
          loading: true,
          error: null,
        }))
      } else {
        setState(prev => ({ ...prev, loading: true }))
      }

      try {
        logger.debug(namespace, 'Exécution fonction async...', { args })

        const result = await asyncFn(...args, controller.signal)

        // Vérifier si annulé
        if (controller.signal.aborted) return

        setState({
          data: result,
          loading: false,
          error: null,
        })

        retryCountRef.current = 0
        onSuccess?.(result)

        // Toast de succès si activé
        if (showToasts && showSuccess && successMessage) {
          showSuccess(successMessage)
        }

        logger.debug(namespace, 'Succès', { result })

        return result
      } catch (error) {
        // Vérifier si annulé
        if (controller.signal.aborted) return

        const errorMessage = error?.message || 'Erreur inconnue'
        logger.error(namespace, 'Erreur:', error)

        // Retry automatique si activé
        if (retryEnabled && retryCountRef.current < retryDelays.length) {
          const delay = retryDelays[retryCountRef.current]
          retryCountRef.current++

          logger.info(
            namespace,
            `Retry ${retryCountRef.current}/${retryDelays.length} dans ${delay}ms`
          )

          setTimeout(() => {
            if (!controller.signal.aborted) {
              execute(asyncFn, ...args)
            }
          }, delay)

          return
        }

        setState({
          data: null,
          loading: false,
          error: errorMessage,
        })

        retryCountRef.current = 0

        // Toast d'erreur si activé
        if (showToasts && showError) {
          showError(error, namespace)
        }

        onError?.(error)
        throw error
      }
    },
    [
      namespace,
      retryEnabled,
      retryDelays,
      onSuccess,
      onError,
      resetOnExecute,
      showError,
      showSuccess,
      showToasts,
      successMessage,
    ]
  )

  /**
   * Reset l'état
   */
  const reset = useCallback(() => {
    abortControllerRef.current?.abort()
    setState({
      data: null,
      loading: false,
      error: null,
    })
    retryCountRef.current = 0
  }, [])

  /**
   * Met à jour les données directement
   */
  const setData = useCallback(data => {
    setState(prev => ({
      ...prev,
      data,
      error: null,
    }))
  }, [])

  /**
   * Met à jour l'erreur directement
   */
  const setError = useCallback(error => {
    setState(prev => ({
      ...prev,
      error: error?.message || error,
      loading: false,
    }))
  }, [])

  return {
    // État
    ...state,
    isLoading: state.loading,
    hasError: !!state.error,
    hasData: !!state.data,

    // Actions
    execute,
    reset,
    setData,
    setError,

    // Métadonnées
    retryCount: retryCountRef.current,
    canRetry: retryEnabled && retryCountRef.current < retryDelays.length,
  }
}

/**
 * Hook simplifié pour une seule fonction asynchrone (cas le plus courant)
 * @param {Function} asyncFn - Fonction asynchrone à exécuter
 * @param {AsyncStateConfig} config - Configuration
 * @returns {Object} État et actions
 */
export function useAsyncFunction(asyncFn, config = {}) {
  const asyncState = useAsyncState(config)

  const execute = useCallback(
    (...args) => asyncState.execute(asyncFn, ...args),
    [asyncState, asyncFn]
  )

  return {
    ...asyncState,
    execute,
  }
}

export default useAsyncState
