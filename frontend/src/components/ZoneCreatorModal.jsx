import React, { useState, useEffect, useRef } from 'react'
import Map, { Marker, Source, Layer, NavigationControl, useControl } from 'react-map-gl/mapbox'
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'
import mapboxgl from 'mapbox-gl'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MultiSelect } from '@/components/ui/multi-select'
import { MapSkeleton } from '@/components/LoadingSkeletons'
import { X, Check, MousePointerClick, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThreeDButton, MapStyleButton, ZonesToggleButton } from './MapControls'

// Set Mapbox access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

// Helper functions
function haversineDistance(coords1, coords2) {
  const [lon1, lat1] = coords1
  const [lon2, lat2] = coords2
  const toRad = x => (x * Math.PI) / 180
  const R = 6371e3 // metres
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δφ = toRad(lat2 - lat1)
  const Δλ = toRad(lon2 - lon1)
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
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

// Geocoder Control Component
const GeocoderControl = React.memo(({ onResult, position }) => {
  useControl(
    () => {
      const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        marker: false,
        countries: 'fr', // France
        language: 'fr',
      })
      geocoder.on('result', onResult)
      return geocoder
    },
    { position }
  )
  return null
})

export const ZoneCreatorModal = ({
  onValidate,
  onClose,
  existingZones = [],
  zoneToEdit = null,
  userRole,
  assignableUsers = [],
  isSubmitting = false,
}) => {
  const isEditMode = !!zoneToEdit
  const mapRef = useRef(null)

  // Initialize state based on edit mode
  const [center, setCenter] = useState(
    isEditMode && zoneToEdit?.xOrigin && zoneToEdit?.yOrigin
      ? [zoneToEdit.xOrigin, zoneToEdit.yOrigin]
      : null
  )
  const [radius, setRadius] = useState(isEditMode ? zoneToEdit?.rayon || 1000 : 0)
  const [step, setStep] = useState(isEditMode ? 3 : 1)
  const [zoneName, setZoneName] = useState(isEditMode ? zoneToEdit?.nom || '' : '')
  const [assignedUserIds, setAssignedUserIds] = useState(
    isEditMode && zoneToEdit?.assignedUserIds
      ? zoneToEdit.assignedUserIds
      : isEditMode && zoneToEdit?.assignedUserId
        ? [zoneToEdit.assignedUserId]
        : []
  )
  const [zoneColor, setZoneColor] = useState(
    isEditMode && zoneToEdit?.id ? getZoneColor(zoneToEdit.id) : '#3388ff'
  )
  const [show3D, setShow3D] = useState(false)
  const [isSatellite, setIsSatellite] = useState(false)
  // Default to FALSE for existing zones
  const [showExistingZones, setShowExistingZones] = useState(false)
  const [mapLoading, setMapLoading] = useState(true)

  // Map view state - Focus sur l'Île-de-France
  const initialMapViewState =
    isEditMode && zoneToEdit?.xOrigin && zoneToEdit?.yOrigin
      ? {
          longitude: zoneToEdit.xOrigin,
          latitude: zoneToEdit.yOrigin,
          zoom: 12,
        }
      : {
          longitude: 2.3522, // Paris center
          latitude: 48.8566,
          zoom: 10, // Zoom pour voir l'Île-de-France
        }

  // Effect for 3D mode
  useEffect(() => {
    if (mapRef.current) {
      if (show3D) {
        mapRef.current.easeTo({ pitch: 60, bearing: -17.6, duration: 1500, essential: true })
      } else {
        mapRef.current.easeTo({ pitch: 0, bearing: 0, duration: 1000, essential: true })
      }
    }
  }, [show3D])

  // Removed auto-fit bounds on existing zones toggle to prevent unwanted zooming
  // Users typically want to stay in their current context when toggling layers

  const handleMapClick = e => {
    const { lng, lat } = e.lngLat
    if (step === 1) {
      setCenter([lng, lat])
      setStep(2)
    } else if (step === 2) {
      setStep(3)
    }
  }

  const handleMouseMove = e => {
    if (step === 2 && center) {
      const currentRadius = haversineDistance(center, [e.lngLat.lng, e.lngLat.lat])
      setRadius(currentRadius)
    }
  }

  const handleReset = () => {
    setCenter(null)
    setRadius(0)
    setStep(1)
    setZoneName('')
    setAssignedUserIds([])
    setZoneColor('#3388ff')
  }

  const handleValidate = () => {
    if (center && zoneName && radius > 0) {
      const zoneData = {
        nom: zoneName,
        xOrigin: center[0], // longitude
        yOrigin: center[1], // latitude
        rayon: Math.round(radius), // en mètres
      }

      if (isEditMode && zoneToEdit?.id) {
        zoneData.id = zoneToEdit.id
      }

      onValidate(zoneData, assignedUserIds)
    }
  }

  const handleGeocoderResult = e => {
    const { result } = e
    if (result && result.center) {
      // 1. Déplacer la carte
      mapRef.current?.flyTo({ center: result.center, zoom: 14 })
      
      // 2. Placer le marqueur central pour définir la zone
      setCenter([result.center[0], result.center[1]])
      
      // 3. Passer automatiquement à l'étape rayon si on est à l'étape 1
      if (step === 1) {
        setStep(2)
      }
    }
  }

  // Validation de la couleur pour s'assurer qu'elle est valide
  const validZoneColor = zoneColor.match(/^#[0-9A-Fa-f]{6}$/) ? zoneColor : '#3388ff'

  const isFormValid =
    center &&
    zoneName &&
    radius > 0 &&
    (userRole === 'directeur' || userRole === 'manager' || userRole === 'admin'
      ? assignedUserIds.length > 0
      : true)
  const currentCircleGeoJSON = center && radius > 0 ? createGeoJSONCircle(center, radius) : null

  /**
   * Détermine si une option doit être désactivée
   * CASCADE BACKEND:
   * - Directeur → assigne automatiquement ses managers ET commerciaux
   * - Manager → assigne automatiquement ses commerciaux
   */
  const getOptionDisabled = option => {
    // Extraire le role depuis le format "role-id"
    const [role] = option.value.split('-')

    // Les directeurs ne sont jamais désactivés
    if (role === 'directeur') return false

    // Vérifier si un directeur sélectionné gère cet utilisateur
    const hasDirecteurSelected = assignedUserIds.some(selectedValue => {
      const [selectedRole, selectedIdStr] = selectedValue.split('-')
      const selectedId = parseInt(selectedIdStr, 10)

      if (selectedRole === 'directeur' && option.directeurId === selectedId) {
        return true
      }
      return false
    })

    // Si c'est un manager et son directeur est sélectionné, le désactiver
    if (role === 'manager' && hasDirecteurSelected) {
      return true
    }

    // Si c'est un commercial
    if (role === 'commercial') {
      // Si son directeur est sélectionné, le désactiver
      if (hasDirecteurSelected) {
        return true
      }

      // Sinon, vérifier si son manager est sélectionné
      return assignedUserIds.some(selectedValue => {
        const [selectedRole, selectedIdStr] = selectedValue.split('-')
        const selectedId = parseInt(selectedIdStr, 10)

        // Si un manager est sélectionné et que c'est le manager de ce commercial
        if (selectedRole === 'manager' && option.managerId === selectedId) {
          return true
        }

        return false
      })
    }

    return false
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col animate-in fade-in duration-300">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/50 backdrop-blur-sm" />

      {/* Main Container */}
      <div className="relative flex-1 w-full flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-black/5 bg-background">
          
          {mapLoading && (
            <div className="absolute inset-0 z-20 bg-background/50 backdrop-blur-sm">
              <MapSkeleton />
            </div>
          )}

          <Map
            ref={mapRef}
            initialViewState={initialMapViewState}
            style={{ height: '100%', width: '100%' }}
            // Toggle between Standard Streets (colorful) and Satellite Streets
            mapStyle={isSatellite ? "mapbox://styles/mapbox/satellite-streets-v12" : "mapbox://styles/mapbox/streets-v12"}
            onClick={handleMapClick}
            onMouseMove={handleMouseMove}
            cursor={step < 3 ? 'crosshair' : 'default'}
            onLoad={() => setMapLoading(false)}
            onError={() => setMapLoading(false)}
            attributionControl={false} // Clean look
            logoPosition="bottom-left"
          >
            <NavigationControl position="top-right" showCompass={false} />
            <GeocoderControl onResult={handleGeocoderResult} position="top-left" />
            
            {/* Custom 3D Button */}
            <ThreeDButton onClick={() => setShow3D(!show3D)} show3D={show3D} />
            
            {/* Custom Map Style Button */}
            <MapStyleButton onClick={() => setIsSatellite(!isSatellite)} isSatellite={isSatellite} />
            
            {/* Custom Existing Zones Toggle Button */}
            <ZonesToggleButton onClick={() => setShowExistingZones(!showExistingZones)} showZones={showExistingZones} />

            {/* 3D Buildings Layer */}
            {show3D && (
              <Layer
                id="3d-buildings"
                source="composite"
                source-layer="building"
                filter={['==', 'extrude', 'true']}
                type="fill-extrusion"
                minzoom={14}
                paint={{
                  'fill-extrusion-color': '#e5e5e5',
                  'fill-extrusion-height': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14,
                    0,
                    14.05,
                    ['get', 'height'],
                  ],
                  'fill-extrusion-base': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14,
                    0,
                    14.05,
                    ['get', 'min_height'],
                  ],
                  'fill-extrusion-opacity': 0.8,
                }}
              />
            )}

            {/* Display existing zones - CONDITIONAL RENDERING */}
            {showExistingZones && existingZones
              .filter(z => z.id !== zoneToEdit?.id && z.xOrigin && z.yOrigin)
              .map(zone => {
                const circle = createGeoJSONCircle([zone.xOrigin, zone.yOrigin], zone.rayon || 1000)
                const color = getZoneColor(zone.id)
                return (
                  <Source
                    key={`existing-${zone.id}`}
                    id={`existing-${zone.id}`}
                    type="geojson"
                    data={circle}
                  >
                    <Layer
                      key={`fill-existing-${zone.id}`}
                      id={`fill-existing-${zone.id}`}
                      type="fill"
                      paint={{
                        'fill-color': color,
                        'fill-opacity': isSatellite ? 0.25 : 0.1, // Increased opacity in satellite mode
                      }}
                    />
                    <Layer
                      key={`line-existing-${zone.id}`}
                      id={`line-existing-${zone.id}`}
                      type="line"
                      paint={{
                        'line-color': isSatellite ? '#ffffff' : color, // Use white lines in satellite for contrast, or stick to color
                        'line-width': 1.5,
                        'line-dasharray': [2, 2],
                        'line-opacity': 0.8,
                      }}
                    />
                  </Source>
                )
              })}

            {/* Display current zone being created/edited */}
            {center && <Marker longitude={center[0]} latitude={center[1]} color={validZoneColor} />}
            {currentCircleGeoJSON && (
              <Source id="current-zone" type="geojson" data={currentCircleGeoJSON}>
                <Layer
                  key="current-zone-fill"
                  id="current-zone-fill"
                  type="fill"
                  paint={{ 'fill-color': validZoneColor, 'fill-opacity': isSatellite ? 0.4 : 0.25 }}
                />
                <Layer
                  key="current-zone-line"
                  id="current-zone-line"
                  type="line"
                  paint={{ 'line-color': validZoneColor, 'line-width': 2 }}
                />
              </Source>
            )}
          </Map>

          {/* Premium Glassmorphic Control Panel */}
          <div className="absolute top-4 right-14 w-full max-w-[400px] z-20 pointer-events-none">
             <div className="pointer-events-auto bg-card/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl p-6 animate-in slide-in-from-right-10 duration-500">
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {isEditMode ? 'Modifier la Zone' : 'Nouvelle Zone'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {step === 1 && 'Définissez le centre géographique'}
                    {step === 2 && 'Ajustez le rayon de couverture'}
                    {step === 3 && 'Configurez les détails et assignations'}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onClose} 
                  className="rounded-full hover:bg-destructive/10 hover:text-destructive -mr-2 -mt-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Progress Indicator */}
              {!isEditMode && (
                <div className="flex gap-2 mb-6">
                  {[1, 2, 3].map((s) => (
                    <div 
                      key={s} 
                      className={cn(
                        "h-1.5 flex-1 rounded-full transition-all duration-300",
                        step >= s ? "bg-primary" : "bg-primary/20"
                      )} 
                    />
                  ))}
                </div>
              )}

              {/* Step Instructions & Inputs */}
              <div className="space-y-6">
                
                {/* Step 1 & 2 Info */}
                {step < 3 && (
                  <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-start gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <MousePointerClick className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm text-foreground">
                        {step === 1 ? 'Cliquez sur la carte' : 'Ajustez le rayon'}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                        {step === 1 
                          ? 'Positionnez le marqueur central pour définir le point de départ de votre zone.'
                          : 'Déplacez votre souris pour agrandir ou réduire la zone, puis cliquez pour valider.'
                        }
                      </p>
                    </div>
                  </div>
                )}

                {/* Live Data Display */}
                {center && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Centre</span>
                      <div className="font-mono text-sm bg-muted/50 p-2 rounded-lg border border-border/50">
                        {center[1].toFixed(4)}, {center[0].toFixed(4)}
                      </div>
                    </div>
                    {radius > 0 && (
                       <div className="space-y-1">
                       <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rayon</span>
                       <div className="font-mono text-sm bg-muted/50 p-2 rounded-lg border border-border/50">
                         {(radius / 1000).toFixed(2)} km
                       </div>
                     </div>
                    )}
                  </div>
                )}

                {/* Form Fields (Step 3) */}
                {(step >= 3 || isEditMode) && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="space-y-2">
                      <Label htmlFor="zone-name" className="text-sm font-medium">Nom de la zone</Label>
                      <Input
                        id="zone-name"
                        value={zoneName}
                        onChange={e => setZoneName(e.target.value)}
                        placeholder="Ex: Paris Centre - Secteur 1"
                        className="bg-background/50 border-input/50 focus:bg-background transition-colors"
                      />
                    </div>

                    {(userRole === 'admin' || userRole === 'directeur' || userRole === 'manager') && (
                      <div className="space-y-2">
                        <Label htmlFor="assigned-users" className="text-sm font-medium">
                          {userRole === 'admin'
                            ? 'Responsables assignés'
                            : 'Membres assignés'}
                        </Label>
                        <MultiSelect
                          id="assigned-users"
                          options={assignableUsers.map(user => ({
                            value: `${user.role}-${user.id}`,
                            label: `${user.name} (${user.role})`,
                            group: user.role === 'directeur' ? 'Directeurs' : user.role === 'manager' ? 'Managers' : 'Commerciaux',
                            managerId: user.managerId,
                            directeurId: user.directeurId
                          }))}
                          selected={assignedUserIds}
                          onChange={setAssignedUserIds}
                          getOptionDisabled={getOptionDisabled}
                          placeholder="Sélectionner des membres..."
                          emptyText="Aucun membre disponible"
                          className="bg-background/50 border-input/50"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                   {!isEditMode && step > 1 && (
                    <Button 
                      variant="outline" 
                      onClick={handleReset}
                      className="gap-2 text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset
                    </Button>
                   )}
                  
                  <div className="flex-1 flex justify-end gap-3">
                    <Button onClick={onClose} variant="ghost" disabled={isSubmitting}>
                      Annuler
                    </Button>
                    <Button
                      onClick={handleValidate}
                      disabled={!isFormValid || isSubmitting}
                      className={cn(
                        "transition-all duration-300",
                        isFormValid ? "bg-primary shadow-lg shadow-primary/25 hover:shadow-primary/40" : ""
                      )}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                          Sauvegarde...
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          {isEditMode ? 'Enregistrer' : 'Créer'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

              </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ZoneCreatorModal
