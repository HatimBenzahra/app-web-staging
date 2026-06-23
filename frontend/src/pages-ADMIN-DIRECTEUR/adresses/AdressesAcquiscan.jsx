import React, { useEffect, useMemo, useRef, useState } from 'react'
import MapboxMap, { Layer, NavigationControl, Source } from 'react-map-gl/mapbox'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Crosshair,
  Layers,
  LocateFixed,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdressesAcquiscanLogic } from './useAdressesAcquiscanLogic'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN
}

const fmtInt = value => Number(value || 0).toLocaleString('fr-FR')
const formatAddress = row =>
  [row.addrNumero, row.addrNomVoie, row.addrNomCommune].filter(Boolean).join(' ') || row.imbCode || row.immeubleId

const collectCoordinates = geometry => {
  if (!geometry) return []
  if (geometry.type === 'Point') return [geometry.coordinates]
  if (geometry.type === 'Polygon') return geometry.coordinates.flat()
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat(2)
  return []
}

const fitFeature = (map, feature, padding = 48) => {
  if (!map || !feature?.geometry) return
  const coordinates = collectCoordinates(feature.geometry)
  if (!coordinates.length) return
  const bounds = coordinates.reduce((acc, coord) => acc.extend(coord), new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]))
  map.fitBounds(bounds, { padding, duration: 650, maxZoom: 15 })
}

const createCircleGeoJson = circle => {
  if (!circle) return { type: 'FeatureCollection', features: [] }
  const points = 80
  const coordinates = []
  const lat = circle.latitude
  const lng = circle.longitude
  const latRadius = circle.radiusMeters / 111320
  const lngRadius = circle.radiusMeters / (111320 * Math.max(Math.cos(lat * Math.PI / 180), 0.2))
  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * Math.PI * 2
    coordinates.push([
      lng + Math.cos(angle) * lngRadius,
      lat + Math.sin(angle) * latRadius,
    ])
  }
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coordinates] },
      properties: {},
    }],
  }
}

const clusterLayer = {
  id: 'acquiscan-clusters',
  type: 'circle',
  paint: {
    'circle-color': ['step', ['get', 'count'], '#475569', 50, '#f59e0b', 250, '#ef4444'],
    'circle-radius': ['step', ['get', 'count'], 18, 50, 25, 250, 34],
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 2,
  },
}

const clusterCountLayer = {
  id: 'acquiscan-cluster-count',
  type: 'symbol',
  layout: {
    'text-field': ['to-string', ['get', 'count']],
    'text-size': 12,
    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
  },
  paint: {
    'text-color': '#ffffff',
  },
}

const nationalClusterLayer = {
  ...clusterLayer,
  paint: {
    'circle-color': ['step', ['get', 'count'], '#475569', 100000, '#f59e0b', 250000, '#ef4444'],
    'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 11, 100000, 15, 300000, 19, 700000, 23],
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 2,
    'circle-opacity': 0.9,
  },
}

const nationalClusterCountLayer = {
  ...clusterCountLayer,
  layout: {
    ...clusterCountLayer.layout,
    'text-field': ['concat', ['to-string', ['round', ['/', ['get', 'count'], 1000]]], 'k'],
    'text-size': 11,
  },
}

const pointLayer = {
  id: 'acquiscan-points',
  type: 'circle',
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['get', 'score'], 40, 5, 80, 9],
    'circle-color': ['step', ['get', 'score'], '#64748b', 55, '#f59e0b', 75, '#ef4444'],
    'circle-opacity': ['coalesce', ['get', 'opacity'], 1],
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 2,
  },
}

const selectedPointLayer = {
  id: 'acquiscan-selected-point',
  type: 'circle',
  paint: {
    'circle-radius': 13,
    'circle-color': '#ef4444',
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 5,
  },
}

const searchTargetHaloLayer = {
  id: 'acquiscan-search-target-halo',
  type: 'circle',
  paint: {
    'circle-radius': 24,
    'circle-color': '#ef4444',
    'circle-opacity': 0.18,
    'circle-stroke-color': '#ef4444',
    'circle-stroke-width': 2,
    'circle-stroke-opacity': 0.35,
  },
}

const searchTargetLayer = {
  id: 'acquiscan-search-target',
  type: 'circle',
  paint: {
    'circle-radius': 10,
    'circle-color': '#ef4444',
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 4,
  },
}

const zoneCircleFillLayer = {
  id: 'acquiscan-zone-circle-fill',
  type: 'fill',
  paint: {
    'fill-color': '#ef4444',
    'fill-opacity': 0.12,
  },
}

const zoneCircleLineLayer = {
  id: 'acquiscan-zone-circle-line',
  type: 'line',
  paint: {
    'line-color': '#ef4444',
    'line-width': 2,
    'line-dasharray': [2, 2],
  },
}

