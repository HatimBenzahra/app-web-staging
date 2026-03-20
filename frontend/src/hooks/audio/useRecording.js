import { useState, useEffect, useCallback, useRef } from 'react'
import { RecordingService } from '@/services/audio'
import { logger } from '@/services/core'
import { AUDIO_TIMING } from '@/constants/ui/timing'
import { useTimeout } from '@/hooks/utils/async/useTimeout'
import { useCleanup } from '@/hooks/utils/async/useCleanup'

/**
 * Hook pour gérer l'enregistrement automatique des commerciaux et managers
 * Se déclenche automatiquement selon le flow :
 * - START: Navigation vers page des portes (PortesGestion) + Connexion LiveKit active
 * - STOP: Retour vers liste des immeubles (click bouton retour)
 */
export function useRecording(
  userId,
  userType = 'commercial',
  enabled = false,
  audioConnected = false,
  immeubleId = null
) {
  const [isRecording, setIsRecording] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [error, setError] = useState(null)
  const [recordingData, setRecordingData] = useState(null)

  // Ref pour éviter les doubles déclenchements
  const isProcessingRef = useRef(false)
  const currentEgressIdRef = useRef(null)

  // Utiliser useCleanup pour gérer l'arrêt automatique
  const { addCleanup } = useCleanup({
    namespace: 'Recording',
  })

  /**
   * Démarre l'enregistrement automatiquement
   */
  const startRecording = useCallback(async () => {
    if (!userId || !enabled || !audioConnected || isProcessingRef.current || isRecording) {
      logger.debug('Recording', '🚫 Enregistrement non démarré:', {
        userId,
        userType,
        enabled,
        audioConnected,
        isProcessing: isProcessingRef.current,
        isRecording,
      })
      return
    }

    try {
      isProcessingRef.current = true
      setIsStarting(true)
      setError(null)

      logger.info('Recording', `🎤 Démarrage enregistrement pour ${userType}:`, userId)
      logger.debug('Recording', '📋 État avant startRecording:', {
        userId,
        userType,
        enabled,
        isRecording,
        isProcessingRef: isProcessingRef.current,
        immeubleId,
      })

      const result = await RecordingService.startRecording(userId, userType, true, immeubleId)
      logger.debug('Recording', '🎯 Result from RecordingService:', result)

      logger.info('Recording', '✅ Enregistrement démarré:', result)

      setRecordingData(result)
      setIsRecording(true)
      currentEgressIdRef.current = result.egressId

      // Ajouter le cleanup automatique
      addCleanup(() => RecordingService.stopRecording(result.egressId), 'current-recording')
    } catch (err) {
      logger.error('Recording', '❌ Erreur démarrage enregistrement:', err)
      setError(err.message || 'Erreur de démarrage')
      setIsRecording(false)
    } finally {
      setIsStarting(false)
      isProcessingRef.current = false
    }
  }, [userId, userType, enabled, audioConnected, isRecording, addCleanup, immeubleId])

  /**
   * Arrête l'enregistrement et upload vers S3
   */
  const stopRecording = useCallback(async () => {
    if (!currentEgressIdRef.current || !isRecording || isProcessingRef.current) {
      logger.debug('Recording', '🚫 Arrêt enregistrement ignoré:', {
        egressId: currentEgressIdRef.current,
        isRecording,
        isProcessing: isProcessingRef.current,
      })
      return
    }

    try {
      isProcessingRef.current = true
      setIsStopping(true)
      setError(null)

      logger.info('Recording', '🛑 Arrêt enregistrement, egressId:', currentEgressIdRef.current)

      const success = await RecordingService.stopRecording(currentEgressIdRef.current)

      if (success) {
        logger.info('Recording', '✅ Enregistrement arrêté et envoyé vers S3')
        setIsRecording(false)
        setRecordingData(null)
        currentEgressIdRef.current = null
      } else {
        logger.warn('Recording', '⚠️ Arrêt enregistrement: statut non confirmé')
      }
    } catch (err) {
      logger.error('Recording', '❌ Erreur arrêt enregistrement:', err)
      setError(err.message || "Erreur d'arrêt")
    } finally {
      setIsStopping(false)
      isProcessingRef.current = false
    }
  }, [isRecording])

  /**
   * Fonction manuelle pour forcer l'arrêt (fallback)
   */
  const forceStop = useCallback(async () => {
    if (currentEgressIdRef.current) {
      try {
        await RecordingService.stopRecording(currentEgressIdRef.current)
        logger.info('Recording', "🔧 Arrêt forcé de l'enregistrement")
      } catch (err) {
        logger.error('Recording', '❌ Erreur arrêt forcé:', err)
      } finally {
        // Reset état local dans tous les cas
        setIsRecording(false)
        setRecordingData(null)
        currentEgressIdRef.current = null
        isProcessingRef.current = false
      }
    }
  }, [])

  // Utiliser useTimeout pour le démarrage automatique avec délai
  useTimeout(startRecording, AUDIO_TIMING.RECORDING_START_DELAY, {
    autoStart: enabled && audioConnected && !isRecording && !isProcessingRef.current,
    namespace: 'RecordingAutoStart',
  })

  /**
   * Arrêt automatique quand enabled passe à false
   */
  useEffect(() => {
    if (!enabled && isRecording) {
      stopRecording()
    }
  }, [enabled, isRecording, stopRecording])

  // Le cleanup est géré automatiquement par useCleanup

  return {
    // État
    isRecording,
    isStarting,
    isStopping,
    error,
    recordingData,

    // Actions manuelles (si besoin)
    startRecording,
    stopRecording,
    forceStop,

    // Données
    egressId: currentEgressIdRef.current,
    s3Key: recordingData?.s3Key,
    status: recordingData?.status,
  }
}

export default useRecording
