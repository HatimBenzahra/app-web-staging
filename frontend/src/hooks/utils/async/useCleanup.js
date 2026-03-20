/**
 * Hook pour gérer le cleanup de ressources de manière générique
 * Élimine la duplication dans useCommercialAutoAudio.js, useRecording.js, etc.
 */

import { useEffect, useRef, useCallback } from 'react'
import { logger } from '@/services/core'

/**
 * Hook pour gérer le cleanup de ressources
 * @param {Object} options - Options
 * @param {string} options.namespace - Namespace pour logs
 * @returns {Object} Fonctions de gestion cleanup
 */
export function useCleanup(options = {}) {
  const { namespace = 'Cleanup' } = options
  const cleanupFunctionsRef = useRef([])
  const resourcesRef = useRef(new Map())

  /**
   * Ajoute une fonction de cleanup
   * @param {Function} cleanupFn - Fonction de cleanup
   * @param {string} id - ID unique pour la ressource
   */
  const addCleanup = useCallback(
    (cleanupFn, id) => {
      if (id) {
        // Cleanup nommé - remplace le précédent s'il existe
        const existing = resourcesRef.current.get(id)
        if (existing) {
          cleanupFunctionsRef.current = cleanupFunctionsRef.current.filter(fn => fn !== existing)
        }
        resourcesRef.current.set(id, cleanupFn)
      }

      cleanupFunctionsRef.current.push(cleanupFn)
      logger.debug(namespace, `Cleanup ajouté${id ? ` (${id})` : ''}`)
    },
    [namespace]
  )

  /**
   * Supprime une fonction de cleanup spécifique
   * @param {string} id - ID de la ressource
   */
  const removeCleanup = useCallback(
    id => {
      const cleanupFn = resourcesRef.current.get(id)
      if (cleanupFn) {
        cleanupFunctionsRef.current = cleanupFunctionsRef.current.filter(fn => fn !== cleanupFn)
        resourcesRef.current.delete(id)
        logger.debug(namespace, `Cleanup supprimé (${id})`)
      }
    },
    [namespace]
  )

  /**
   * Exécute le cleanup d'une ressource spécifique
   * @param {string} id - ID de la ressource
   */
  const cleanupResource = useCallback(
    async id => {
      const cleanupFn = resourcesRef.current.get(id)
      if (cleanupFn) {
        try {
          await cleanupFn()
          logger.debug(namespace, `Ressource nettoyée (${id})`)
        } catch (error) {
          logger.error(namespace, `Erreur cleanup (${id}):`, error)
        } finally {
          removeCleanup(id)
        }
      }
    },
    [namespace, removeCleanup]
  )

  /**
   * Exécute tous les cleanups
   */
  const cleanupAll = useCallback(async () => {
    logger.debug(namespace, `Nettoyage ${cleanupFunctionsRef.current.length} ressources`)

    const cleanupPromises = cleanupFunctionsRef.current.map(async cleanupFn => {
      try {
        await cleanupFn()
      } catch (error) {
        logger.error(namespace, 'Erreur cleanup:', error)
      }
    })

    await Promise.allSettled(cleanupPromises)

    cleanupFunctionsRef.current = []
    resourcesRef.current.clear()
    logger.debug(namespace, 'Cleanup terminé')
  }, [namespace])

  // Cleanup automatique au démontage
  useEffect(() => {
    return () => {
      // Cleanup synchrone - pas d'async dans useEffect cleanup
      const fns = [...cleanupFunctionsRef.current]

      cleanupFunctionsRef.current = []
      // eslint-disable-next-line react-hooks/exhaustive-deps
      resourcesRef.current.clear()

      // Exécuter les cleanups en dehors du cycle React
      Promise.allSettled(
        fns.map(async cleanupFn => {
          try {
            await cleanupFn()
          } catch (error) {
            console.error(`${namespace} cleanup error:`, error)
          }
        })
      ).catch(err => console.error(`${namespace} cleanup failed:`, err))
    }
  }, [namespace]) // Dépendance stable

  return {
    addCleanup,
    removeCleanup,
    cleanupResource,
    cleanupAll,
    resourceCount: cleanupFunctionsRef.current.length,
  }
}

/**
 * Hook spécialisé pour les connexions (audio, WebSocket, etc.)
 * @param {Object} options - Options
 */
export function useConnectionCleanup(options = {}) {
  const cleanup = useCleanup({ ...options, namespace: 'Connection' })

  /**
   * Enregistre une connexion pour cleanup
   * @param {Object} connection - Objet connexion
   * @param {string} id - ID de la connexion
   * @param {Function} disconnectFn - Fonction de déconnexion
   */
  const addConnection = useCallback(
    (connection, id, disconnectFn) => {
      const cleanupFn = async () => {
        if (connection) {
          await disconnectFn(connection)
        }
      }
      cleanup.addCleanup(cleanupFn, id)
    },
    [cleanup]
  )

  /**
   * Déconnecte et nettoie une connexion spécifique
   * @param {string} id - ID de la connexion
   */
  const disconnect = useCallback(
    async id => {
      await cleanup.cleanupResource(id)
    },
    [cleanup]
  )

  return {
    ...cleanup,
    addConnection,
    disconnect,
  }
}

/**
 * Hook spécialisé pour les timers (timeouts, intervals)
 * @param {Object} options - Options
 */
export function useTimerCleanup(options = {}) {
  const cleanup = useCleanup({ ...options, namespace: 'Timer' })

  /**
   * Ajoute un timeout pour cleanup automatique
   * @param {number} timeoutId - ID du timeout
   * @param {string} name - Nom du timer
   */
  const addTimeout = useCallback(
    (timeoutId, name) => {
      const cleanupFn = () => clearTimeout(timeoutId)
      cleanup.addCleanup(cleanupFn, name || `timeout-${timeoutId}`)
    },
    [cleanup]
  )

  /**
   * Ajoute un interval pour cleanup automatique
   * @param {number} intervalId - ID de l'interval
   * @param {string} name - Nom du timer
   */
  const addInterval = useCallback(
    (intervalId, name) => {
      const cleanupFn = () => clearInterval(intervalId)
      cleanup.addCleanup(cleanupFn, name || `interval-${intervalId}`)
    },
    [cleanup]
  )

  return {
    ...cleanup,
    addTimeout,
    addInterval,
  }
}

/**
 * Hook spécialisé pour les streams et media
 * @param {Object} options - Options
 */
export function useMediaCleanup(options = {}) {
  const cleanup = useCleanup({ ...options, namespace: 'Media' })

  /**
   * Ajoute un stream pour cleanup automatique
   * @param {MediaStream} stream - Stream média
   * @param {string} id - ID du stream
   */
  const addStream = useCallback(
    (stream, id) => {
      const cleanupFn = () => {
        if (stream && stream.getTracks) {
          stream.getTracks().forEach(track => {
            track.stop()
          })
        }
      }
      cleanup.addCleanup(cleanupFn, id || 'media-stream')
    },
    [cleanup]
  )

  /**
   * Ajoute un élément audio/video pour cleanup
   * @param {HTMLAudioElement|HTMLVideoElement} element - Élément média
   * @param {string} id - ID de l'élément
   */
  const addMediaElement = useCallback(
    (element, id) => {
      const cleanupFn = () => {
        if (element) {
          element.pause()
          element.src = ''
          element.load()
        }
      }
      cleanup.addCleanup(cleanupFn, id || 'media-element')
    },
    [cleanup]
  )

  return {
    ...cleanup,
    addStream,
    addMediaElement,
  }
}

export default useCleanup