const zoneTargetLayer = {
  id: 'acquiscan-zone-targets',
  type: 'circle',
  paint: {
    'circle-radius': ['case', ['get', 'excluded'], 5, 8],
    'circle-color': ['case', ['get', 'excluded'], '#94a3b8', '#ef4444'],
    'circle-opacity': ['case', ['get', 'excluded'], 0.45, 0.9],
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 2,
  },
}

const building3dLayer = {
  id: 'acquiscan-3d-buildings',
  source: 'composite',
  'source-layer': 'building',
  filter: ['==', ['get', 'extrude'], 'true'],
  type: 'fill-extrusion',
  minzoom: 14,
  paint: {
    'fill-extrusion-color': '#94a3b8',
    'fill-extrusion-height': [
      'interpolate',
      ['linear'],
      ['zoom'],
      14,
      0,
      15,
      ['coalesce', ['get', 'height'], 18],
    ],
    'fill-extrusion-base': [
      'interpolate',
      ['linear'],
      ['zoom'],
      14,
      0,
      15,
      ['coalesce', ['get', 'min_height'], 0],
    ],
    'fill-extrusion-opacity': 0.55,
  },
}

const territoryFillLayer = {
  id: 'acquiscan-territory-fill',
  type: 'fill',
  paint: {
    'fill-color': [
      'interpolate',
      ['linear'],
      ['coalesce', ['get', 'opportunityScore'], 0],
      0,
      '#21465d',
      45,
      '#2f6b8b',
      65,
      '#3b99c9',
      82,
      '#48a878',
    ],
    'fill-opacity': 0.9,
  },
}

const territoryLineLayer = {
  id: 'acquiscan-territory-line',
  type: 'line',
  paint: {
    'line-color': '#ffffff',
    'line-width': 1.8,
    'line-opacity': 0.95,
  },
}

const territoryLabelLayer = {
  id: 'acquiscan-territory-label',
  type: 'symbol',
  minzoom: 6,
  layout: {
    'text-field': ['coalesce', ['get', 'name'], ['get', 'code']],
    'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 10, 12],
    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
  },
  paint: {
    'text-color': '#0f2534',
    'text-halo-color': '#ffffff',
    'text-halo-width': 1.4,
    'text-opacity': 0.72,
  },
}

const copperSegment = row => {
  if (row.fermetureTechnique === '1') {
    return {
      label: 'Fermeture technique',
      className: 'border-red-200 bg-red-50 text-red-700',
      title: 'DSLAM en cours de démantèlement - migration fibre obligatoire',
    }
  }
  if (row.fermetureComAddr === '1') {
    return {
      label: 'Commerciale adresse',
      className: 'border-orange-200 bg-orange-50 text-orange-700',
      title: 'Fermeture commerciale annoncée pour cette adresse',
    }
  }
  if (row.fermetureComZone === '1') {
    return {
      label: 'Commerciale zone',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
      title: 'Fermeture commerciale annoncée sur la zone',
    }
  }
  return {
    label: 'Cuivre actif',
    className: 'border-slate-200 bg-slate-50 text-slate-700',
    title: "Aucune fermeture annoncée par l'ARCEP",
  }
}

