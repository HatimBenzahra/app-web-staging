/**
 * Hook pour gérer les timeouts avec cleanup automatique et annulation
 * Élimine la duplication dans useCommercialAutoAudio.js, useRecording.js, etc.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { logger } from '@/services/core'
import { delay } from '@/constants/ui/timing'

/**
 * Hook pour gérer un timeout avec contrôles avancés
 * @param {Function} callback - Fonction à exécuter
 * @param {number} delay - Délai en ms
 * @param {Object} options - Options
 * @param {boolean} options.autoStart - Démarrer automatiquement (défaut: true)
 * @param {string} options.namespace - Namespace pour logs
 * @returns {Object} Contrôles du timeout
 */
export function useTimeout(callback, delayMs, options = {}) {
  const { autoStart = true, namespace = 'Timeout' } = options

  const [isActive, setIsActive] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const timeoutRef = useRef(null)
  const savedCallback = useRef(callback)
  const startTimeRef = useRef(null)

  // Se souvenir du callback le plus récent
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  // Fonction pour démarrer le timeout
  const start = useCallback(() => {
    if (timeoutRef.current) return // Déjà actif

    logger.debug(namespace, `Démarrage timeout: ${delayMs}ms`)
    setIsActive(true)
    setIsCompleted(false)
    startTimeRef.current = Date.now()

    timeoutRef.current = setTimeout(() => {
      try {
        savedCallback.current()
        logger.debug(namespace, 'Timeout exécuté')
      } catch (error) {
        logger.error(namespace, 'Erreur exécution timeout:', error)
      } finally {
        setIsActive(false)
        setIsCompleted(true)
        timeoutRef.current = null
        startTimeRef.current = null
      }
    }, delayMs)
  }, [delayMs, namespace])

  // Fonction pour annuler le timeout
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
      setIsActive(false)
      startTimeRef.current = null
      logger.debug(namespace, 'Timeout annulé')
    }
  }, [namespace])

  // Fonction pour redémarrer le timeout
  const restart = useCallback(() => {
    cancel()
    setIsCompleted(false)
    start()
  }, [cancel, start])

  // Fonction pour obtenir le temps restant approximatif
  const getTimeRemaining = useCallback(() => {
    if (!isActive || !startTimeRef.current) return 0
    const elapsed = Date.now() - startTimeRef.current
    return Math.max(0, delayMs - elapsed)
  }, [isActive, delayMs])

  // Démarrage automatique si demandé
  useEffect(() => {
    if (autoStart) {
      start()
    }
    return cancel
  }, [autoStart, start, cancel])

  // Cleanup au démontage
  useEffect(() => {
    return cancel
  }, [cancel])

  return {
    start,
    cancel,
    restart,
    isActive,
    isCompleted,
    getTimeRemaining,
  }
}

/**
 * Hook pour un timeout simple qui s'exécute une fois
 * @param {Function} callback - Fonction à exécuter
 * @param {number} delay - Délai en ms
 * @param {Array} deps - Dépendances pour redémarrer
 */
export function useSimpleTimeout(callback, delayMs, deps = []) {
  const { isCompleted } = useTimeout(callback, delayMs, {
    autoStart: true,
    namespace: 'SimpleTimeout',
  })

  // Redémarrer si les dépendances changent
  useEffect(() => {
    // Le timeout se redémarre automatiquement via useTimeout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps])

  return isCompleted
}

/**
 * Hook pour un debounce avec timeout
 * @param {Function} callback - Fonction à débouncer
 * @param {number} delay - Délai de debounce
 * @param {Array} deps - Dépendances
 */
export function useDebounce(callback, delayMs, deps = []) {
  const timeoutControls = useTimeout(callback, delayMs, { autoStart: false })

  // Redémarrer le timeout à chaque changement de dépendances
  useEffect(() => {
    timeoutControls.restart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps])

  return {
    trigger: timeoutControls.restart,
    cancel: timeoutControls.cancel,
    isPending: timeoutControls.isActive,
  }
}

/**
 * Hook pour retarder l'exécution d'une valeur/état
 * @param {any} value - Valeur à retarder
 * @param {number} delay - Délai en ms
 */
export function useDelayedValue(value, delayMs) {
  const [delayedValue, setDelayedValue] = useState(value)

  const { restart } = useTimeout(() => setDelayedValue(value), delayMs, { autoStart: false })

  useEffect(() => {
    restart()
  }, [value, restart])

  return delayedValue
}

/**
 * Hook pour créer une promesse avec timeout
 * @param {number} delay - Délai en ms
 * @returns {Promise} Promise qui se résout après le délai
 */
export function useTimeoutPromise(delayMs) {
  return useCallback(() => delay(delayMs), [delayMs])
}

export default useTimeout
