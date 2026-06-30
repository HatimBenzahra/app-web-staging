import { kioskClient, secondaryKioskClient } from './kiosk.client'
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
  KioskAlignTarget,
  KioskAlignResponse,
} from './kiosk.types'

// Fusionne les devices de plusieurs kiosks en dédoublonnant par tablette
// (serialNumber sinon deviceId). Une tablette physique garde le même identifiant
// sur tous les kiosks ; on conserve la remontée la plus fraîche (lastSeen).
function mergeKioskDevices(...sources: KioskDevice[][]): KioskDevice[] {
  const byDevice = new Map<string, KioskDevice>()
  for (const list of sources) {
    for (const d of list) {
      const key = d.serialNumber || d.deviceId
      const existing = byDevice.get(key)
      const tNew = d.lastSeen ? new Date(d.lastSeen).getTime() : 0
      const tOld = existing?.lastSeen ? new Date(existing.lastSeen).getTime() : 0
      if (!existing || tNew >= tOld) byDevice.set(key, d)
    }
  }
  return Array.from(byDevice.values())
}

export const kioskApi = {
  // ── Read ───────────────────────────────────────────────────────────────────

  getHealth: () =>
    kioskClient.get<KioskHealthResponse>('/api/health'),

  getDevices: async (): Promise<KioskDevice[]> => {
    const primary = await kioskClient.get<KioskDevice[]>('/api/devices')
    if (!secondaryKioskClient) return primary
    let secondary: KioskDevice[] = []
    try {
      secondary = await secondaryKioskClient.get<KioskDevice[]>('/api/devices')
    } catch {
      // Kiosk secondaire optionnel : son indisponibilité ne doit pas casser la vue.
    }
    return mergeKioskDevices(primary, secondary)
  },

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

  alignVersions: (target: KioskAlignTarget) =>
    kioskClient.post<KioskAlignResponse>('/api/versions/align', { target }),

  clearLogs: () =>
    kioskClient.del<KioskSuccessResponse>('/api/logs'),
}
