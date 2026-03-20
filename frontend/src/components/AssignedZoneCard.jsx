import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import MapboxMap, { Marker, Source, Layer, NavigationControl, useControl } from 'react-map-gl/mapbox'
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'
import mapboxgl from 'mapbox-gl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, Calendar, Maximize2, X, Lock, Unlock, Building2 } from 'lucide-react'
import { MapSkeleton } from '@/components/LoadingSkeletons'
import { mapboxCache } from '@/services/core'
import { logError } from '@/services/core'

// Set Mapbox access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

// Geocoder Control Component pour la searchbar
function GeocoderControl() {
  useControl(
    () => {
      const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        marker: false,
        countries: 'fr',
        language: 'fr',
        placeholder: 'Rechercher une adresse...',
      })
      return geocoder
    },
    { position: 'top-left' }
  )
  return null
}

// Generate a deterministic color from zone ID
function getZoneColor(zoneId) {
  const colors = [
    '#3388ff', // Blue
    '#ff6b6b', // Red
    '#51cf66', // Green
    '#ffd93d', // Yellow
    '#a78bfa', // Purple
    '#f59e0b', // Orange
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#f97316', // Dark Orange
  ]
  return colors[zoneId % colors.length]
}

function createGeoJSONCircle(center, radiusInMeters, points = 64) {
  const coords = { latitude: center[1], longitude: center[0] }
  const km = radiusInMeters / 1000
  const ret = []
  const distanceX = km / (111.32 * Math.cos((coords.latitude * Math.PI) / 180))
  const distanceY = km / 110.574
  let theta, x, y
  for (let i = 0; i < points; i++) {
    theta = (i / points) * (2 * Math.PI)
    x = distanceX * Math.cos(theta)
    y = distanceY * Math.sin(theta)
    ret.push([coords.longitude + x, coords.latitude + y])
  }
  ret.push(ret[0])
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ret] },
    properties: {},
  }
}

function getImmeubleMarkerProps(immeuble) {
  const totalPortes = (immeuble.portes || []).length
  const prospectees = (immeuble.portes || []).filter(p => p.statut !== 'NON_VISITE').length
  const couverture = totalPortes > 0 ? Math.round((prospectees / totalPortes) * 100) : 0
  const contrats = (immeuble.portes || [])
    .filter(p => p.statut === 'CONTRAT_SIGNE')
    .reduce((sum, p) => sum + (p.nbContrats || 1), 0)

  let colorClass, progressColor
  if (couverture === 0) {
    colorClass = 'bg-gray-500 hover:bg-gray-600'
    progressColor = '#6b7280'
  } else if (couverture < 50) {
    colorClass = 'bg-amber-500 hover:bg-amber-600'
    progressColor = '#f59e0b'
  } else if (couverture < 100) {
    colorClass = 'bg-blue-600 hover:bg-blue-700'
    progressColor = '#2563eb'
  } else {
    colorClass = 'bg-emerald-500 hover:bg-emerald-600'
    progressColor = '#10b981'
  }

  return { totalPortes, couverture, contrats, colorClass, progressColor }
}

const fetchLocationName = async (longitude, latitude) => {
  const roundedLng = longitude.toFixed(4)
  const roundedLat = latitude.toFixed(4)

  const fetchGeocode = async () => {
    try {
      const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${token}&types=place,region,country&language=fr`
      )

      if (!response.ok) {
        throw new Error(`Erreur Mapbox API: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (data.features && data.features.length > 0) {
        const feature = data.features[0]
        return feature.place_name || feature.text
      } else {
        return `${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E`
      }
    } catch (error) {
      // Utiliser le système centralisé de logging d'erreurs
      logError(error, 'AssignedZoneCard.fetchLocationName', {
        longitude,
        latitude,
      })
      return `${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E`
    }
  }

  // Utiliser le cache dédié Mapbox
  const cacheKey = mapboxCache.getKey(fetchGeocode, [roundedLng, roundedLat], 'mapbox-geocode')
  return mapboxCache.fetchWithCache(cacheKey, fetchGeocode)
}

