import { useQuery } from '@tanstack/react-query'
import { gql } from '@/services/core/graphql'
import {
  GET_GPS_DAILY_ROUTE_BY_ACTOR,
  GET_GPS_LATEST_ACTOR_POSITIONS,
  GET_GPS_ROUTE_BY_ACTOR,
} from '@/services/api/gps-tracking/gps-tracking.queries'

export type GpsUserType = 'COMMERCIAL' | 'MANAGER' | 'DIRECTEUR'

interface GpsActorPosition {
  id: number
  userId?: number | null
  userType?: GpsUserType | null
  latitude: number
  longitude: number
  accuracy?: number | null
  batteryLevel?: number | null
  isOnline: boolean
  recordedAt: string
}

type GpsRoutePoint = Pick<GpsActorPosition, 'latitude' | 'longitude' | 'recordedAt'>
type GpsRouteAccuracyPoint = Pick<
  GpsActorPosition,
  'latitude' | 'longitude' | 'recordedAt' | 'accuracy'
>

export const gpsTrackingKeys = {
  all: ['gps-tracking'] as const,
  latestActor: () => [...gpsTrackingKeys.all, 'latestActor'] as const,
  dailyRouteByActor: (userId: number | null, userType: GpsUserType | null, date: string) =>
    [...gpsTrackingKeys.all, 'dailyRouteByActor', userId, userType, date] as const,
  routeByActor: (userId: number | null, userType: GpsUserType | null, from: string, to: string) =>
    [...gpsTrackingKeys.all, 'routeByActor', userId, userType, from, to] as const,
}

export function useGpsLatestActorPositions() {
  return useQuery({
    queryKey: gpsTrackingKeys.latestActor(),
    queryFn: async () => {
      const response = await gql<
        { gpsLatestActorPositions: GpsActorPosition[] },
        Record<string, never>
      >(GET_GPS_LATEST_ACTOR_POSITIONS, {})
      return response.gpsLatestActorPositions
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function useGpsDailyRouteByActor(
  userId: number | null,
  userType: GpsUserType | null,
  date: string
) {
  return useQuery({
    queryKey: gpsTrackingKeys.dailyRouteByActor(userId, userType, date),
    queryFn: async () => {
      const response = await gql<
        { gpsDailyRouteByActor: GpsRoutePoint[] },
        { userId: number; userType: GpsUserType; date: string }
      >(GET_GPS_DAILY_ROUTE_BY_ACTOR, {
        userId: userId as number,
        userType: userType as GpsUserType,
        date,
      })
      return { positions: response.gpsDailyRouteByActor ?? [] }
    },
    enabled:
      typeof userId === 'number' && Number.isFinite(userId) && Boolean(userType) && Boolean(date),
    staleTime: 30_000,
  })
}

export function useGpsRouteByActor(
  userId: number | null,
  userType: GpsUserType | null,
  from: string,
  to: string
) {
  return useQuery({
    queryKey: gpsTrackingKeys.routeByActor(userId, userType, from, to),
    queryFn: async () => {
      const response = await gql<
        { gpsRouteByActor: GpsRouteAccuracyPoint[] },
        { userId: number; userType: GpsUserType; from: string; to: string }
      >(GET_GPS_ROUTE_BY_ACTOR, {
        userId: userId as number,
        userType: userType as GpsUserType,
        from,
        to,
      })
      return { positions: response.gpsRouteByActor ?? [] }
    },
    enabled:
      typeof userId === 'number' &&
      Number.isFinite(userId) &&
      Boolean(userType) &&
      Boolean(from) &&
      Boolean(to),
    staleTime: 30_000,
  })
}
