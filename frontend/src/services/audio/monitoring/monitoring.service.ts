import { graphqlClient } from '../../core/graphql'
import type {
  TokenResponse,
  MonitoringSession,
  ActiveRoom,
  StopMonitoringInput,
} from './monitoring.types'

// GraphQL Mutations et Queries
const GENERATE_COMMERCIAL_TOKEN = `
  mutation GenerateCommercialToken($roomName: String) {
    generateCommercialToken(roomName: $roomName) {
      serverUrl
      participantToken
      roomName
      participantName
    }
  }
`

const GENERATE_MANAGER_TOKEN = `
  mutation GenerateManagerToken($roomName: String) {
    generateManagerToken(roomName: $roomName) {
      serverUrl
      participantToken
      roomName
      participantName
    }
  }
`

const START_MONITORING = `
  mutation StartMonitoring($userId: Int!, $userType: String!, $roomName: String) {
    startMonitoring(input: { userId: $userId, userType: $userType, roomName: $roomName }) {
      serverUrl
      participantToken
      roomName
      participantName
    }
  }
`

const STOP_MONITORING = `
  mutation StopMonitoring($input: StopMonitoringInput!) {
    stopMonitoring(input: $input)
  }
`

const GET_ACTIVE_SESSIONS = `
  query GetActiveSessions {
    getActiveSessions {
      id
      userId
      userType
      roomName
      status
      startedAt
      supervisorId
    }
  }
`

const GET_ACTIVE_ROOMS = `
  query GetActiveRooms {
    getActiveRooms {
      roomName
      numParticipants
      createdAt
      participantNames
    }
  }
`

/**
 * Service pour l'audio monitoring
 */
export class AudioMonitoringService {
  /**
   * Génère un token commercial pour publisher
   */
  static async generateCommercialToken(roomName?: string): Promise<TokenResponse> {
    try {
      const data = await graphqlClient.request(GENERATE_COMMERCIAL_TOKEN, {
        roomName,
      })
      return data.generateCommercialToken
    } catch (error) {
      console.error('Erreur génération token commercial:', error)
      throw error
    }
  }

  /**
   * Génère un token manager pour publisher
   */
  static async generateManagerToken(roomName?: string): Promise<TokenResponse> {
    try {
      const data = await graphqlClient.request(GENERATE_MANAGER_TOKEN, {
        roomName,
      })
      return data.generateManagerToken
    } catch (error) {
      console.error('Erreur génération token manager:', error)
      throw error
    }
  }

  /**
   * Génère un token universel (commercial ou manager)
   */
  static async generateUserToken(
    userType: string,
    roomName?: string
  ): Promise<TokenResponse> {
    return userType === 'manager'
      ? this.generateManagerToken(roomName)
      : this.generateCommercialToken(roomName)
  }

  /**
   * Démarre une session de monitoring (superviseur)
   * Note: supervisorId est automatiquement récupéré du token JWT via @CurrentUser()
   */
  static async startMonitoring(
    userId: number,
    userType: string,
    roomName?: string
  ): Promise<TokenResponse> {
    try {
      const data = await graphqlClient.request(START_MONITORING, {
        userId,
        userType,
        roomName,
      })
      return data.startMonitoring
    } catch (error) {
      console.error('Erreur démarrage monitoring:', error)
      throw error
    }
  }

  /**
   * Arrête une session de monitoring
   */
  static async stopMonitoring(sessionId: string): Promise<boolean> {
    try {
      const data = await graphqlClient.request(STOP_MONITORING, {
        input: { sessionId },
      })
      return data.stopMonitoring
    } catch (error) {
      // Si la session n'existe plus, ce n'est pas une vraie erreur
      if ((error as any).message?.includes('not found')) {
        console.log('ℹ️ Session de monitoring déjà fermée:', sessionId)
        return true
      }
      console.error('Erreur arrêt monitoring:', error)
      throw error
    }
  }

  /**
   * Récupère les sessions actives
   */
  static async getActiveSessions(): Promise<MonitoringSession[]> {
    try {
      const data = await graphqlClient.request(GET_ACTIVE_SESSIONS)
      return data.getActiveSessions
    } catch (error) {
      console.error('Erreur récupération sessions actives:', error)
      throw error
    }
  }

  /**
   * Récupère les rooms actives avec participants
   */
  static async getActiveRooms(): Promise<ActiveRoom[]> {
    try {
      const data = await graphqlClient.request(GET_ACTIVE_ROOMS)
      return data.getActiveRooms
    } catch (error) {
      console.error('Erreur récupération rooms actives:', error)
      throw error
    }
  }
}

export default AudioMonitoringService
