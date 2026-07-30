import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import MapboxMap, { Marker, Layer, Source } from 'react-map-gl/mapbox'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Card } from '@/components/ui/card'
import { MapPin, Flag } from 'lucide-react'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
if (MAPBOX_TOKEN) mapboxgl.accessToken = MAPBOX_TOKEN

const IDF_CENTER = { longitude: 2.35, latitude: 48.85, zoom: 10 }

/** Carte pleine card : aucun header, aucun padding, seules les bordures restent visibles. */
const CARD_SHELL = 'p-0 gap-0 overflow-hidden h-[320px] lg:h-[440px]'

function boundsOf(coordinates) {
  const [first] = coordinates
  return coordinates.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(first, first))
}

function ActorMarker({ color, initial, dimmed, selected }) {
  return (
    <div
      className={`flex flex-col items-center transition-transform duration-300 ${
        dimmed ? 'opacity-50' : ''
      }`}
      style={{ transform: selected ? 'scale(1.25)' : 'scale(1)' }}
    >
      <div
        className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-lg"
        style={{ backgroundColor: color }}
      >
        {initial}
      </div>
      <div
        className="-mt-0.5 h-2 w-2 rounded-full border border-white"
        style={{ backgroundColor: color }}
      />
    </div>
  )
}

export default function TerrainMapCard({
  located,
  selectedKey,
  selectedActor,
  selectActor,
  route,
  colorFor,
  focusedZone,
}) {
  const mapRef = useRef(null)
  const cameraTargetRef = useRef(null)

  const routeColor = colorFor(selectedActor?.userId)

  // Priorité : la zone focalisée, sinon le trajet du commercial sélectionné,
  // sinon l'ensemble de la flotte localisée.
  const cameraTarget = useMemo(() => {
    if (focusedZone?.geoJson) return focusedZone.geoJson.geometry.coordinates[0]
    if (selectedActor) {
      if (route.geoJson) return route.geoJson.geometry.coordinates
      if (selectedActor.hasPosition) return [[selectedActor.longitude, selectedActor.latitude]]
      return null
    }
    if (located.length === 0) return null
    return located.map(c => [c.longitude, c.latitude])
  }, [focusedZone, selectedActor, route.geoJson, located])

  // La cible passe par un ref pour que `onLoad` applique toujours la dernière
  // connue, même si la carte finit de charger après l'arrivée des données.
  const applyCamera = useCallback(() => {
    const map = mapRef.current
    const coordinates = cameraTargetRef.current
    if (!map || !coordinates?.length) return
    if (coordinates.length === 1) {
      map.flyTo({ center: coordinates[0], zoom: 14, duration: 800 })
      return
    }
    map.fitBounds(boundsOf(coordinates), { padding: 48, duration: 800, maxZoom: 16 })
  }, [])

  useEffect(() => {
    cameraTargetRef.current = cameraTarget
    applyCamera()
  }, [cameraTarget, applyCamera])

  const overlayMessage = useMemo(() => {
    // Une zone focalisée est le sujet de la carte : pas de pastille par-dessus.
    if (focusedZone) return null
    if (located.length === 0) return "Personne sur le terrain aujourd'hui"
    if (selectedActor && route.isEmpty) return 'Aucun trajet enregistré'
    return null
  }, [focusedZone, located.length, selectedActor, route.isEmpty])

  if (!MAPBOX_TOKEN) {
    return (
      <Card className={CARD_SHELL}>
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted/40">
          <MapPin className="h-5 w-5 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">Carte indisponible</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className={CARD_SHELL}>
      <div className="relative h-full w-full">
        <MapboxMap
          ref={mapRef}
          initialViewState={IDF_CENTER}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          scrollZoom
          dragPan
          doubleClickZoom
          touchZoomRotate
          keyboard={false}
          attributionControl={false}
          onLoad={applyCamera}
        >
          {focusedZone?.geoJson && (
            <Source id="focused-zone" type="geojson" data={focusedZone.geoJson}>
              <Layer
                id="focused-zone-fill"
                type="fill"
                paint={{ 'fill-color': focusedZone.color, 'fill-opacity': 0.25 }}
              />
              <Layer
                id="focused-zone-line"
                type="line"
                paint={{ 'line-color': focusedZone.color, 'line-width': 2 }}
              />
            </Source>
          )}

          {route.geoJson && (
            <Source id="daily-route" type="geojson" data={route.geoJson}>
              <Layer
                id="daily-route-shadow"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{ 'line-color': routeColor, 'line-width': 6, 'line-opacity': 0.15 }}
              />
              <Layer
                id="daily-route-line"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{ 'line-color': routeColor, 'line-width': 3, 'line-opacity': 0.85 }}
              />
            </Source>
          )}

          {route.startPoint && (
            <Marker
              longitude={route.startPoint.longitude}
              latitude={route.startPoint.latitude}
              anchor="center"
            >
              <div
                className="flex h-4 w-4 items-center justify-center rounded-full border-2 bg-white shadow"
                style={{ borderColor: routeColor }}
              >
                <Flag className="h-2 w-2" style={{ color: routeColor }} />
              </div>
            </Marker>
          )}

          {located.map(c => {
            const isSelected = c.key === selectedKey
            return (
              <Marker
                key={c.key}
                longitude={c.longitude}
                latitude={c.latitude}
                anchor="bottom"
                onClick={() => selectActor(c)}
                style={{ cursor: 'pointer', zIndex: isSelected ? 2 : 1 }}
              >
                <ActorMarker
                  color={colorFor(c.userId)}
                  initial={(c.name || '?').charAt(0).toUpperCase()}
                  dimmed={!c.online}
                  selected={isSelected}
                />
              </Marker>
            )
          })}
        </MapboxMap>

        {overlayMessage && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
            <p className="rounded-full bg-background/90 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
              {overlayMessage}
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
