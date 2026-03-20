import { useEffect, useMemo, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { gql } from '@/services/core/graphql'
import type { KioskDevice } from '@/services/api/kiosk'
import {
  GET_DEVICE_MAPPINGS,
  GET_GPS_ALL_POSITIONS,
  GET_GPS_DAILY_ROUTE,
  GET_GPS_DEVICES,
  GET_GPS_HISTORY,
  GET_GPS_LATEST_POSITIONS,
  SAVE_GPS_POSITIONS,
  SET_DEVICE_COMMERCIAL,
} from '@/services/api/gps-tracking/gps-tracking.queries'

interface GpsPosition {
  id: number
  deviceId: string
  deviceName?: string | null
  latitude: number
  longitude: number
  accuracy?: number | null
  batteryLevel?: number | null
  isOnline: boolean
  recordedAt: string
  createdAt?: string
}

interface GpsPositionInput {
  deviceId: string
  deviceName?: string
  latitude: number
  longitude: number
  accuracy?: number
  batteryLevel?: number
  isOnline?: boolean
}

interface GpsHistoryResponse {
  total: number
  positions: GpsPosition[]
}

interface SaveGpsPositionsResponse {
  success: boolean
  saved: number
}

export const gpsTrackingKeys = {
  all: ['gps-tracking'] as const,
  allPositions: (from: string, to: string, deviceId?: string) =>
    [...gpsTrackingKeys.all, 'allPositions', from, to, deviceId] as const,
  history: (deviceId: string, from?: string, to?: string, limit?: number) =>
    [...gpsTrackingKeys.all, 'history', deviceId, from, to, limit] as const,
  dailyRoute: (deviceId: string, date: string) =>
    [...gpsTrackingKeys.all, 'dailyRoute', deviceId, date] as const,
  latest: () => [...gpsTrackingKeys.all, 'latest'] as const,
  devices: () => [...gpsTrackingKeys.all, 'devices'] as const,
}

export function useGpsHistory(deviceId: string, from?: string, to?: string, limit?: number) {
  return useQuery({
    queryKey: gpsTrackingKeys.history(deviceId, from, to, limit),
    queryFn: async () => {
      const response = await gql<
        { gpsHistory: GpsHistoryResponse },
        { deviceId: string; from?: string; to?: string; limit?: number }
      >(GET_GPS_HISTORY, { deviceId, from, to, limit })
      return response.gpsHistory
    },
    enabled: Boolean(deviceId),
    staleTime: 30_000,
  })
}

export function useGpsDailyRoute(deviceId: string, date: string) {
  return useQuery({
    queryKey: gpsTrackingKeys.dailyRoute(deviceId, date),
    queryFn: async () => {
      const response = await gql<{ gpsDailyRoute: GpsHistoryResponse }, { deviceId: string; date: string }>(
        GET_GPS_DAILY_ROUTE,
        { deviceId, date }
      )
      return response.gpsDailyRoute
    },
    enabled: Boolean(deviceId && date),
    staleTime: 30_000,
  })
}

export function useGpsAllPositions(from: string, to: string, deviceId?: string) {
  return useQuery({
    queryKey: gpsTrackingKeys.allPositions(from, to, deviceId),
    queryFn: async () => {
      const response = await gql<
        { gpsAllPositions: GpsHistoryResponse },
        { from: string; to: string; deviceId?: string; limit?: number }
      >(GET_GPS_ALL_POSITIONS, { from, to, deviceId, limit: 5000 })
      return response.gpsAllPositions
    },
    enabled: Boolean(from && to),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useGpsLatestPositions() {
  return useQuery({
    queryKey: gpsTrackingKeys.latest(),
    queryFn: async () => {
      const response = await gql<{ gpsLatestPositions: GpsPosition[] }, Record<string, never>>(
        GET_GPS_LATEST_POSITIONS,
        {}
      )
      return response.gpsLatestPositions
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function useGpsDevices() {
  return useQuery({
    queryKey: gpsTrackingKeys.devices(),
    queryFn: async () => {
      const response = await gql<
        { gpsDevices: Array<{ deviceId: string; deviceName?: string | null }> },
        Record<string, never>
      >(GET_GPS_DEVICES, {})
      return response.gpsDevices
    },
    staleTime: 60_000,
  })
}

export function useSaveGpsPositions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { positions: GpsPositionInput[] }) => {
      const response = await gql<
        { saveGpsPositions: SaveGpsPositionsResponse },
        { input: { positions: GpsPositionInput[] } }
      >(SAVE_GPS_POSITIONS, { input })
      return response.saveGpsPositions
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gpsTrackingKeys.latest() })
      queryClient.invalidateQueries({ queryKey: gpsTrackingKeys.devices() })
    },
  })
}

export function useGpsAutoSave(kioskDevices: KioskDevice[] = []) {
  const { mutateAsync, ...mutation } = useSaveGpsPositions()
  const lastPayloadRef = useRef<string>('')
  const lastSavedAtRef = useRef<number>(0)

  const positions = useMemo(() => {
    return kioskDevices
      .filter(device => device.latitude !== null && device.longitude !== null)
      .map(device => ({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        latitude: device.latitude as number,
        longitude: device.longitude as number,
        accuracy: device.locationAccuracy ?? undefined,
        batteryLevel: device.batteryLevel,
        isOnline: device.online,
      }))
  }, [kioskDevices])

  useEffect(() => {
    if (positions.length === 0) {
      return
    }

    const save = async () => {
      const now = Date.now()
      const payloadFingerprint = JSON.stringify(
        positions.map(pos => [pos.deviceId, pos.latitude, pos.longitude, pos.accuracy, pos.batteryLevel, pos.isOnline])
      )

      if (payloadFingerprint === lastPayloadRef.current && now - lastSavedAtRef.current < 30_000) {
        return
      }

      try {
        await mutateAsync({ positions })
        lastPayloadRef.current = payloadFingerprint
        lastSavedAtRef.current = now
      } catch {
      }
    }

    save()
    const intervalId = window.setInterval(save, 30_000)
    return () => window.clearInterval(intervalId)
  }, [mutateAsync, positions])

  return mutation
}

export function useDeviceMappings() {
  return useQuery({
    queryKey: [...gpsTrackingKeys.all, 'mappings'],
    queryFn: async () => {
      const response = await gql<{ deviceMappings: Array<{ id: number; deviceId: string; commercialName: string }> }>(
        GET_DEVICE_MAPPINGS,
        {}
      )
      return response.deviceMappings
    },
    staleTime: 60_000,
  })
}

export function useSetDeviceCommercial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { deviceId: string; commercialName: string }) => {
      const response = await gql<{ setDeviceCommercial: { id: number; deviceId: string; commercialName: string } }>(
        SET_DEVICE_COMMERCIAL,
        { input }
      )
      return response.setDeviceCommercial
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [...gpsTrackingKeys.all, 'mappings'] })
    },
  })
}
