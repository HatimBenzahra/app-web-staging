import { graphqlClient } from '@/services/core/graphql/client'
import { LOG_AUDIO_EVENT } from './audio.mutations'

/**
 * Service pour logger les événements audio au backend
 */
export class AudioEventLogger {
  /**
   * Envoie un événement audio au backend pour logging
   */
  static async logEvent(
    eventType: string,
    message: string,
    details?: string
  ): Promise<boolean> {
    try {
      const result = await graphqlClient.request(LOG_AUDIO_EVENT, {
        eventType,
        message,
        details,
      })
      return result.logAudioEvent
    } catch (error) {
      console.error('Failed to log audio event to backend:', error)
      // Ne pas throw pour éviter de bloquer l'exécution
      return false
    }
  }

  /**
   * Log un événement de microphone muté
   */
  static logMicrophoneMuted(message: string, details?: string) {
    return this.logEvent('MICROPHONE_MUTED', message, details)
  }

  /**
   * Log un événement de microphone activé
   */
  static logMicrophoneUnmuted(message: string, details?: string) {
    return this.logEvent('MICROPHONE_UNMUTED', message, details)
  }

  /**
   * Log un événement de microphone terminé
   */
  static logMicrophoneEnded(message: string, details?: string) {
    return this.logEvent('MICROPHONE_ENDED', message, details)
  }

  /**
   * Log un événement de track non publié
   */
  static logTrackUnpublished(message: string, details?: string) {
    return this.logEvent('TRACK_UNPUBLISHED', message, details)
  }

  /**
   * Log une erreur de connexion
   */
  static logConnectionError(message: string, details?: string) {
    return this.logEvent('CONNECTION_ERROR', message, details)
  }

  /**
   * Log un échec de WebSocket
   */
  static logWebSocketFailed(message: string, details?: string) {
    return this.logEvent('WEBSOCKET_FAILED', message, details)
  }
}

export default AudioEventLogger