const scoreTone = score => {
  if (score >= 75) return 'border-red-200 bg-red-50 text-red-700'
  if (score >= 55) return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

const FILTER_LABELS = {
  segment: {
    all: 'Étape cuivre: toutes',
    urgent: 'Fermeture technique',
    chaud: 'Commerciale adresse',
    tiede: 'Commerciale zone',
    froid: 'Cuivre actif',
  },
  fiber: {
    all: 'Fibre: toutes',
    yes: 'Fibre: oui',
    no: 'Fibre: non',
  },
  annee: {
    all: 'Toutes années',
    current: 'Année courante',
    future: 'Après année courante',
  },
  coverage4g: {
    all: '4G: toutes',
    eleve: '4G élevée',
    moyen: '4G moyenne',
    faible: '4G faible',
  },
  coverage5g: {
    all: '5G: toutes',
    eleve: '5G élevée',
    moyen: '5G moyenne',
    faible: '5G faible',
  },
}

const FILTER_RESET_VALUES = {
  dept: '',
  commune: '',
  segment: 'all',
  fiber: 'all',
  annee: 'all',
  coverage4g: 'all',
  coverage5g: 'all',
}

export default function AdressesAcquiscan() {
  const {
    filters,
    updateFilter,
    resetFilters,
    territoryLevel,
    selectedDept,
    selectedCommune,
    territoryGeoJson,
    territoryLoading,
    territoryError,
    selectDepartment,
    selectCommune,
    goBackTerritory,
    clearSearchSelection,
    addressQuery,
    setAddressQuery,
    suggestions,
    suggestionsLoading,
    suggestionsError,
    selectedSuggestion,
    selectSuggestion,
    searchRadiusMeters,
    committedSearchRadiusMeters,
    updateSearchRadius,
    searchPreview,
    searchPreviewLoading,
    searchPreviewError,
    hasSearchMode,
    initialViewState,
    updateMapViewport,
    rows,
    clusters,
    selectedAddress,
    setSelectedId,
    zoneMode,
    startZoneMode,
    stopZoneMode,
    draftCircle,
    setZoneCenter,
    updateZoneRadius,
    zonePreview,
    zonePreviewLoading,
    zonePreviewError,
    excludedTargetIds,
    toggleZoneTarget,
    selectedZoneTargetIds,
    assignableUsers,
    selectedAssignmentIds,
    selectedAssignments,
    toggleAssignment,
    zoneName,
    setZoneName,
    createZoneFromPreview,
    zoneCreateLoading,
    zoneCreateError,
    createdZone,
    stats,
    loading,
    mapLoading,
    listLoading,
    error,
    refetch,
  } = useAdressesAcquiscanLogic()
  const mapRef = useRef(null)
  const lastFocusedSuggestionId = useRef(null)
  const lastFocusedAddressId = useRef(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/streets-v12')
  const [isPitched, setIsPitched] = useState(false)

  const activeFilters = useMemo(() => {
    const entries = []
    if (filters.segment !== 'all') entries.push({ key: 'segment', label: FILTER_LABELS.segment[filters.segment] })
    if (filters.fiber !== 'all') entries.push({ key: 'fiber', label: FILTER_LABELS.fiber[filters.fiber] })
    if (filters.annee !== 'all') entries.push({ key: 'annee', label: FILTER_LABELS.annee[filters.annee] })
    if (filters.coverage4g !== 'all') entries.push({ key: 'coverage4g', label: FILTER_LABELS.coverage4g[filters.coverage4g] })
    if (filters.coverage5g !== 'all') entries.push({ key: 'coverage5g', label: FILTER_LABELS.coverage5g[filters.coverage5g] })
    return entries
  }, [filters])

  const pointsGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: rows.map(row => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [row.coordinates.longitude, row.coordinates.latitude],
        },
        properties: {
          id: row.immeubleId,
          score: row.opportunityScore || 50,
          opacity: zoneMode ? 0.32 : 1,
          address: formatAddress(row),
        },
      })),
    }),
    [rows, zoneMode]
  )

  const clustersGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: clusters.map(cluster => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [cluster.longitude, cluster.latitude],
        },
        properties: {
          id: cluster.id,
          count: cluster.count,
        },
      })),
    }),
    [clusters]
  )

  const selectedGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: selectedAddress?.coordinates
        ? [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [selectedAddress.coordinates.longitude, selectedAddress.coordinates.latitude],
              },
              properties: { id: selectedAddress.immeubleId },
            },
          ]
        : [],
    }),
    [selectedAddress]
  )

  const searchTargetGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: selectedSuggestion
        ? [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [selectedSuggestion.longitude, selectedSuggestion.latitude],
              },
              properties: { id: selectedSuggestion.id },
            },
          ]
        : [],
    }),
    [selectedSuggestion]
  )

  const searchCircle = useMemo(() => (
    selectedSuggestion
      ? {
          longitude: selectedSuggestion.longitude,
          latitude: selectedSuggestion.latitude,
          radiusMeters: searchRadiusMeters,
        }
      : null
  ), [searchRadiusMeters, selectedSuggestion])
  const visibleCircle = draftCircle || searchCircle
  const zoneCircleGeoJson = useMemo(() => createCircleGeoJson(visibleCircle), [visibleCircle])

  const zoneTargetsGeoJson = useMemo(() => {
    const excluded = new Set(excludedTargetIds)
    return {
      type: 'FeatureCollection',
      features: (zonePreview?.targets || []).map(target => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [target.longitude, target.latitude],
        },
        properties: {
          id: target.immeubleId,
          excluded: excluded.has(target.immeubleId),
          score: target.opportunityScore,
        },
      })),
    }
  }, [excludedTargetIds, zonePreview?.targets])

  const handleMoveEnd = event => {
    const map = event.target
    const bounds = map.getBounds()
    updateMapViewport(
      {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      },
      event.viewState.zoom
    )
  }

  const handleMapClick = event => {
    const feature = event.features?.[0]
    if (zoneMode && !feature && event.lngLat) {
      setZoneCenter(event.lngLat.lng, event.lngLat.lat)
      return
    }
    if (!feature) return

    if (feature.layer.id === 'acquiscan-territory-fill') {
      const territory = {
        code: feature.properties?.code,
        name: feature.properties?.name || feature.properties?.nom,
      }
      if (territoryLevel === 'france') {
        selectDepartment(territory)
        fitFeature(mapRef.current, feature, 64)
        return
      }
      if (territoryLevel === 'department') {
        selectCommune(territory)
        fitFeature(mapRef.current, feature, 72)
        return
      }
    }

    if (feature.layer.id === 'acquiscan-clusters' || feature.layer.id === 'acquiscan-cluster-count') {
      mapRef.current?.flyTo({
        center: feature.geometry.coordinates,
        zoom: Math.min((mapRef.current?.getZoom?.() || initialViewState.zoom) + 2.2, 14),
        duration: 650,
      })
      return
    }

    if (feature.layer.id === 'acquiscan-points') {
      setSelectedId(feature.properties.id)
    }
  }

  useEffect(() => {
    if (!selectedAddress?.coordinates) {
      lastFocusedAddressId.current = null
      return
    }
    if (!mapRef.current) return
    if (lastFocusedAddressId.current === selectedAddress.immeubleId) return
    lastFocusedAddressId.current = selectedAddress.immeubleId
    mapRef.current.easeTo({
      center: [selectedAddress.coordinates.longitude, selectedAddress.coordinates.latitude],
      zoom: Math.max(mapRef.current.getZoom?.() || 0, 15),
      duration: 550,
    })
  }, [selectedAddress])

  useEffect(() => {
    if (!selectedSuggestion) {
      lastFocusedSuggestionId.current = null
      return
    }
    if (!mapRef.current) return
    if (lastFocusedSuggestionId.current === selectedSuggestion.id) return
    lastFocusedSuggestionId.current = selectedSuggestion.id
    mapRef.current.easeTo({
      center: [selectedSuggestion.longitude, selectedSuggestion.latitude],
      zoom: Math.max(mapRef.current.getZoom?.() || 0, 16),
      pitch: isPitched ? 58 : mapRef.current.getPitch?.() || 0,
      duration: 750,
    })
  }, [isPitched, selectedSuggestion])

  const hasSearchQuery = addressQuery.trim().length >= 2
  const searchHasPostcode = /\b\d{5}\b/.test(addressQuery)
  const showSuggestions = searchFocused && hasSearchQuery
  const isSatellite = mapStyle.includes('satellite')
  const isNationalAggregateView = !filters.dept && !hasSearchMode && clusters.length > 0

  const toggleMapStyle = () => {
    setMapStyle(current => (
      current.includes('satellite')
        ? 'mapbox://styles/mapbox/streets-v12'
        : 'mapbox://styles/mapbox/satellite-streets-v12'
    ))
  }

  const togglePitch = () => {
    const nextPitched = !isPitched
    setIsPitched(nextPitched)
    const currentZoom = mapRef.current?.getZoom?.() || initialViewState.zoom
    mapRef.current?.easeTo({
      pitch: nextPitched ? 60 : 0,
      bearing: nextPitched ? -18 : 0,
      zoom: nextPitched ? Math.max(currentZoom, 15) : currentZoom,
      duration: 550,
    })
  }

  const recenterOnSearch = () => {
    if (!selectedSuggestion || !mapRef.current) return
    mapRef.current.easeTo({
      center: [selectedSuggestion.longitude, selectedSuggestion.latitude],
      zoom: Math.max(mapRef.current.getZoom?.() || 0, 16),
      pitch: isPitched ? 58 : mapRef.current.getPitch?.() || 0,
      duration: 550,
    })
  }

  const clearFilter = key => {
    updateFilter(key, FILTER_RESET_VALUES[key] ?? 'all')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Adresses Acquiscan</h1>
          <p className="max-w-3xl text-xs text-muted-foreground">
            Carte des adresses Acquiscan avec clustering, filtres et signaux cuivre/fibre.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {error && (
            <Badge variant="destructive" className="gap-2">
              <AlertCircle className="h-3 w-3" />
              {error}
            </Badge>
          )}
          <Button variant="outline" onClick={refetch} disabled={mapLoading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${mapLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="scrollbar-hidden max-h-[calc(100svh-96px)] overflow-y-auto rounded-lg border bg-background shadow-sm xl:sticky xl:top-3 xl:h-[calc(100vh-128px)] xl:min-h-[720px]">
          <div className="space-y-3 border-b p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Search className="h-4 w-4 text-muted-foreground" />
                Recherche
              </div>
              {selectedSuggestion && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSearchSelection}
                  className="h-8 px-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className={`relative transition-all duration-300 ${
              searchFocused ? 'ring-2 ring-primary/10' : ''
            }`}>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={addressQuery}
                onChange={event => setAddressQuery(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
                placeholder="Rechercher une adresse"
                className="h-10 pl-9"
              />
              {showSuggestions && (
                <div className="absolute left-0 right-0 top-11 z-40 max-h-80 overflow-y-auto rounded-md border bg-background shadow-xl animate-in fade-in-0 zoom-in-95">
                  {suggestionsLoading && (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Recherche...
                    </div>
                  )}
                  {suggestionsError && (
                    <div className="px-3 py-2 text-sm text-destructive">{suggestionsError}</div>
                  )}
                  {!suggestionsLoading && !suggestionsError && suggestions.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {searchHasPostcode
                        ? 'Aucune adresse trouvée pour cette saisie.'
                        : 'Aucune adresse trouvée. Ajoute la ville si la voie existe dans plusieurs communes.'}
                    </div>
                  )}
                  {!suggestionsLoading && !suggestionsError && suggestions.map(suggestion => (
                    <button
                      type="button"
                      key={suggestion.id}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => selectSuggestion(suggestion)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted"
                    >
                      <Crosshair className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{suggestion.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[suggestion.postcode, suggestion.city, suggestion.codeInsee].filter(Boolean).join(' · ') || 'Adresse géocodée'}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedSuggestion && (
              <div className="rounded-md border border-red-200 bg-red-50/70 p-2 text-sm animate-in fade-in-0 slide-in-from-top-1">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-red-950">{selectedSuggestion.label}</p>
                    <p className="mt-0.5 text-xs text-red-700">
                      {searchPreviewLoading
                        ? 'Chargement des adresses proches...'
                        : `${fmtInt(searchPreview?.totalInCircle || 0)} adresse${(searchPreview?.totalInCircle || 0) > 1 ? 's' : ''} dans ${fmtInt(committedSearchRadiusMeters)} m.`}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_86px] gap-2">
                  <FilterField label="Rayon">
                    <input
                      type="range"
                      min="100"
                      max="3000"
                      step="50"
                      value={searchRadiusMeters}
                      onChange={event => updateSearchRadius(event.target.value)}
                      className="h-8 w-full accent-red-600"
                    />
                  </FilterField>
                  <FilterField label="Mètres">
                    <Input
                      type="number"
                      min="100"
                      max="3000"
                      step="50"
                      value={Math.round(searchRadiusMeters)}
                      onChange={event => updateSearchRadius(event.target.value)}
                      className="h-8"
                    />
                  </FilterField>
                </div>
                {searchPreviewError && (
                  <p className="mt-2 text-xs font-medium text-red-700">{searchPreviewError}</p>
                )}
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={recenterOnSearch} className="h-8 flex-1 gap-2">
                    <LocateFixed className="h-3.5 w-3.5" />
                    Recentrer
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={clearSearchSelection} className="h-8">
                    Effacer
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 border-b p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="h-4 w-4 text-red-600" />
                  Territoire
                  {territoryLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {territoryLevel === 'france'
                    ? 'Clique un département pour afficher ses communes.'
                    : territoryLevel === 'department'
                      ? `${selectedDept?.name || selectedDept?.code} · clique une commune pour charger les adresses.`
                      : `${selectedDept?.name || selectedDept?.code} · ${selectedCommune?.name || selectedCommune?.code}`}
                </p>
              </div>
              {territoryLevel !== 'france' && (
                <Button type="button" variant="outline" size="sm" onClick={goBackTerritory} className="h-8 shrink-0">
                  Retour
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={territoryLevel === 'france' ? 'secondary' : 'outline'}>France</Badge>
              {selectedDept && <Badge variant={territoryLevel === 'department' ? 'secondary' : 'outline'}>{selectedDept.code}</Badge>}
              {selectedCommune && <Badge variant="secondary">{selectedCommune.name || selectedCommune.code}</Badge>}
            </div>
            {territoryError && (
              <p className="text-xs font-medium text-destructive">{territoryError}</p>
            )}
          </div>

          <div className="space-y-3 border-b p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                Filtres
                {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />}
              </div>
              <div className="flex items-center gap-2">
                {activeFilters.length > 0 && (
                  <Badge variant="secondary" className="animate-in fade-in-0 zoom-in-95">
                    {activeFilters.length} actif{activeFilters.length > 1 ? 's' : ''}
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={resetFilters} className="h-8">
                  Réinitialiser
                </Button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <FilterField label="Cuivre">
                <Select value={filters.segment} onValueChange={value => updateFilter('segment', value)}>
                  <SelectTrigger className={`h-9 w-full ${filters.segment !== 'all' ? 'border-red-300 bg-red-50/50 ring-1 ring-red-100' : ''}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Étape cuivre: toutes</SelectItem>
                    <SelectItem value="urgent">Fermeture technique</SelectItem>
                    <SelectItem value="chaud">Commerciale adresse</SelectItem>
                    <SelectItem value="tiede">Commerciale zone</SelectItem>
                    <SelectItem value="froid">Cuivre actif</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Fibre">
                <Select value={filters.fiber} onValueChange={value => updateFilter('fiber', value)}>
                  <SelectTrigger className={`h-9 w-full ${filters.fiber !== 'all' ? 'border-red-300 bg-red-50/50 ring-1 ring-red-100' : ''}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Fibre: toutes</SelectItem>
                    <SelectItem value="yes">Fibre: oui</SelectItem>
                    <SelectItem value="no">Fibre: non</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Année fermeture">
                <Select value={filters.annee} onValueChange={value => updateFilter('annee', value)}>
                  <SelectTrigger className={`h-9 w-full ${filters.annee !== 'all' ? 'border-red-300 bg-red-50/50 ring-1 ring-red-100' : ''}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes années</SelectItem>
                    <SelectItem value="current">Année courante</SelectItem>
                    <SelectItem value="future">Après année courante</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Couverture 4G">
                <Select value={filters.coverage4g} onValueChange={value => updateFilter('coverage4g', value)}>
                  <SelectTrigger className={`h-9 w-full ${filters.coverage4g !== 'all' ? 'border-red-300 bg-red-50/50 ring-1 ring-red-100' : ''}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">4G: toutes</SelectItem>
                    <SelectItem value="eleve">4G élevée</SelectItem>
                    <SelectItem value="moyen">4G moyenne</SelectItem>
                    <SelectItem value="faible">4G faible</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Couverture 5G">
                <Select value={filters.coverage5g} onValueChange={value => updateFilter('coverage5g', value)}>
                  <SelectTrigger className={`h-9 w-full ${filters.coverage5g !== 'all' ? 'border-red-300 bg-red-50/50 ring-1 ring-red-100' : ''}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">5G: toutes</SelectItem>
                    <SelectItem value="eleve">5G élevée</SelectItem>
                    <SelectItem value="moyen">5G moyenne</SelectItem>
                    <SelectItem value="faible">5G faible</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
            </div>

            <div className="flex min-h-7 flex-wrap items-center gap-1.5">
              {activeFilters.length === 0 ? (
                <span className="text-xs text-muted-foreground">Aucun filtre restrictif</span>
              ) : (
                activeFilters.map(filter => (
                  <button
                    type="button"
                    key={filter.key}
                    onClick={() => clearFilter(filter.key)}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 text-xs font-medium text-red-700 shadow-sm transition-colors hover:bg-red-100 animate-in fade-in-0 zoom-in-95"
                  >
                    <MapPin className="h-3 w-3" />
                    {filter.label}
                    <X className="h-3 w-3" />
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="space-y-3 border-b p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="h-4 w-4 text-red-600" />
                  Ciblage zone
                  {zonePreviewLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {activeFilters.length
                    ? `Sélection filtrée par ${activeFilters.map(filter => filter.label).join(' · ')}`
                    : 'Trace un cercle et garde les adresses Acquiscan incluses.'}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={zoneMode ? 'secondary' : 'outline'}
                onClick={zoneMode ? stopZoneMode : startZoneMode}
                className="h-8 shrink-0"
              >
                {zoneMode ? 'Fermer' : 'Créer'}
              </Button>
            </div>

            {zoneMode && (
              <div className="space-y-3 animate-in fade-in-0 slide-in-from-top-1">
                {!draftCircle ? (
                  <button
                    type="button"
                    onClick={() => selectedSuggestion && setZoneCenter(selectedSuggestion.longitude, selectedSuggestion.latitude)}
                    className="w-full rounded-md border border-dashed p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
                  >
                    Clique sur la carte pour placer le centre, ou sélectionne une adresse.
                  </button>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_96px] gap-2">
                      <FilterField label="Rayon">
                        <input
                          type="range"
                          min="100"
                          max="3000"
                          step="50"
                          value={draftCircle.radiusMeters}
                          onChange={event => updateZoneRadius(event.target.value)}
                          className="h-9 w-full accent-red-600"
                        />
                      </FilterField>
                      <FilterField label="Mètres">
                        <Input
                          type="number"
                          value={Math.round(draftCircle.radiusMeters)}
                          onChange={event => updateZoneRadius(event.target.value)}
                          className="h-9"
                        />
                      </FilterField>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <MiniStat icon={MapPin} label="Targets" value={fmtInt(zonePreview?.summary?.totalTargets || 0)} />
                      <MiniStat icon={CheckCircle2} label="Sans fibre" value={fmtInt(zonePreview?.summary?.noFiberTargets || 0)} />
                      <MiniStat icon={Zap} label="Fermeture" value={fmtInt(zonePreview?.summary?.copperClosureTargets || 0)} />
                      <MiniStat icon={Wifi} label="Score" value={fmtInt(zonePreview?.summary?.averageOpportunityScore || 0)} />
                    </div>

                    {zonePreviewError && (
                      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {zonePreviewError}
                      </div>
                    )}

                    {zonePreview?.targets?.length > 0 && (
                      <div className="max-h-48 overflow-y-auto rounded-md border">
                        {zonePreview.targets.slice(0, 40).map(target => {
                          const excluded = excludedTargetIds.includes(target.immeubleId)
                          return (
                            <button
                              type="button"
                              key={target.immeubleId}
                              onClick={() => toggleZoneTarget(target.immeubleId)}
                              className={`flex w-full items-start gap-2 border-b px-2 py-2 text-left last:border-b-0 hover:bg-muted ${
                                excluded ? 'opacity-50' : ''
                              }`}
                            >
                              <span className={`mt-1 h-3 w-3 rounded-full border ${excluded ? 'bg-muted' : 'bg-red-600'}`} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-medium">{formatAddress(target)}</span>
                                <span className="block truncate text-[11px] text-muted-foreground">
                                  {Math.round(target.distanceMeters)} m · {target.nbrLogements || 'N/A'} log. · FO {target.eligFo === '1' ? 'oui' : target.eligFo === '0' ? 'non' : 'N/A'}
                                </span>
                              </span>
                              <Badge variant="outline" className={scoreTone(target.opportunityScore)}>
                                {target.opportunityScore}
                              </Badge>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    <div className="space-y-2">
                      <FilterField label="Nom de la zone">
                        <Input
                          value={zoneName}
                          onChange={event => setZoneName(event.target.value)}
                          placeholder="Zone Acquiscan - Paris 15"
                          className="h-9"
                        />
                      </FilterField>
                      <FilterField label="Assigner à">
                        <div className="rounded-md border bg-background">
                          <div className="flex items-center justify-between border-b px-2 py-1.5">
                            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                              <Users className="h-3.5 w-3.5" />
                              Managers / commerciaux
                            </span>
                            <Badge variant={selectedAssignments.length ? 'secondary' : 'outline'} className="h-5">
                              {selectedAssignments.length}
                            </Badge>
                          </div>
                          {assignableUsers.length === 0 ? (
                            <p className="px-2 py-3 text-xs text-muted-foreground">
                              Aucun manager ou commercial disponible.
                            </p>
                          ) : (
                            <div className="scrollbar-hidden max-h-36 overflow-y-auto">
                              {assignableUsers.map(user => {
                                const selected = selectedAssignmentIds.includes(user.key)
                                return (
                                  <button
                                    type="button"
                                    key={user.key}
                                    onClick={() => toggleAssignment(user.key)}
                                    className={`flex w-full items-center gap-2 border-b px-2 py-2 text-left last:border-b-0 transition-colors hover:bg-muted ${
                                      selected ? 'bg-red-50/70 text-red-950' : ''
                                    }`}
                                  >
                                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                      selected ? 'border-red-500 bg-red-600 text-white' : 'border-muted-foreground/30 text-transparent'
                                    }`}>
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-xs font-medium">{user.label}</span>
                                      <span className="block truncate text-[11px] text-muted-foreground">{user.subtitle}</span>
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </FilterField>
                      {zoneCreateError && (
                        <p className="text-xs text-destructive">{zoneCreateError}</p>
                      )}
                      {createdZone && (
                        <p className="text-xs font-medium text-emerald-700">
                          Zone créée: {createdZone.nom}
                        </p>
                      )}
                      <Button
                        type="button"
                        onClick={createZoneFromPreview}
                        disabled={zoneCreateLoading || zonePreviewLoading || !selectedZoneTargetIds.length}
                        className="h-9 w-full gap-2"
                      >
                        {zoneCreateLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                        {selectedAssignments.length
                          ? `Créer et assigner ${fmtInt(selectedZoneTargetIds.length)} adresse${selectedZoneTargetIds.length > 1 ? 's' : ''}`
                          : `Créer la zone avec ${fmtInt(selectedZoneTargetIds.length)} adresse${selectedZoneTargetIds.length > 1 ? 's' : ''}`}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className={`space-y-3 border-b p-3 transition-shadow ${listLoading || searchPreviewLoading ? 'ring-2 ring-primary/10' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  Immeuble sélectionné
                  {(listLoading || searchPreviewLoading) && <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {selectedAddress
                    ? 'Détail de l’adresse cliquée sur la carte'
                    : selectedCommune
                      ? `${fmtInt(stats.listTotal)} adresses chargées sur la carte`
                      : 'Clique une commune puis un point adresse'}
                </p>
              </div>
              <Badge variant={selectedAddress ? 'secondary' : 'outline'}>
                {selectedAddress ? 'sélection' : fmtInt(rows.length)}
              </Badge>
            </div>

            {selectedAddress ? (
              <AddressDetailCard row={selectedAddress} onClose={() => setSelectedId(null)} />
            ) : (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                {selectedCommune
                  ? 'Clique un point sur la carte pour afficher l’adresse et ses signaux.'
                  : 'Sélectionne d’abord une commune pour afficher les points adresse.'}
              </div>
            )}
          </div>
        </aside>

        <div className="relative min-h-[560px] overflow-hidden rounded-lg border bg-muted shadow-sm sm:min-h-[680px] xl:h-[calc(100vh-128px)] xl:min-h-[720px]">
          {loading && mapLoaded && (
            <div className="absolute inset-x-0 top-0 z-30 h-1 overflow-hidden bg-primary/10">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.55)]" />
            </div>
          )}

          {!MAPBOX_TOKEN ? (
            <div className="flex h-full min-h-[560px] items-center justify-center text-sm text-muted-foreground">
              Token Mapbox manquant
            </div>
          ) : (
            <>
              {!mapLoaded && <Skeleton className="absolute inset-0 z-10 h-full w-full rounded-none" />}
              <MapboxMap
                ref={mapRef}
                initialViewState={initialViewState}
                mapStyle={mapStyle}
                style={{ width: '100%', height: '100%' }}
                onLoad={() => setMapLoaded(true)}
                onMoveEnd={handleMoveEnd}
                onClick={handleMapClick}
                interactiveLayerIds={['acquiscan-territory-fill', 'acquiscan-clusters', 'acquiscan-cluster-count', 'acquiscan-points']}
                attributionControl={false}
              >
                <NavigationControl position="bottom-right" />
                {isPitched && <Layer {...building3dLayer} />}
                {territoryGeoJson && (
                  <Source id="acquiscan-territory-source" type="geojson" data={territoryGeoJson}>
                    <Layer {...territoryFillLayer} />
                    <Layer {...territoryLineLayer} />
                    <Layer {...territoryLabelLayer} />
                  </Source>
                )}
                <Source id="acquiscan-cluster-source" type="geojson" data={clustersGeoJson}>
                  <Layer {...(isNationalAggregateView ? nationalClusterLayer : clusterLayer)} />
                  <Layer {...(isNationalAggregateView ? nationalClusterCountLayer : clusterCountLayer)} />
                </Source>
                <Source id="acquiscan-point-source" type="geojson" data={pointsGeoJson}>
                  <Layer {...pointLayer} />
                </Source>
                <Source id="acquiscan-zone-circle-source" type="geojson" data={zoneCircleGeoJson}>
                  <Layer {...zoneCircleFillLayer} />
                  <Layer {...zoneCircleLineLayer} />
                </Source>
                <Source id="acquiscan-zone-target-source" type="geojson" data={zoneTargetsGeoJson}>
                  <Layer {...zoneTargetLayer} />
                </Source>
                <Source id="acquiscan-selected-source" type="geojson" data={selectedGeoJson}>
                  <Layer {...selectedPointLayer} />
                </Source>
                <Source id="acquiscan-search-target-source" type="geojson" data={searchTargetGeoJson}>
                  <Layer {...searchTargetHaloLayer} />
                  <Layer {...searchTargetLayer} />
                </Source>
              </MapboxMap>
            </>
          )}

          <div className="absolute right-3 top-3 z-20 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant={isSatellite ? 'secondary' : 'outline'}
              size="sm"
              onClick={toggleMapStyle}
              className="gap-2 bg-background/95 shadow-lg backdrop-blur"
            >
              <Layers className="h-4 w-4" />
              {isSatellite ? 'Plan' : 'Satellite'}
            </Button>
            <Button
              type="button"
              variant={isPitched ? 'secondary' : 'outline'}
              size="sm"
              onClick={togglePitch}
              className="gap-2 bg-background/95 shadow-lg backdrop-blur"
            >
              <Building2 className="h-4 w-4" />
              3D
            </Button>
          </div>

          {loading && mapLoaded && (
            <Badge className="absolute bottom-4 left-4 z-20 gap-2 shadow-lg" variant="secondary">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Chargement
            </Badge>
          )}
          <div className={`absolute left-4 z-20 rounded-md border bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur ${loading && mapLoaded ? 'bottom-14' : 'bottom-4'}`}>
            <p className="mb-1.5 font-medium text-foreground">Priorité adresse</p>
            <div className="flex flex-wrap gap-3">
              <LegendDot color="#64748b" label="Normale" />
              <LegendDot color="#f59e0b" label="Intéressante" />
              <LegendDot color="#ef4444" label="Forte" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className="h-2.5 w-2.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function AddressDetailCard({ row, onClose }) {
  const segment = copperSegment(row)
  return (
    <div className="rounded-md border bg-background p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug">{formatAddress(row)}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            Dép. {row.dept} · {row.codeInsee || 'INSEE ?'} · {row.imbCode || row.immeubleId}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="outline" className={segment.className} title={segment.title}>{segment.label}</Badge>
        <Badge variant="outline" className="gap-1.5">
          <Building2 className="h-3 w-3" />
          {row.nbrLogements || 'N/A'} log.
        </Badge>
        <Badge variant="outline" className="gap-1.5">
          <CheckCircle2 className="h-3 w-3" />
          FO {row.eligFo === '1' ? 'oui' : row.eligFo === '0' ? 'non' : 'N/A'}
        </Badge>
        <Badge variant="outline" className="gap-1.5">
          <Wifi className="h-3 w-3" />
          {row.sites4g ?? 'N/A'} 4G · {row.sites5g ?? 'N/A'} 5G
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-muted px-2 py-1.5">
          <p className="text-muted-foreground">Fermeture tech.</p>
          <p className="font-medium">{row.fermetureTechnique === '1' ? 'Oui' : 'Non'}</p>
        </div>
        <div className="rounded-md bg-muted px-2 py-1.5">
          <p className="text-muted-foreground">Année fibre</p>
          <p className="font-medium">{row.anneeFt || 'N/A'}</p>
        </div>
      </div>
    </div>
  )
}

function FilterField({ label, children }) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0 rounded-md border bg-background px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
        {React.createElement(Icon, { className: 'h-3 w-3 shrink-0' })}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums leading-none sm:text-base">{value}</p>
    </div>
  )
}
