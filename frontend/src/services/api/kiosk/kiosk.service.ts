import { kioskClient } from './kiosk.client'
import type {
  KioskHealthResponse,
  KioskDevice,
  KioskRelease,
  KioskReleaseUploadResponse,
  KioskApkInspectResponse,
  KioskLogsResponse,
  KioskLogFilters,
  KioskVersionMatrixResponse,
  KioskDeployHistoryResponse,
  KioskDeployHistoryFilters,
  KioskCommandAction,
  KioskSuccessResponse,
} from './kiosk.types'

export const kioskApi = {
  // ── Read ───────────────────────────────────────────────────────────────────

  getHealth: () =>
    kioskClient.get<KioskHealthResponse>('/api/health'),

  getDevices: () =>
    kioskClient.get<KioskDevice[]>('/api/devices'),

  getReleases: () =>
    kioskClient.get<KioskRelease[]>('/api/releases'),

  getLogs: (filters?: KioskLogFilters) =>
    kioskClient.get<KioskLogsResponse>('/api/logs', filters as Record<string, string | number | undefined>),

  getDeviceLogs: (deviceId: string, filters?: Omit<KioskLogFilters, 'deviceId'>) =>
    kioskClient.get<KioskLogsResponse>(`/api/logs/device/${deviceId}`, filters as Record<string, string | number | undefined>),

  getLogTypes: () =>
    kioskClient.get<string[]>('/api/logs/types'),

  getVersionMatrix: () =>
    kioskClient.get<KioskVersionMatrixResponse>('/api/versions/matrix'),

  getDeployHistory: (filters?: KioskDeployHistoryFilters) =>
    kioskClient.get<KioskDeployHistoryResponse>('/api/versions/history', filters as Record<string, string | number | undefined>),

  // ── Write ──────────────────────────────────────────────────────────────────

  sendDeviceCommand: (deviceId: string, action: KioskCommandAction, payload?: Record<string, unknown>) =>
    kioskClient.post<KioskSuccessResponse>(`/api/devices/${deviceId}/command`, { action, payload }),

  renameDevice: (deviceId: string, deviceName: string) =>
    kioskClient.patch<KioskSuccessResponse>(`/api/devices/${deviceId}`, { deviceName }),

  deleteDevice: (deviceId: string) =>
    kioskClient.del<KioskSuccessResponse>(`/api/devices/${deviceId}`),

  uploadRelease: (formData: FormData) =>
    kioskClient.upload<KioskReleaseUploadResponse>('/api/releases', formData),

  inspectApk: (formData: FormData) =>
    kioskClient.upload<KioskApkInspectResponse>('/api/releases/inspect', formData),

  toggleRelease: (releaseId: string, active: boolean) =>
    kioskClient.patch<KioskSuccessResponse>(`/api/releases/${releaseId}`, { active }),

  deleteRelease: (releaseId: string) =>
    kioskClient.del<KioskSuccessResponse>(`/api/releases/${releaseId}`),

  deployToDevice: (deviceId: string, releaseId: string) =>
    kioskClient.post<KioskSuccessResponse>('/api/versions/deploy', { deviceId, releaseId }),

  clearLogs: () =>
    kioskClient.del<KioskSuccessResponse>('/api/logs'),
}
