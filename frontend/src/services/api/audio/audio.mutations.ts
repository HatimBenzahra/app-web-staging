/**
 * @fileoverview Audio monitoring related GraphQL mutations
 */

export const LOG_AUDIO_EVENT = `
  mutation LogAudioEvent($eventType: String!, $message: String!, $details: String) {
    logAudioEvent(eventType: $eventType, message: $message, details: $details)
  }
`

export const GENERATE_COMMERCIAL_TOKEN = `
  mutation GenerateCommercialToken($commercialId: Int, $roomName: String) {
    generateCommercialToken(commercialId: $commercialId, roomName: $roomName) {
      serverUrl
      participantToken
      roomName
      participantName
    }
  }
`

export const GENERATE_MANAGER_TOKEN = `
  mutation GenerateManagerToken($managerId: Int, $roomName: String) {
    generateManagerToken(managerId: $managerId, roomName: $roomName) {
      serverUrl
      participantToken
      roomName
      participantName
    }
  }
`
