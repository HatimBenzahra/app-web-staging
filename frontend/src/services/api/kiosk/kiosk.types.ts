// ── Health ───────────────────────────────────────────────────────────────────

export interface KioskLatestVersion {
  versionCode: number
  versionName: string
}

export interface KioskHealthResponse {
  status: string
  uptime: number
  totalReleases: number
  latestVersions: Record<string, KioskLatestVersion>
  devices: {
    total: number
    online: number
  }
  timestamp: string
}

// ── Devices ──────────────────────────────────────────────────────────────────

export interface KioskDevice {
  deviceId: string
  deviceName: string
  manufacturer: string
  model: string
  serialNumber: string
  androidVersion: string
  kioskVersion: string
  kioskVersionCode: number
  prowinVersion: string
  prowinVersionCode: number
  kioskLocked: boolean
  batteryLevel: number
  batteryCharging: boolean
  networkType: string
  networkName: string
  networkSubtype: string
  operatorName: string
  signalStrength: number | null
  ipAddress: string
  latitude: number | null
  longitude: number | null
  locationAccuracy: number | null
  lastSeen: string
  firstSeen: string
  online: boolean
  pendingCommands: KioskPendingCommand[]
}

export interface KioskPendingCommand {
  action: string
  createdAt: string
  payload?: Record<string, unknown>
}

// ── Releases ─────────────────────────────────────────────────────────────────

export interface KioskRelease {
  id: string
  packageName: string
  appName: string
  versionCode: number
  versionName: string
  filename: string
  originalName: string
  size: number
  sizeHuman: string
  notes: string
  apkSha256: string
  nonMonotonicVersionCode: boolean
  uploadedAt: string
  active: boolean
}

export interface KioskReleaseUploadResponse {
  success: boolean
  release: KioskRelease
  otaCheckQueuedFor: number
  metadataVerified: boolean
}

export interface KioskApkInspectResponse {
  success: boolean
  metadata: {
    packageName: string
    versionCode: number
    versionName: string
    apkSha256: string
    latestPublishedVersionCode: number | null
    nextRecommendedVersionCode: number
    duplicateBinary: boolean
    duplicateReleaseId: string | null
  }
}

// ── Logs ─────────────────────────────────────────────────────────────────────

export interface KioskLog {
  id: string
  timestamp: string
  type: string
  deviceId: string
  deviceName: string
  message: string
  data: Record<string, unknown>
}

export interface KioskLogsResponse {
  total: number
  logs: KioskLog[]
}

export interface KioskLogFilters {
  deviceId?: string
  type?: string
  level?: string
  from?: string
  to?: string
  limit?: number
}

// ── Version Matrix ───────────────────────────────────────────────────────────

export type KioskVersionStatus = 'up_to_date' | 'outdated' | 'very_outdated' | 'unknown'

export interface KioskVersionMatrixEntry {
  deviceId: string
  deviceName: string
  online: boolean
  lastSeen: string
  kiosk: {
    version: string | null
    versionCode: number | null
    apkName: string | null
    status: KioskVersionStatus
  }
  prowin: {
    version: string | null
    versionCode: number | null
    apkName: string | null
    status: KioskVersionStatus
  }
}

export interface KioskAvailableRelease {
  id: string
  packageName: string
  appName: string
  originalName: string
  versionName: string
  versionCode: number
  active: boolean
  uploadedAt: string
}

export interface KioskVersionMatrixResponse {
  matrix: KioskVersionMatrixEntry[]
  latestVersions: Record<string, {
    releaseId: string
    versionCode: number
    versionName: string
    appName: string
  }>
  availableReleases: KioskAvailableRelease[]
}

// ── Deploy History ───────────────────────────────────────────────────────────

export interface KioskDeployHistoryEntry {
  id: string
  timestamp: string
  deviceId: string
  deviceName: string
  releaseId: string | null
  packageName: string
  versionName: string
  versionCode: number | null
  action: string
  status: string
  initiatedBy: string
}

export interface KioskDeployHistoryResponse {
  total: number
  entries: KioskDeployHistoryEntry[]
}

export interface KioskDeployHistoryFilters {
  deviceId?: string
  releaseId?: string
  limit?: number
}

// ── Commands & Actions ───────────────────────────────────────────────────────

export type KioskCommandAction = 'lock' | 'unlock' | 'ota_check' | 'set_pin' | 'ota_update'

export interface KioskCommandPayload {
  action: KioskCommandAction
  payload?: Record<string, unknown>
}

export interface KioskDeployPayload {
  deviceId: string
  releaseId: string
}

export interface KioskSuccessResponse {
  success: boolean
  message?: string
}
