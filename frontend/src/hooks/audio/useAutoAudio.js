import { useState, useRef, useCallback } from 'react'
import { AudioMonitoringService, LiveKitUtils } from '@/services/audio'
import { logger } from '@/services/core'
import { AUDIO_TIMING } from '@/constants/ui/timing'
import { useTimeout } from '../utils/async/useTimeout'
import { useConnectionCleanup } from '../utils/async/useCleanup'

/**
 * Hook pour gérer l'audio monitoring automatique des commerciaux et managers
 * Se connecte automatiquement quand l'utilisateur se connecte à son espace
 */
export function useAutoAudio(userId, userType, enabled = true) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState(null)
  const [connectionDetails, setConnectionDetails] = useState(null)

  const roomRef = useRef(null)
  const audioStreamRef = useRef(null)

  // Utiliser useConnectionCleanup pour gérer les ressources
  const { addConnection, cleanupAll } = useConnectionCleanup({
    namespace: 'AutoAudio',
  })

  // Fonction pour démarrer la connexion audio
  const startAudioPublishing = useCallback(async () => {
    // Vérifier que userId est valide (pas null, pas NaN, > 0)
    if (!userId || isNaN(userId) || userId <= 0 || !enabled || isConnecting || isConnected) {
      return
    }

    try {
      setIsConnecting(true)
      setError(null)

      // 1. Générer le token utilisateur selon le type (commercial ou manager)
      logger.debug('Audio', `🎤 Génération token ${userType}...`, userId)
      const details = await AudioMonitoringService.generateUserToken(userType)
      setConnectionDetails(details)

      // 2. Se connecter à LiveKit comme publisher
      logger.debug('Audio', '🎤 Connexion LiveKit...', details.roomName)
      const room = await LiveKitUtils.connectAsCommercial(details)
      roomRef.current = room

      // 3. Marquer comme connecté
      setIsConnected(true)
      logger.info('Audio', `✅ Audio monitoring actif pour ${userType}`, userId)

      // 4. Gérer les événements de déconnexion
      room.on('disconnected', () => {
        logger.info('Audio', '🔌 Utilisateur déconnecté de LiveKit')
        setIsConnected(false)
        setConnectionDetails(null)
        roomRef.current = null
      })

      // 5. Enregistrer la connexion pour cleanup
      addConnection(room, 'livekit-room', LiveKitUtils.disconnect)
      if (audioStreamRef.current) {
        addConnection(audioStreamRef.current, 'audio-stream', stream =>
          stream.getTracks().forEach(track => track.stop())
        )
      }
    } catch (err) {
      logger.error('Audio', '❌ Erreur connexion audio:', err)
      setError(err.message || 'Erreur de connexion audio')
      setIsConnected(false)
    } finally {
      setIsConnecting(false)
    }
  }, [userId, userType, enabled, isConnecting, isConnected, addConnection])

  // Fonction pour arrêter la connexion audio
  const stopAudioPublishing = useCallback(async () => {
    try {
      await cleanupAll()
      roomRef.current = null
      audioStreamRef.current = null

      setIsConnected(false)
      setConnectionDetails(null)
      setError(null)
      logger.info('Audio', '🔇 Audio monitoring arrêté')
    } catch (err) {
      logger.error('Audio', 'Erreur arrêt audio:', err)
    }
  }, [cleanupAll])

  // Fonction pour redémarrer la connexion
  const restartAudioPublishing = useCallback(async () => {
    await stopAudioPublishing()
    await startAudioPublishing()
  }, [stopAudioPublishing, startAudioPublishing])

  // Utiliser useTimeout pour le démarrage automatique avec délai
  useTimeout(startAudioPublishing, AUDIO_TIMING.AUTO_CONNECT_DELAY, {
    autoStart: userId && enabled && !isConnected && !isConnecting,
    namespace: 'WorkspaceAutoConnect',
  })

  // Le cleanup est géré automatiquement par useConnectionCleanup

  return {
    // État
    isConnected,
    isConnecting,
    error,
    connectionDetails,

    // Actions
    startAudioPublishing,
    stopAudioPublishing,
    restartAudioPublishing,

    // Données
    roomName: connectionDetails?.roomName,
    participantName: connectionDetails?.participantName,
  }
}

export default useAutoAudio
