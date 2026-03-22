import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MapboxMap, { Marker } from 'react-map-gl/mapbox'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Wifi,
  WifiOff,
  BatteryWarning,
  Navigation2,
  ArrowRight,
  MapPin,
  Clock3,
  Circle,
} from 'lucide-react'
import { useGpsLatestPositions, useDeviceMappings, useGpsDailyRoute } from '@/hooks/metier/api/gps-tracking'
import { Layer, Source } from 'react-map-gl/mapbox'
import { useKioskDevices } from '@/hooks/metier/api/kiosk'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
if (MAPBOX_TOKEN) mapboxgl.accessToken = MAPBOX_TOKEN

const IDF_CENTER = { longitude: 2.35, latitude: 48.85, zoom: 10, pitch: 45, bearing: -15 }
const LOW_BATTERY_THRESHOLD = 20

const MARKER_COLORS = [
  '#6366f1',
  '#f43f5e',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
  '#ef4444',
  '#3b82f6',
]

const formatRelativeTime = value => {
  if (!value) return 'Inconnu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Inconnu'
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMin / 60)

  if (diffMin < 1) return "A l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffHour < 24) return `il y a ${diffHour}h`
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const geocodeCache = new Map()

async function reverseGeocode(lat, lng) {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`
  if (geocodeCache.has(key)) return geocodeCache.get(key)

  try {
    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
    if (!token) return null
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=address,poi,place&language=fr&limit=1`
    )
    if (!res.ok) return null
    const data = await res.json()
    const name = data.features?.[0]?.place_name || data.features?.[0]?.text || null
    geocodeCache.set(key, name)
    return name
  } catch (error) {
    void error
    return null
  }
}

function CommercialMarker({ color, initial }) {
  return (
    <div
      className="relative flex flex-col items-center"
      style={{ transform: 'translate(0, -50%)' }}
    >
      <div
        className="h-7 w-7 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {initial}
      </div>
      <div
        className="h-2 w-2 rounded-full -mt-0.5 border border-white"
        style={{ backgroundColor: color }}
      />
    </div>
  )
}

