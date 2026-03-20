import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import MapboxMap, { Marker, NavigationControl } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import mapboxgl from 'mapbox-gl'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { MapSkeleton, TableSkeleton } from '@/components/LoadingSkeletons'
import { useCommercials, useManagers } from '@/services'
import { useEntityPage } from '@/hooks/metier/permissions/useRoleBasedData'
import { useErrorToast } from '@/hooks/utils/ui/use-error-toast'
import {
  MapPin,
  Search,
  Users,
  Navigation2,
  Locate,
  Phone,
  Mail,
  User2,
  AlertCircle,
  Maximize2,
  X,
} from 'lucide-react'

// Configuration Mapbox
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN
}
// Générer position GPS simulée
const generateMockGPSPosition = commercialId => {
  const centerLat = 48.8566
  const centerLng = 2.3522
  const radius = 0.15
  const seed = commercialId * 123456
  return {
    latitude: centerLat + Math.sin(seed) * radius,
    longitude: centerLng + Math.cos(seed) * radius,
    lastUpdate: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
  }
}

// Formater le temps écoulé
const formatLastUpdate = dateString => {
  const diffMins = Math.floor((new Date() - new Date(dateString)) / 60000)
  if (diffMins < 1) return "À l'instant"
  if (diffMins < 60) return `Il y a ${diffMins} min`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `Il y a ${diffHours}h`
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Composant CommercialListItem
const CommercialListItem = React.memo(function CommercialListItem({
  commercial,
  gpsData,
  isSelected,
  onClick,
  onLocate,
}) {
  const itemRef = useRef(null)
  const wasSelectedRef = useRef(false)

  // Scroll smoothly to the selected item when it becomes selected
  useEffect(() => {
    if (isSelected && itemRef.current && !wasSelectedRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
    wasSelectedRef.current = isSelected
  }, [isSelected])

  const isActive = gpsData && new Date(gpsData.lastUpdate) > new Date(Date.now() - 3600000)

  return (
    <button
      type="button"
      ref={itemRef}
      aria-pressed={isSelected}
      onClick={onClick}
      className={`group p-3 sm:p-4 rounded-lg border cursor-pointer outline-none transition-all duration-200 ease-out scroll-mt-2
        ${
          isSelected
            ? 'bg-primary/10 border-primary shadow-sm ring-2 ring-primary/40'
            : 'bg-card hover:bg-accent/50 border-border hover:translate-y-px active:scale-[0.98]'
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-sm truncate">
                {commercial.prenom} {commercial.nom}
              </h3>
              <Badge variant={isActive ? 'default' : 'secondary'} className="h-5 text-xs shrink-0">
                {isActive ? 'Actif' : 'Inactif'}
              </Badge>
            </div>

            <div className="space-y-1 text-xs text-muted-foreground">
              {commercial.email && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{commercial.email}</span>
                </div>
              )}
              {commercial.numTel && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="truncate">{commercial.numTel}</span>
                </div>
              )}
              {gpsData && (
                <div className="flex items-center gap-1.5 text-green-600">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{formatLastUpdate(gpsData.lastUpdate)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {gpsData && (
          <button
            type="button"
            title="Centrer sur la carte"
            aria-label={`Centrer la carte sur ${commercial.prenom} ${commercial.nom}`}
            className="h-8 w-8 p-0 shrink-0 rounded-md hover:bg-accent transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={e => {
              e.stopPropagation()
              onLocate?.()
            }}
          >
            <Locate className="h-4 w-4" />
          </button>
        )}
      </div>
    </button>
  )
})

export default function GPSTracking() {
  const { data: commercials, loading, error } = useCommercials()
  const { data: managers } = useManagers()
  const { showError, showInfo } = useErrorToast()

  // Utilisation du système de rôles
  const { data: filteredCommercials, description } = useEntityPage('commerciaux', commercials, {
    managers,
  })

  // État local
  const [selectedCommercialId, setSelectedCommercialId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [mapLoading, setMapLoading] = useState(true)
  const [mapError, setMapError] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!isFullscreen) return
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        setIsFullscreen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isFullscreen])

  // Vérifier token Mapbox
  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      const errorMsg =
        'Token Mapbox manquant. Créez un fichier .env avec VITE_MAPBOX_ACCESS_TOKEN=votre_token'
      setMapError(errorMsg)
      showError(new Error(errorMsg), 'GPSTracking.mapboxToken')
    }
  }, [showError])

  // Préparer les données avec GPS
  const commercialsWithGPS = useMemo(() => {
    if (!filteredCommercials) return []
    return filteredCommercials.map(commercial => ({
      ...commercial,
      gpsData: generateMockGPSPosition(commercial.id),
    }))
  }, [filteredCommercials])

  // Filtrer par recherche
  const searchedCommercials = useMemo(() => {
    if (!searchQuery.trim()) return commercialsWithGPS
    const query = searchQuery.toLowerCase()
    return commercialsWithGPS.filter(
      commercial =>
        `${commercial.prenom} ${commercial.nom}`.toLowerCase().includes(query) ||
        commercial.email?.toLowerCase().includes(query) ||
        commercial.numTel?.includes(query)
    )
  }, [commercialsWithGPS, searchQuery])

  // Sélectionner premier commercial auto
  useEffect(() => {
    if (!selectedCommercialId && searchedCommercials.length > 0) {
      setSelectedCommercialId(searchedCommercials[0].id)
    }
  }, [searchedCommercials, selectedCommercialId])

  // Centrer carte sur commercial
  const flyToCommercial = useCallback(
    commercial => {
      if (!mapRef.current || !commercial.gpsData) return
      try {
        mapRef.current.flyTo({
          center: [commercial.gpsData.longitude, commercial.gpsData.latitude],
          zoom: 14,
          duration: 1500,
        })
      } catch (err) {
        showError(err, 'GPSTracking.flyToCommercial')
      }
    },
    [showError]
  )

  // Gestion chargement carte
  const handleMapLoad = useCallback(() => {
    setMapLoading(false)
    if (filteredCommercials?.length > 0) {
      showInfo(
        `${filteredCommercials.length} commercial${filteredCommercials.length > 1 ? 'aux' : ''} localisé${filteredCommercials.length > 1 ? 's' : ''}`,
        { duration: 2000 }
      )
    }
  }, [filteredCommercials, showInfo])

  // Gestion erreur carte
  const handleMapError = useCallback(
    evt => {
      console.error('Mapbox error:', evt.error)
      setMapError('Erreur lors du chargement de la carte')
      showError(evt.error || new Error('Erreur Mapbox'), 'GPSTracking.mapLoad')
    },
    [showError]
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Suivi GPS</h1>
          <p className="text-muted-foreground text-base">
            Localisation en temps réel de vos commerciaux
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <TableSkeleton />
          </div>
          <div className="lg:col-span-2">
            <MapSkeleton />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Suivi GPS</h1>
          <p className="text-muted-foreground text-base">
            Localisation en temps réel de vos commerciaux
          </p>
        </div>
        <div className="p-6 border border-red-200 rounded-lg bg-red-50">
          <p className="text-red-800">Erreur lors du chargement des données : {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Suivi GPS</h1>
            <p className="text-muted-foreground text-base">{description}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground truncate">Total Commerciaux</p>
              <p className="text-2xl font-bold">{searchedCommercials.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground truncate">Actifs (1h)</p>
              <p className="text-2xl font-bold">
                {
                  searchedCommercials.filter(
                    c =>
                      c.gpsData && new Date(c.gpsData.lastUpdate) > new Date(Date.now() - 3600000)
                  ).length
                }
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Contenu principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Liste */}
        <div className="lg:col-span-1">
          <Card className="h-[400px] sm:h-[500px] lg:h-[calc(100vh-25rem)]">
            <div className="p-3 sm:p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un commercial..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="h-[calc(100%-3.5rem)] sm:h-[calc(100%-4rem)] overflow-y-auto">
              <div className="p-3 sm:p-4 space-y-2">
                {searchedCommercials.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>Aucun commercial trouvé</p>
                  </div>
                ) : (
                  searchedCommercials.map(commercial => (
                    <CommercialListItem
                      key={commercial.id}
                      commercial={commercial}
                      gpsData={commercial.gpsData}
                      isSelected={commercial.id === selectedCommercialId}
                      onClick={() => {
                        setSelectedCommercialId(commercial.id)
                        flyToCommercial(commercial)
                      }}
                      onLocate={() => {
                        setSelectedCommercialId(commercial.id)
                        flyToCommercial(commercial)
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Carte */}
        <div className="lg:col-span-2">
          <Card className="h-[400px] sm:h-[500px] lg:h-[calc(100vh-25rem)] overflow-hidden relative p-0">
            {mapLoading && (
              <div className="absolute inset-0 z-10">
                <MapSkeleton />
              </div>
            )}

            {mapError ? (
              <div className="flex items-center justify-center h-full p-8">
                <div className="text-center max-w-md">
                  <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Erreur de configuration</h3>
                  <p className="text-sm text-muted-foreground mb-4">{mapError}</p>
                  <div className="text-xs text-left bg-muted p-3 rounded-md">
                    <p className="font-mono">
                      1. Créez un compte sur mapbox.com
                      <br />
                      2. Créez un fichier .env dans /frontend
                      <br />
                      3. Ajoutez: VITE_MAPBOX_ACCESS_TOKEN=votre_token
                      <br />
                      4. Redémarrez le serveur dev
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <MapboxMap
                  ref={mapRef}
                  initialViewState={{
                    longitude: 2.3522,
                    latitude: 48.8566,
                    zoom: 11,
                  }}
                  style={{ width: '100%', height: '100%' }}
                  mapStyle="mapbox://styles/mapbox/streets-v12"
                  onLoad={handleMapLoad}
                  onError={handleMapError}
                >
                  <NavigationControl position="top-right" />

                  {searchedCommercials.map(commercial => {
                    if (!commercial.gpsData) return null

                    const isSelected = commercial.id === selectedCommercialId
                    const isActive =
                      new Date(commercial.gpsData.lastUpdate) > new Date(Date.now() - 3600000)

                    return (
                      <Marker
                        key={commercial.id}
                        longitude={commercial.gpsData.longitude}
                        latitude={commercial.gpsData.latitude}
                        anchor="bottom"
                        onClick={() => {
                          setSelectedCommercialId(commercial.id)
                          flyToCommercial(commercial)
                        }}
                      >
                        <div className="relative cursor-pointer group">
                          <div
                            className={`w-10 h-10 rounded-full border-4 border-white shadow-lg flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-primary scale-125 ring-4 ring-primary/30'
                                : isActive
                                  ? 'bg-green-500 hover:scale-110'
                                  : 'bg-gray-400 hover:scale-110'
                            }`}
                          >
                            <MapPin className="h-5 w-5 text-white" />
                          </div>

                          <div
                            className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-black/90 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${isSelected ? 'opacity-100' : ''}`}
                          >
                            {commercial.prenom} {commercial.nom}
                            <div className="text-[10px] text-gray-200">
                              {formatLastUpdate(commercial.gpsData.lastUpdate)}
                            </div>
                          </div>
                        </div>
                      </Marker>
                    )
                  })}
                </MapboxMap>

                {/* Bouton Fullscreen */}
                <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 z-30">
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(true)}
                    className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-background border-2 border-border shadow-lg hover:bg-accent transition-colors flex items-center justify-center"
                    title="Agrandir la carte"
                    aria-label="Ouvrir la carte en plein écran"
                  >
                    <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* Modal Fullscreen */}
      {isFullscreen && (
        <div className="fixed inset-0 z-100 bg-background/95 backdrop-blur-sm flex flex-col p-2 sm:p-4 animate-in fade-in-0">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Navigation2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-2xl font-bold truncate">Suivi GPS - Vue complète</h2>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {searchedCommercials.length} commercial
                  {searchedCommercials.length > 1 ? 'aux' : ''} affiché
                  {searchedCommercials.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="h-10 w-10 rounded-lg border-2 border-border hover:bg-accent transition-colors flex items-center justify-center shrink-0"
              aria-label="Fermer la vue plein écran"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 rounded-lg overflow-hidden border-2">
            {mapError ? (
              <div className="flex items-center justify-center h-full bg-card">
                <div className="text-center max-w-md">
                  <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Erreur de configuration</h3>
                  <p className="text-sm text-muted-foreground">{mapError}</p>
                </div>
              </div>
            ) : (
              <MapboxMap
                initialViewState={{
                  longitude: 2.3522,
                  latitude: 48.8566,
                  zoom: 11,
                }}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/streets-v12"
              >
                <NavigationControl position="top-right" />

                {searchedCommercials.map(commercial => {
                  if (!commercial.gpsData) return null

                  const isSelected = commercial.id === selectedCommercialId
                  const isActive =
                    new Date(commercial.gpsData.lastUpdate) > new Date(Date.now() - 3600000)

                  return (
                    <Marker
                      key={commercial.id}
                      longitude={commercial.gpsData.longitude}
                      latitude={commercial.gpsData.latitude}
                      anchor="bottom"
                      onClick={() => {
                        setSelectedCommercialId(commercial.id)
                        flyToCommercial(commercial)
                      }}
                    >
                      <div className="relative cursor-pointer group">
                        <div
                          className={`w-12 h-12 rounded-full border-4 border-white shadow-lg flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-primary scale-125 ring-4 ring-primary/30'
                              : isActive
                                ? 'bg-green-500 hover:scale-110'
                                : 'bg-gray-400 hover:scale-110'
                          }`}
                        >
                          <MapPin className="h-6 w-6 text-white" />
                        </div>

                        <div
                          className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-2 rounded-lg bg-black/90 text-white text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${isSelected ? 'opacity-100' : ''}`}
                        >
                          {commercial.prenom} {commercial.nom}
                          <div className="text-xs text-gray-200">
                            {formatLastUpdate(commercial.gpsData.lastUpdate)}
                          </div>
                        </div>
                      </div>
                    </Marker>
                  )
                })}
              </MapboxMap>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 p-4 bg-card rounded-lg border-2">
            <div className="min-w-0">
              <p className="text-muted-foreground uppercase tracking-wide text-xs font-medium mb-1 truncate">
                Total Commerciaux
              </p>
              <p className="font-semibold text-lg">{searchedCommercials.length}</p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground uppercase tracking-wide text-xs font-medium mb-1 truncate">
                Actifs (1h)
              </p>
              <p className="font-semibold text-lg text-green-600">
                {
                  searchedCommercials.filter(
                    c =>
                      c.gpsData && new Date(c.gpsData.lastUpdate) > new Date(Date.now() - 3600000)
                  ).length
                }
              </p>
            </div>
            <div className="min-w-0 sm:col-span-2 lg:col-span-1">
              <p className="text-muted-foreground uppercase tracking-wide text-xs font-medium mb-1 truncate">
                Sélectionné
              </p>
              <p className="font-semibold text-lg truncate">
                {selectedCommercialId
                  ? searchedCommercials.find(c => c.id === selectedCommercialId)?.prenom +
                    ' ' +
                    searchedCommercials.find(c => c.id === selectedCommercialId)?.nom
                  : 'Aucun'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