/**
 * Composant pour afficher la zone assignée à un commercial/manager/directeur
 * OU pour afficher tous les immeubles sur une carte
 * @param {Object} props
 * @param {Object} props.zone - Objet zone avec xOrigin, yOrigin, rayon, nom, id, immeubles
 * @param {string} props.assignmentDate - Date d'assignation au format ISO
 * @param {number} props.immeublesCount - Nombre d'immeubles dans la zone
 * @param {string} props.className - Classes CSS supplémentaires
 * @param {boolean} props.showAllImmeubles - Mode "tous les immeubles" sans zone spécifique
 * @param {Array} props.allImmeubles - Liste de tous les immeubles (si showAllImmeubles = true)
 */
export default function AssignedZoneCard({
  zone,
  assignmentDate,
  className = '',
  fullWidth = false,
  showAllImmeubles = false,
  allImmeubles = [],
}) {
  const mapRef = useRef(null)
  const navigate = useNavigate()
  const [mapLoading, setMapLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMapLocked, setIsMapLocked] = useState(true) // Map verrouillée par défaut
  const [locationName, setLocationName] = useState('Chargement...')
  const [isMounted, setIsMounted] = useState(false) // ← AJOUT

  // S'assurer que le composant est monté avant de rendre la carte
  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  // Charger le nom de la localisation
  useEffect(() => {
    if (zone?.xOrigin && zone?.yOrigin) {
      fetchLocationName(zone.xOrigin, zone.yOrigin)
        .then(name => {
          setLocationName(name)
        })
        .catch(error => {
          // Gérer les erreurs de géocodage silencieusement
          logError(error, 'AssignedZoneCard.useEffect.fetchLocationName', {
            zoneId: zone.id,
            zoneName: zone.nom,
          })
          setLocationName(`${zone.yOrigin.toFixed(2)}°N, ${zone.xOrigin.toFixed(2)}°E`)
        })
    }
  }, [zone])

  const zoneColor = useMemo(() => {
    return zone?.id ? getZoneColor(zone.id) : '#3388ff'
  }, [zone?.id])

  const circleGeoJSON = useMemo(() => {
    if (!zone?.xOrigin || !zone?.yOrigin || !zone?.rayon) return null
    return createGeoJSONCircle([zone.xOrigin, zone.yOrigin], zone.rayon)
  }, [zone])

  // Filtrer les immeubles qui ont des coordonnées valides
  const immeublesWithCoordinates = useMemo(() => {
    const sourceImmeubles = showAllImmeubles ? allImmeubles : zone?.immeubles
    if (!sourceImmeubles) return []
    return sourceImmeubles.filter(
      immeuble =>
        immeuble.latitude != null &&
        immeuble.longitude != null &&
        !isNaN(immeuble.latitude) &&
        !isNaN(immeuble.longitude)
    )
  }, [zone?.immeubles, allImmeubles, showAllImmeubles])

  // Calculer le centre de la carte basé sur la zone ou sur tous les immeubles
  const mapCenter = useMemo(() => {
    if (zone?.xOrigin && zone?.yOrigin && !showAllImmeubles) {
      return {
        longitude: zone.xOrigin,
        latitude: zone.yOrigin,
        zoom: 11,
      }
    }

    // Si pas de zone ou mode "tous les immeubles", calculer le centre basé sur les immeubles
    if (immeublesWithCoordinates.length === 0) {
      return { longitude: 2.3522, latitude: 48.8566, zoom: 5 }
    }

    const avgLat =
      immeublesWithCoordinates.reduce((sum, imm) => sum + imm.latitude, 0) /
      immeublesWithCoordinates.length
    const avgLng =
      immeublesWithCoordinates.reduce((sum, imm) => sum + imm.longitude, 0) /
      immeublesWithCoordinates.length

    const lats = immeublesWithCoordinates.map(i => i.latitude)
    const lngs = immeublesWithCoordinates.map(i => i.longitude)
    const latRange = Math.max(...lats) - Math.min(...lats)
    const lngRange = Math.max(...lngs) - Math.min(...lngs)
    const maxRange = Math.max(latRange, lngRange)

    let zoom = 10
    if (maxRange > 10) zoom = 5
    else if (maxRange > 5) zoom = 6
    else if (maxRange > 2) zoom = 7
    else if (maxRange > 1) zoom = 8
    else if (maxRange > 0.5) zoom = 9

    return { longitude: avgLng, latitude: avgLat, zoom }
  }, [zone, immeublesWithCoordinates, showAllImmeubles])

  // Fonction pour gérer le clic sur un immeuble
  const handleImmeubleClick = immeubleId => {
    navigate(`/immeubles/${immeubleId}`)
  }

  if (!zone && !showAllImmeubles) {
    return (
      <Card className={`border-2 ${className}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Aucune zone assignée</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const MapContent = ({ height = '300px', showControls = false }) => {
    const containerRef = useRef(null)
    const [containerHeight, setContainerHeight] = useState(null)
    const [isContainerReady, setIsContainerReady] = useState(false)

    // Observer pour obtenir la hauteur réelle du conteneur quand height="100%"
    useEffect(() => {
      if (containerRef.current && height === '100%') {
        const resizeObserver = new ResizeObserver(entries => {
          for (let entry of entries) {
            const h = entry.contentRect.height
            if (h > 0) {
              setContainerHeight(h)
              setIsContainerReady(true)
            }
          }
        })
        resizeObserver.observe(containerRef.current)
        return () => resizeObserver.disconnect()
      } else if (height !== '100%') {
        // Si height n'est pas 100%, on peut utiliser directement la valeur
        setContainerHeight(height)
        // Petit délai pour s'assurer que le DOM est prêt
        const timer = setTimeout(() => setIsContainerReady(true), 50)
        return () => clearTimeout(timer)
      }
    }, [height])

    // Vérifier que tout est prêt avant de rendre la carte
    const canRenderMap =
      isMounted &&
      isContainerReady &&
      containerHeight != null &&
      (showAllImmeubles ||
        (zone?.xOrigin != null &&
          zone?.yOrigin != null &&
          zone?.rayon != null &&
          !isNaN(zone.xOrigin) &&
          !isNaN(zone.yOrigin)))

    if (!canRenderMap) {
      return (
        <div
          ref={containerRef}
          style={{ height, width: '100%' }}
          className="flex items-center justify-center bg-muted rounded-lg"
        >
          <div className="text-center space-y-2">
            <MapPin className="h-8 w-8 mx-auto text-muted-foreground animate-pulse" />
            <p className="text-sm text-muted-foreground">
              {!isMounted
                ? 'Initialisation...'
                : containerHeight == null
                  ? 'Calcul des dimensions...'
                  : 'Coordonnées invalides'}
            </p>
          </div>
        </div>
      )
    }

    // Convertir la hauteur en pixels si nécessaire
    const actualHeight =
      typeof containerHeight === 'number' ? `${containerHeight}px` : containerHeight

    return (
      <div ref={containerRef} style={{ height, width: '100%', position: 'relative' }}>
        {mapLoading && (
          <div className="absolute inset-0 z-10">
            <MapSkeleton />
          </div>
        )}

        {/* Overlay de verrouillage */}
        {isMapLocked && !isFullscreen && (
          <button
            type="button"
            className="absolute inset-0 z-20 bg-transparent cursor-pointer flex items-center justify-center group"
            onClick={() => setIsMapLocked(false)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setIsMapLocked(false)
              }
            }}
          >
            <div className="bg-background/90 backdrop-blur-sm px-4 py-2 rounded-lg border-2 border-primary/20 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Unlock className="h-4 w-4" />
                <span>Cliquez pour déverrouiller la carte</span>
              </div>
            </div>
          </button>
        )}

        <MapboxMap
          ref={mapRef}
          initialViewState={mapCenter}
          style={{ height: actualHeight, width: '100%', borderRadius: '0.5rem' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          onLoad={() => setMapLoading(false)}
          onError={error => {
            logError(error, 'AssignedZoneCard.Map.onError', {
              zoneId: zone?.id,
              zoneName: zone?.nom,
            })
            setMapLoading(false)
          }}
          attributionControl={false}
          scrollZoom={!isMapLocked || isFullscreen}
          dragPan={!isMapLocked || isFullscreen}
          dragRotate={!isMapLocked || isFullscreen}
          doubleClickZoom={!isMapLocked || isFullscreen}
          touchZoomRotate={!isMapLocked || isFullscreen}
        >
          {showControls && <NavigationControl position="top-right" />}
          <GeocoderControl />

          {/* Centre de la zone - seulement si on a une zone */}
          {zone && !showAllImmeubles && <Marker longitude={zone.xOrigin} latitude={zone.yOrigin} />}

          {/* Immeubles sur la carte */}
          {immeublesWithCoordinates.map(immeuble => {
            const portes = immeuble.portes || []
            const totalPortes = portes.length
            const prospectees = portes.filter(p => p.statut !== 'NON_VISITE').length
            const couverture = totalPortes > 0 ? Math.round((prospectees / totalPortes) * 100) : 0
            const contrats = portes.filter(p => p.statut === 'CONTRAT_SIGNE').reduce((s, p) => s + (p.nbContrats || 1), 0)
            const markerBg =
              couverture === 0 ? 'bg-gray-500' :
              couverture < 50 ? 'bg-amber-500' :
              couverture < 100 ? 'bg-blue-600' :
              'bg-emerald-500'

            return (
              <Marker
                key={`immeuble-${immeuble.id}`}
                longitude={immeuble.longitude}
                latitude={immeuble.latitude}
              >
                <button
                  type="button"
                  className="relative cursor-pointer group"
                  onClick={e => {
                    e.stopPropagation()
                    handleImmeubleClick(immeuble.id)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      handleImmeubleClick(immeuble.id)
                    }
                  }}
                >
                  <div className={`${markerBg} text-white p-2 rounded-lg shadow-lg border-2 border-white hover:scale-110 transition-all duration-200 active:scale-95`}>
                    <Building2 className="h-4 w-4" />
                  </div>

                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2.5 bg-gray-900 text-white text-xs rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 space-y-1">
                    <div className="font-semibold text-[13px]">{immeuble.adresse}</div>
                    <div className="text-gray-300">
                      {immeuble.nbEtages} ét. × {immeuble.nbPortesParEtage} = {totalPortes > 0 ? totalPortes : immeuble.nbEtages * immeuble.nbPortesParEtage} portes
                    </div>
                    {totalPortes > 0 && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${markerBg}`} style={{ width: `${couverture}%` }} />
                        </div>
                        <span className="text-[11px] tabular-nums">{couverture}%</span>
                      </div>
                    )}
                    {contrats > 0 && (
                      <div className="text-emerald-400">{contrats} contrat{contrats > 1 ? 's' : ''}</div>
                    )}
                    {immeuble.commercial && (
                      <div className="text-gray-300">
                        👤 {immeuble.commercial.prenom} {immeuble.commercial.nom}
                      </div>
                    )}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </button>
              </Marker>
            )
          })}

          {/* Cercle de la zone - seulement si on a une zone */}
          {circleGeoJSON && !showAllImmeubles && (
            <Source id="zone-circle" type="geojson" data={circleGeoJSON}>
              <Layer
                id="zone-fill"
                type="fill"
                paint={{ 'fill-color': zoneColor, 'fill-opacity': 0.25 }}
              />
              <Layer
                id="zone-line"
                type="line"
                paint={{ 'line-color': zoneColor, 'line-width': 2 }}
              />
            </Source>
          )}
        </MapboxMap>
      </div>
    )
  }

  return (
    <>
      <Card className={`border-2 ${className}`}>
        <CardContent className="pt-6">
          {fullWidth ? (
            /* Layout pleine largeur avec map en haut */
            <div className="space-y-6">
              {/* Map en pleine largeur */}
              <div className="relative">
                <div className="aspect-[21/9] rounded-lg overflow-hidden border-2 relative">
                  <MapContent height="100%" showControls={true} />

                  {/* Boutons de contrôle */}
                  <div className="absolute bottom-3 left-3 right-3 z-30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant={isMapLocked ? 'secondary' : 'default'}
                        size="sm"
                        onClick={() => setIsMapLocked(!isMapLocked)}
                        className="shadow-lg"
                        title={isMapLocked ? 'Déverrouiller la carte' : 'Verrouiller la carte'}
                      >
                        {isMapLocked ? (
                          <>
                            <Lock className="h-4 w-4 mr-2" />
                            Verrouillée
                          </>
                        ) : (
                          <>
                            <Unlock className="h-4 w-4 mr-2" />
                            Déverrouillée
                          </>
                        )}
                      </Button>

                      {showAllImmeubles && (
                        <Badge variant="secondary" className="shadow-lg">
                          {immeublesWithCoordinates.length} immeubles affichés
                        </Badge>
                      )}
                    </div>

                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => setIsFullscreen(true)}
                      className="shadow-lg"
                      title="Agrandir la carte"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Informations sous la map */}
              {showAllImmeubles ? (
                /* Statistiques pour tous les immeubles */
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
                        Total Immeubles
                      </p>
                    </div>
                    <p className="text-2xl font-bold">{allImmeubles.length}</p>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
                        Géolocalisés
                      </p>
                    </div>
                    <p className="text-2xl font-bold">{immeublesWithCoordinates.length}</p>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
                      Total Étages
                    </p>
                    <p className="text-2xl font-bold">
                      {allImmeubles.reduce((sum, imm) => sum + (imm.nbEtages || 0), 0)}
                    </p>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
                      Total Portes
                    </p>
                    <p className="text-2xl font-bold">
                      {allImmeubles.reduce(
                        (sum, imm) => sum + (imm.nbEtages || 0) * (imm.nbPortesParEtage || 0),
                        0
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                /* Informations de zone */
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
                          Zone
                        </p>
                      </div>
                      <Link
                        to={`/zones/${zone.id}`}
                        className="text-xl font-bold hover:text-primary hover:underline transition-colors cursor-pointer"
                      >
                        {zone.nom}
                      </Link>
                    </div>

                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
                          Localisation
                        </p>
                      </div>
                      <p className="font-semibold">{locationName}</p>
                    </div>

                    <div className="flex flex-col space-y-2">
                      <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
                        Rayon de couverture
                      </p>
                      <p className="text-xl font-bold">{(zone.rayon / 1000).toFixed(1)} km</p>
                    </div>

                    <div className="flex flex-col space-y-2">
                      <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
                        Surface totale
                      </p>
                      <p className="text-xl font-bold">
                        {(Math.PI * Math.pow(zone.rayon / 1000, 2)).toFixed(1)} km²
                      </p>
                    </div>
                  </div>

                  {assignmentDate && (
                    <div className="pt-4 border-t">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium mb-1">
                            Date d'assignation
                          </p>
                          <p className="font-semibold">
                            {new Date(assignmentDate).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* Layout original avec 2 colonnes */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Informations à gauche */}
              <div className="flex flex-col justify-between space-y-4">
                {/* Header avec infos */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-xl font-semibold">{zone.nom}</h3>
                    <Badge>Zone assignée</Badge>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium mb-1">
                          Localisation
                        </p>
                        <p className="font-semibold">{locationName}</p>
                      </div>
                    </div>

                    {assignmentDate && (
                      <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium mb-1">
                            Date d'assignation
                          </p>
                          <p className="font-semibold">
                            {new Date(assignmentDate).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Informations supplémentaires */}
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium mb-2">
                      Rayon de couverture
                    </p>
                    <p className="text-2xl font-bold">{(zone.rayon / 1000).toFixed(1)} km</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                        Surface
                      </p>
                      <p className="font-semibold">
                        {(Math.PI * Math.pow(zone.rayon / 1000, 2)).toFixed(1)} km²
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                        Immeubles
                      </p>
                      <p className="font-semibold text-lg">{immeublesWithCoordinates.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Carte carrée à droite */}
              <div className="relative">
                <div className="aspect-square rounded-lg overflow-hidden border-2 relative">
                  <MapContent height="100%" />

                  {/* Boutons de contrôle */}
                  <div className="absolute bottom-3 left-3 right-3 z-30 flex items-center justify-between gap-2">
                    <Button
                      variant={isMapLocked ? 'secondary' : 'default'}
                      size="sm"
                      onClick={() => setIsMapLocked(!isMapLocked)}
                      className="shadow-lg"
                      title={isMapLocked ? 'Déverrouiller la carte' : 'Verrouiller la carte'}
                    >
                      {isMapLocked ? (
                        <>
                          <Lock className="h-4 w-4 mr-2" />
                          Verrouillée
                        </>
                      ) : (
                        <>
                          <Unlock className="h-4 w-4 mr-2" />
                          Déverrouillée
                        </>
                      )}
                    </Button>

                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => setIsFullscreen(true)}
                      className="shadow-lg"
                      title="Agrandir la carte"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal plein écran */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col p-4 animate-in fade-in-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">
                {showAllImmeubles ? 'Carte des Immeubles' : zone.nom}
              </h2>
              <p className="text-muted-foreground">
                {showAllImmeubles
                  ? `${immeublesWithCoordinates.length} immeubles géolocalisés`
                  : locationName}
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={() => setIsFullscreen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 rounded-lg overflow-hidden border-2">
            <MapContent height="100%" showControls={true} />
          </div>
          <div className="grid grid-cols-4 gap-4 mt-4 p-4 bg-card rounded-lg border">
            {showAllImmeubles ? (
              <>
                <div>
                  <p className="text-muted-foreground uppercase tracking-wide text-xs font-medium mb-1">
                    Total Immeubles
                  </p>
                  <p className="font-semibold text-lg">{allImmeubles.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase tracking-wide text-xs font-medium mb-1">
                    Géolocalisés
                  </p>
                  <p className="font-semibold text-lg">{immeublesWithCoordinates.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase tracking-wide text-xs font-medium mb-1">
                    Total Étages
                  </p>
                  <p className="font-semibold text-lg">
                    {allImmeubles.reduce((sum, imm) => sum + (imm.nbEtages || 0), 0)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase tracking-wide text-xs font-medium mb-1">
                    Total Portes
                  </p>
                  <p className="font-semibold text-lg">
                    {allImmeubles.reduce(
                      (sum, imm) => sum + (imm.nbEtages || 0) * (imm.nbPortesParEtage || 0),
                      0
                    )}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-muted-foreground uppercase tracking-wide text-xs font-medium mb-1">
                    Nom de la zone
                  </p>
                  <p className="font-semibold">{zone.nom}</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase tracking-wide text-xs font-medium mb-1">
                    Rayon
                  </p>
                  <p className="font-semibold">{(zone.rayon / 1000).toFixed(1)} km</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase tracking-wide text-xs font-medium mb-1">
                    Immeubles
                  </p>
                  <p className="font-semibold text-lg">{immeublesWithCoordinates.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase tracking-wide text-xs font-medium mb-1">
                    Date d'assignation
                  </p>
                  <p className="font-semibold">
                    {assignmentDate
                      ? new Date(assignmentDate).toLocaleDateString('fr-FR')
                      : 'Non disponible'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
