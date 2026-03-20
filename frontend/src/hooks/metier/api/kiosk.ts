import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { kioskApi } from '@/services/api/kiosk'
import type { KioskLogFilters, KioskDeployHistoryFilters, KioskCommandAction } from '@/services/api/kiosk'

export const kioskKeys = {
  all: ['kiosk'] as const,
  health: () => [...kioskKeys.all, 'health'] as const,
  devices: () => [...kioskKeys.all, 'devices'] as const,
  releases: () => [...kioskKeys.all, 'releases'] as const,
  logs: (filters?: KioskLogFilters) => [...kioskKeys.all, 'logs', filters] as const,
  logTypes: () => [...kioskKeys.all, 'logTypes'] as const,
  versionMatrix: () => [...kioskKeys.all, 'versionMatrix'] as const,
  deployHistory: (filters?: KioskDeployHistoryFilters) => [...kioskKeys.all, 'deployHistory', filters] as const,
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useKioskHealth() {
  return useQuery({
    queryKey: kioskKeys.health(),
    queryFn: () => kioskApi.getHealth(),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}

export function useKioskDevices() {
  return useQuery({
    queryKey: kioskKeys.devices(),
    queryFn: () => kioskApi.getDevices(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function useKioskReleases() {
  return useQuery({
    queryKey: kioskKeys.releases(),
    queryFn: () => kioskApi.getReleases(),
    staleTime: 2 * 60_000,
  })
}

export function useKioskLogs(filters?: KioskLogFilters) {
  return useQuery({
    queryKey: kioskKeys.logs(filters),
    queryFn: () => kioskApi.getLogs(filters),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useKioskLogTypes() {
  return useQuery({
    queryKey: kioskKeys.logTypes(),
    queryFn: () => kioskApi.getLogTypes(),
    staleTime: 5 * 60_000,
  })
}

export function useKioskVersionMatrix() {
  return useQuery({
    queryKey: kioskKeys.versionMatrix(),
    queryFn: () => kioskApi.getVersionMatrix(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}

export function useKioskDeployHistory(filters?: KioskDeployHistoryFilters) {
  return useQuery({
    queryKey: kioskKeys.deployHistory(filters),
    queryFn: () => kioskApi.getDeployHistory(filters),
    staleTime: 60_000,
  })
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useKioskSendCommand() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deviceId, action, payload }: { deviceId: string; action: KioskCommandAction; payload?: Record<string, unknown> }) =>
      kioskApi.sendDeviceCommand(deviceId, action, payload),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: kioskKeys.devices() })
    },
  })
}

export function useKioskRenameDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deviceId, deviceName }: { deviceId: string; deviceName: string }) =>
      kioskApi.renameDevice(deviceId, deviceName),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: kioskKeys.devices() })
      queryClient.invalidateQueries({ queryKey: kioskKeys.versionMatrix() })
    },
  })
}

export function useKioskDeleteDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (deviceId: string) => kioskApi.deleteDevice(deviceId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: kioskKeys.devices() })
      queryClient.invalidateQueries({ queryKey: kioskKeys.versionMatrix() })
    },
  })
}

export function useKioskUploadRelease() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (formData: FormData) => kioskApi.uploadRelease(formData),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: kioskKeys.releases() })
    },
  })
}

export function useKioskInspectApk() {
  return useMutation({
    mutationFn: (formData: FormData) => kioskApi.inspectApk(formData),
  })
}

export function useKioskToggleRelease() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ releaseId, active }: { releaseId: string; active: boolean }) =>
      kioskApi.toggleRelease(releaseId, active),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: kioskKeys.releases() })
    },
  })
}

export function useKioskDeleteRelease() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (releaseId: string) => kioskApi.deleteRelease(releaseId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: kioskKeys.releases() })
    },
  })
}

export function useKioskDeploy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deviceId, releaseId }: { deviceId: string; releaseId: string }) =>
      kioskApi.deployToDevice(deviceId, releaseId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: kioskKeys.versionMatrix() })
      queryClient.invalidateQueries({ queryKey: kioskKeys.deployHistory() })
    },
  })
}

export function useKioskClearLogs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => kioskApi.clearLogs(),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: kioskKeys.logs() })
    },
  })
}
