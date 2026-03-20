/**
 * Types for Audio Monitoring Service
 */

import type { Room } from 'livekit-client'

export type LiveKitRoom = Room

export interface TokenResponse {
  serverUrl: string
  participantToken: string
  roomName: string
  participantName: string
}

export interface MonitoringSession {
  id: string
  userId: number
  userType: string
  roomName: string
  status: string
  startedAt: string
  supervisorId: number
}

export interface ActiveRoom {
  roomName: string
  numParticipants: number
  createdAt: string
  participantNames: string[]
}

export interface StopMonitoringInput {
  sessionId: string
}

export interface ConnectionDetails {
  serverUrl: string
  participantToken: string
  roomName: string
  participantName: string
}
