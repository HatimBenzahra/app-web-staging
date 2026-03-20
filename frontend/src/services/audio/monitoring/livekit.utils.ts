import type { ConnectionDetails, LiveKitRoom } from './monitoring.types'
import { AudioEventLogger } from '@/services/api/audio/audio.service'

/**
 * Utilitaires LiveKit pour la gestion des connexions et des rooms
 */
export class LiveKitUtils {
  /**
   * Se connecte comme commercial (publisher)
   */
  static async connectAsCommercial(
    connectionDetails: ConnectionDetails
  ): Promise<LiveKitRoom> {
    try {
      const { Room } = await import('livekit-client')

      const room = new Room()
      await room.connect(
        connectionDetails.serverUrl,
        connectionDetails.participantToken
      )

      // Publier automatiquement l'audio
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      const audioTrack = stream.getTracks()[0]

      // Logger l'état initial du microphone
      AudioEventLogger.logMicrophoneUnmuted('Microphone initialisé', `enabled: ${audioTrack.enabled}, muted: ${audioTrack.muted}, readyState: ${audioTrack.readyState}`)

      // Surveiller les changements d'état du track audio et logger au backend
      audioTrack.onended = () => {
        AudioEventLogger.logMicrophoneEnded('Track audio terminé', `readyState: ${audioTrack.readyState}`)
      }

      audioTrack.onmute = () => {
        AudioEventLogger.logMicrophoneMuted('Track audio muted', `enabled: ${audioTrack.enabled}`)
      }

      audioTrack.onunmute = () => {
        AudioEventLogger.logMicrophoneUnmuted('Track audio unmuted', `enabled: ${audioTrack.enabled}`)
      }

      await room.localParticipant.publishTrack(audioTrack)

      // Confirmer la publication du track
      AudioEventLogger.logMicrophoneUnmuted('Track audio publié dans LiveKit', `trackSid: ${room.localParticipant.audioTrackPublications.values().next().value?.trackSid || 'unknown'}`)

      // Surveiller les événements de tracks locaux LiveKit et logger au backend
      room.localParticipant.on('trackMuted', (publication) => {
        AudioEventLogger.logMicrophoneMuted('Track LiveKit muted', `trackSid: ${publication.trackSid}`)
      })

      room.localParticipant.on('trackUnmuted', (publication) => {
        AudioEventLogger.logMicrophoneUnmuted('Track LiveKit unmuted', `trackSid: ${publication.trackSid}`)
      })

      room.localParticipant.on('trackUnpublished', (publication) => {
        AudioEventLogger.logTrackUnpublished('Track LiveKit unpublished', `trackSid: ${publication.trackSid}`)
      })

      // Surveiller les erreurs de connexion
      room.on('disconnected', (reason) => {
        if (reason) {
          AudioEventLogger.logConnectionError('LiveKit disconnected', `reason: ${reason}`)
        }
      })

      return room
    } catch (error) {
      // Logger l'erreur au backend
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorDetails = error instanceof Error ? error.stack : undefined

      if (errorMessage.includes('WebSocket') || errorMessage.includes('connection')) {
        AudioEventLogger.logWebSocketFailed(errorMessage, errorDetails)
      } else {
        AudioEventLogger.logConnectionError(errorMessage, errorDetails)
      }

      throw error
    }
  }

  /**
   * Se connecte comme superviseur (subscriber)
   */
  static async connectAsSupervisor(
    connectionDetails: ConnectionDetails,
    audioContainer: HTMLElement | null = null
  ): Promise<LiveKitRoom> {
    try {
      const { Room } = await import('livekit-client')

      const room = new Room()

      // Écouter les nouveaux tracks audio et les jouer automatiquement
      room.on('trackSubscribed', (track, publication, participant) => {
        if (track.kind === 'audio') {
          // Créer et attacher l'élément audio
          const audioElement = track.attach() as HTMLAudioElement

          // Configuration audio pour maximiser les chances de lecture
          audioElement.autoplay = true
          audioElement.controls = false
          audioElement.volume = 1.0
          audioElement.muted = false
          audioElement.style.display = 'none'

          // Ajouter au DOM
          if (audioContainer) {
            audioContainer.appendChild(audioElement)
          } else {
            document.body.appendChild(audioElement)
          }

          // Forcer la lecture après un court délai
          setTimeout(() => {
            audioElement.play().catch(() => {
              // Échec silencieux
            })
          }, 100)
        }
      })

      await room.connect(
        connectionDetails.serverUrl,
        connectionDetails.participantToken
      )

      return room
    } catch (error) {
      throw error
    }
  }

  /**
   * Déconnecte proprement une room
   */
  static async disconnect(room: LiveKitRoom): Promise<void> {
    try {
      if (room) {
        await room.disconnect()
      }
    } catch (error) {
      // Échec silencieux
    }
  }
}

export default LiveKitUtils
