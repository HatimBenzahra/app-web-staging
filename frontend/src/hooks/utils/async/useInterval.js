/**
 * Hook pour gérer les intervals avec cleanup automatique
 * Élimine la duplication dans useActiveRooms.js et autres
 */

import { useEffect, useRef, useCallback } from 'react'
import { logger } from '@/services/core'

/**
 * Hook pour gérer un interval avec cleanup automatique
 * @param {Function} callback - Fonction à exécuter
 * @param {number|null} delay - Délai en ms (null = pause)
 * @param {Object} options - Options
 * @param {boolean} options.immediate - Exécuter immédiatement (défaut: false)
 * @param {string} options.namespace - Namespace pour logs
 * @returns {Object} Contrôles de l'interval
 */
export function useInterval(callback, delay, options = {}) {
  const { immediate = false, namespace = 'Interval' } = options
  const savedCallback = useRef(callback)
  const intervalRef = useRef(null)
  const countRef = useRef(0)

  // Se souvenir du callback le plus récent
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  // Fonction pour démarrer l'interval
  const start = useCallback(() => {
    if (intervalRef.current || delay === null) return

    logger.debug(namespace, `Démarrage interval: ${delay}ms`)

    if (immediate) {
      try {
        savedCallback.current()
        countRef.current++
      } catch (error) {
        logger.error(namespace, 'Erreur exécution immédiate:', error)
      }
    }

    intervalRef.current = setInterval(() => {
      try {
        savedCallback.current()
        countRef.current++
        logger.debug(namespace, `Exécution #${countRef.current}`)
      } catch (error) {
        logger.error(namespace, 'Erreur exécution interval:', error)
      }
    }, delay)
  }, [delay, immediate, namespace])

  // Fonction pour arrêter l'interval
  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
      logger.debug(namespace, 'Interval arrêté')
    }
  }, [namespace])

  // Fonction pour redémarrer l'interval
  const restart = useCallback(() => {
    stop()
    countRef.current = 0
    start()
  }, [stop, start])

  // Fonction pour forcer une exécution immédiate
  const trigger = useCallback(() => {
    try {
      savedCallback.current()
      countRef.current++
      logger.debug(namespace, `Exécution forcée #${countRef.current}`)
    } catch (error) {
      logger.error(namespace, 'Erreur exécution forcée:', error)
    }
  }, [namespace])

  // Gestion automatique de l'interval
  useEffect(() => {
    if (delay !== null) {
      start()
    } else {
      stop()
    }

    return stop
  }, [delay, start, stop])

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return {
    start,
    stop,
    restart,
    trigger,
    isRunning: intervalRef.current !== null,
    executionCount: countRef.current,
  }
}

/**
 * Hook pour un interval simple qui se contente d'exister
 * @param {Function} callback - Fonction à exécuter
 * @param {number|null} delay - Délai en ms
 * @param {boolean} immediate - Exécuter immédiatement
 */
export function useSimpleInterval(callback, delay, immediate = false) {
  const { isRunning } = useInterval(callback, delay, { immediate })
  return isRunning
}

/**
 * Hook pour un polling avec gestion d'erreurs
 * @param {Function} asyncFn - Fonction async à exécuter
 * @param {number} interval - Délai entre exécutions
 * @param {Object} options - Options
 */
export function usePolling(asyncFn, interval, options = {}) {
  const { enabled = true, immediate = true, onError, namespace = 'Polling' } = options

  const pollingCallback = useCallback(async () => {
    try {
      await asyncFn()
    } catch (error) {
      logger.error(namespace, 'Erreur polling:', error)
      onError?.(error)
    }
  }, [asyncFn, namespace, onError])

  const controls = useInterval(pollingCallback, enabled ? interval : null, { immediate, namespace })

  return {
    ...controls,
    isPolling: controls.isRunning,
  }
}

export default useInterval
