/**
 * Audio Module - Central export for recording and monitoring services
 */

// Recording module exports
export { RecordingService } from './recordings'
export type {
  RecordingData,
  EnrichedRecording,
  StartRecordingInput,
  StartRecordingResponse,
  StopRecordingInput,
} from './recordings'

// Monitoring module exports
export { AudioMonitoringService, LiveKitUtils } from './monitoring'
export type {
  TokenResponse,
  MonitoringSession,
  ActiveRoom,
  StopMonitoringInput,
  ConnectionDetails,
  LiveKitRoom,
} from './monitoring'