function BuildingMarker({ onClick, color, dimmed }) {
  const bg = color || '#f59e0b'
  return (
    <div
      className={`relative flex flex-col items-center cursor-pointer group transition-opacity ${dimmed ? 'opacity-30' : ''}`}
      style={{ transform: 'translate(0, -50%)' }}
      onClick={onClick}
    >
      <div
        className="h-8 w-8 rounded-lg border-2 border-white shadow-lg flex items-center justify-center transition-transform group-hover:scale-110"
        style={{ backgroundColor: bg }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
          <path d="M9 22v-4h6v4" />
          <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
        </svg>
      </div>
      <div
        className="h-2 w-2 rounded-full -mt-0.5 border border-white"
        style={{ backgroundColor: bg }}
      />
    </div>
  )
}

function FleetStatPill({ icon, count, label, colorClass }) {
  return (
    <div className="flex items-center gap-1.5">
      {React.createElement(icon, {
        className: `h-3.5 w-3.5 shrink-0 ${colorClass}`,
      })}
      <span className={`text-xs font-semibold tabular-nums ${colorClass}`}>{count}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export default function FleetTerrainWidget({ todayImmeubles }) {
  const navigate = useNavigate()
  const { data: gpsPositions, isLoading: gpsLoading } = useGpsLatestPositions()
  const { data: kioskDevices, isLoading: kioskLoading } = useKioskDevices()
  const { data: deviceMappings } = useDeviceMappings()
  const [locationNames, setLocationNames] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const mapRef = useRef(null)

  const todayStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const { data: dailyRoute } = useGpsDailyRoute(selectedId || '', todayStr)

  const routeGeoJson = useMemo(() => {
    if (!dailyRoute?.positions?.length) return null
    const coords = dailyRoute.positions.map(p => [p.longitude, p.latitude])
    return {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: {},
    }
  }, [dailyRoute])

  const mappingsMap = useMemo(() => {
    const map = new Map()
    if (deviceMappings) {
      for (const m of deviceMappings) {
        map.set(m.deviceId, m.commercialName)
      }
    }
    return map
  }, [deviceMappings])

  const commercials = useMemo(() => {
    const positions = gpsPositions ?? []
    const devices = kioskDevices ?? []

    const posMap = new Map()
    for (const p of positions) {
      posMap.set(p.deviceId, p)
    }

    const seen = new Set()
    const result = []

    for (const device of devices) {
      const id = device.serialNumber || device.deviceId
      if (seen.has(id)) continue
      seen.add(id)

      const pos = posMap.get(id) || posMap.get(device.deviceId)
      const name =
        mappingsMap.get(id) || mappingsMap.get(device.deviceId) || device.deviceName || id

      result.push({
        id,
        name,
        isOnline: device.online,
        latitude: pos?.latitude || device.latitude,
        longitude: pos?.longitude || device.longitude,
        lastSeen: pos?.recordedAt || device.lastSeen,
        batteryLevel: device.batteryLevel,
        hasPosition: Boolean(pos?.latitude || device.latitude),
      })
    }

    for (const pos of positions) {
      if (!seen.has(pos.deviceId)) {
        seen.add(pos.deviceId)
        const name = mappingsMap.get(pos.deviceId) || pos.deviceName || pos.deviceId
        result.push({
          id: pos.deviceId,
          name,
          isOnline: pos.isOnline,
          latitude: pos.latitude,
          longitude: pos.longitude,
          lastSeen: pos.recordedAt,
          batteryLevel: pos.batteryLevel,
          hasPosition: true,
        })
      }
    }

    result.sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1
      return (a.name || '').localeCompare(b.name || '')
    })

    return result
  }, [gpsPositions, kioskDevices, mappingsMap])

  const onlineWithPosition = useMemo(
    () => commercials.filter(c => c.isOnline && c.hasPosition),
    [commercials]
  )

  useEffect(() => {
    let cancelled = false
    const toGeocode = onlineWithPosition.filter(
      c => c.latitude && c.longitude && !locationNames[c.id]
    )
    if (toGeocode.length === 0) return undefined

    const run = async () => {
      const updates = {}
      for (const commercial of toGeocode.slice(0, 5)) {
        if (cancelled) break
        const name = await reverseGeocode(commercial.latitude, commercial.longitude)
        if (name) updates[commercial.id] = name
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setLocationNames(prev => ({ ...prev, ...updates }))
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [onlineWithPosition, locationNames])

  const fleetStats = useMemo(() => {
    const devices = kioskDevices ?? []
    return {
      online: devices.filter(d => d.online).length,
      offline: devices.filter(d => !d.online).length,
      lowBattery: devices.filter(
        d => d.batteryLevel != null && d.batteryLevel <= LOW_BATTERY_THRESHOLD
      ).length,
      total: devices.length,
    }
  }, [kioskDevices])

  const mapViewState = useMemo(() => {
    if (onlineWithPosition.length === 0) return IDF_CENTER
    if (onlineWithPosition.length === 1) {
      return {
        longitude: onlineWithPosition[0].longitude,
        latitude: onlineWithPosition[0].latitude,
        zoom: 14,
        pitch: 45,
        bearing: -15,
      }
    }
    const lats = onlineWithPosition.map(c => c.latitude)
    const lngs = onlineWithPosition.map(c => c.longitude)
    return {
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      zoom: 11,
      pitch: 45,
      bearing: -15,
    }
  }, [onlineWithPosition])

  const getMarkerColor = useCallback(
    id => {
      const idx = commercials.findIndex(c => c.id === id)
      return MARKER_COLORS[idx % MARKER_COLORS.length]
    },
    [commercials]
  )

  const handleSelectCommercial = useCallback(
    commercial => {
      if (!commercial.hasPosition || !commercial.latitude || !commercial.longitude) return

      const isSame = selectedId === commercial.id
      if (isSame) {
        setSelectedId(null)
        if (mapRef.current) {
          const bounds = onlineWithPosition.reduce(
            (b, c) => b.extend([c.longitude, c.latitude]),
            new mapboxgl.LngLatBounds()
          )
          mapRef.current.fitBounds(bounds, { padding: 50, duration: 800 })
        }
        return
      }

      setSelectedId(commercial.id)
      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [commercial.longitude, commercial.latitude],
          zoom: 15,
          duration: 1200,
          essential: true,
        })
      }
    },
    [selectedId, onlineWithPosition]
  )

  const isLoading = gpsLoading || kioskLoading

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-5 w-48" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3 w-52 mt-2" />
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="flex gap-4">
            <Skeleton className="flex-3 h-[380px] rounded-lg" />
            <div className="flex-2 space-y-2">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          </div>
          <Skeleton className="h-6 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <div className="p-1.5 rounded-lg bg-chart-2/15">
              <Navigation2 className="h-3.5 w-3.5 text-chart-2" />
            </div>
            Équipe terrain
          </CardTitle>
          <div className="flex items-center gap-2">
            {fleetStats.total > 0 && (
              <Badge
                variant="secondary"
                className="text-xs bg-chart-2/15 text-chart-2 border-chart-2/20"
              >
                {fleetStats.online}/{fleetStats.total} actifs
              </Badge>
            )}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
          Localisation GPS en temps réel
        </p>
      </CardHeader>

      <CardContent className="pt-0 space-y-3 flex-1 flex flex-col">
        <div className="flex gap-4 flex-1 min-h-[380px]">
          <div className="flex-3 relative rounded-lg overflow-hidden border border-border/60">
            {!MAPBOX_TOKEN ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 gap-2">
                <MapPin className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">Token Mapbox manquant</p>
              </div>
            ) : onlineWithPosition.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/30 gap-2">
                <div className="p-3 rounded-full bg-muted/60">
                  <MapPin className="h-5 w-5 text-muted-foreground/40" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">
                  Aucun commercial localisé
                </p>
                <p className="text-[11px] text-muted-foreground/60 text-center px-6">
                  Les positions apparaîtront quand les tablettes seront actives
                </p>
              </div>
            ) : (
              <MapboxMap
                ref={mapRef}
                initialViewState={mapViewState}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/streets-v12"
                terrain={{ source: 'mapbox-dem', exaggeration: 1 }}
                scrollZoom
                dragPan
                dragRotate
                doubleClickZoom
                touchZoomRotate
                keyboard={false}
                attributionControl={false}
              >
                {onlineWithPosition.map(c => {
                  const isSelected = selectedId === c.id
                  return (
                    <Marker
                      key={c.id}
                      longitude={c.longitude}
                      latitude={c.latitude}
                      anchor="bottom"
                    >
                      <div
                        className="transition-transform duration-300"
                        style={{
                          transform: isSelected ? 'scale(1.5)' : 'scale(1)',
                          zIndex: isSelected ? 50 : 1,
                        }}
                      >
                        <CommercialMarker
                          color={getMarkerColor(c.id)}
                          initial={(c.name || '?').charAt(0).toUpperCase()}
                        />
                      </div>
                    </Marker>
                  )
                })}
                {todayImmeubles?.filter(imm => imm.latitude && imm.longitude).map(imm => (
                  <Marker
                    key={`imm-${imm.id}`}
                    longitude={imm.longitude}
                    latitude={imm.latitude}
                    anchor="bottom"
                  >
                    <BuildingMarker onClick={() => navigate(`/immeubles/${imm.id}`)} />
                  </Marker>
                ))}
                {routeGeoJson && selectedId && (
                  <Source id="route" type="geojson" data={routeGeoJson}>
                    <Layer
                      id="route-line"
                      type="line"
                      paint={{
                        'line-color': getMarkerColor(selectedId),
                        'line-width': 3,
                        'line-opacity': 0.7,
                        'line-dasharray': [2, 1],
                      }}
                    />
                  </Source>
                )}
              </MapboxMap>
            )}
          </div>

          <div className="flex-2 overflow-y-auto space-y-1.5 pr-0.5">
            {commercials.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-10">
                <Navigation2 className="h-5 w-5 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">Aucun appareil enregistré</p>
              </div>
            ) : (
              commercials.map(c => {
                const color = getMarkerColor(c.id)
                const location = locationNames[c.id]
                const isSelected = selectedId === c.id
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => handleSelectCommercial(c)}
                    className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-primary/50 bg-primary/8 ring-1 ring-primary/20'
                        : c.isOnline
                          ? 'border-border/50 bg-background/80 hover:bg-muted/20'
                          : 'border-border/50 opacity-50 bg-muted/20'
                    } ${c.hasPosition && c.isOnline ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                        c.isOnline ? 'text-white' : 'text-muted-foreground bg-muted'
                      }`}
                      style={c.isOnline ? { backgroundColor: color } : undefined}
                    >
                      {(c.name || '?').charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate leading-tight">{c.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {c.isOnline ? (
                          <>
                            <Circle className="h-1.5 w-1.5 fill-chart-2 text-chart-2 shrink-0" />
                            <span className="text-[10px] font-medium text-chart-2">Actif</span>
                          </>
                        ) : (
                          <>
                            <Circle className="h-1.5 w-1.5 fill-muted-foreground/40 text-muted-foreground/40 shrink-0" />
                            <span className="text-[10px] text-muted-foreground/70">Hors ligne</span>
                          </>
                        )}
                      </div>
                      {c.isOnline && (
                        <div className="mt-0.5">
                          {location ? (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <MapPin className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{location}</span>
                            </span>
                          ) : c.hasPosition ? (
                            <span className="text-[10px] text-muted-foreground/50 italic">
                              Localisation...
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {c.lastSeen && (
                      <div className="shrink-0">
                        <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5 justify-end">
                          <Clock3 className="h-2.5 w-2.5" />
                          {formatRelativeTime(c.lastSeen)}
                        </span>
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pt-1 border-t border-border/40">
          <div className="flex items-center gap-4 flex-wrap">
            <FleetStatPill
              icon={Wifi}
              count={fleetStats.online}
              label="en ligne"
              colorClass="text-chart-2"
            />
            <div className="h-3 w-px bg-border/60 shrink-0" />
            <FleetStatPill
              icon={WifiOff}
              count={fleetStats.offline}
              label="hors ligne"
              colorClass="text-destructive"
            />
            {fleetStats.lowBattery > 0 && (
              <>
                <div className="h-3 w-px bg-border/60 shrink-0" />
                <FleetStatPill
                  icon={BatteryWarning}
                  count={fleetStats.lowBattery}
                  label="batt. faible"
                  colorClass="text-chart-5"
                />
              </>
            )}
          </div>
          <Link
            to="/kiosk/localisation"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors group shrink-0"
          >
            Voir le suivi détaillé
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
