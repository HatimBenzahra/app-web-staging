import React, { useEffect, useMemo, useRef, useState } from 'react'
import MapboxMap, { Layer, NavigationControl, Source } from 'react-map-gl/mapbox'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  AlertCircle,
  Building2,
  ChevronDown,
  CheckCircle2,
  Crosshair,
  HelpCircle,
  Layers,
  LocateFixed,
  MapPin,
  RefreshCw,
  Search,
  Users,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdressesAcquiscanLogic } from './useAdressesAcquiscanLogic'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN
}

const fmtInt = value => Number(value || 0).toLocaleString('fr-FR')
const formatAddress = row =>
  [row.addrNumero, row.addrNomVoie, row.addrNomCommune].filter(Boolean).join(' ') ||
  row.imbCode ||
  row.immeubleId

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
  const bounds = coordinates.reduce(
    (acc, coord) => acc.extend(coord),
    new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
  )
  map.fitBounds(bounds, { padding, duration: 650, maxZoom: 15 })
}

const createCircleGeoJson = circle => {
  if (!circle) return { type: 'FeatureCollection', features: [] }
  const points = 80
  const coordinates = []
  const lat = circle.latitude
  const lng = circle.longitude
  const latRadius = circle.radiusMeters / 111320
  const lngRadius = circle.radiusMeters / (111320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2))
  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * Math.PI * 2
    coordinates.push([lng + Math.cos(angle) * lngRadius, lat + Math.sin(angle) * latRadius])
  }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coordinates] },
        properties: {},
      },
    ],
  }
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

const selectedCommuneFillLayer = {
  id: 'acquiscan-selected-commune-fill',
  type: 'fill',
  paint: {
    'fill-color': '#ef4444',
    'fill-opacity': 0.08,
  },
}

const selectedCommuneLineLayer = {
  id: 'acquiscan-selected-commune-line',
  type: 'line',
  paint: {
    'line-color': '#ef4444',
    'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2.2, 13, 4],
    'line-opacity': 0.95,
  },
}

const copperSegment = row => {
  if (row.fermetureTechnique === '1') {
    return {
      label: 'Migration urgente',
      className: 'border-red-200 bg-red-50 text-red-700',
      title: 'DSLAM en cours de démantèlement - migration fibre obligatoire',
    }
  }
  if (row.fermetureComAddr === '1') {
    return {
      label: 'Priorité adresse',
      className: 'border-orange-200 bg-orange-50 text-orange-700',
      title: 'Fermeture commerciale annoncée pour cette adresse',
    }
  }
  if (row.fermetureComZone === '1') {
    return {
      label: 'Zone à préparer',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
      title: 'Fermeture commerciale annoncée sur la zone',
    }
  }
  return {
    label: 'Cuivre maintenu',
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
    urgent: 'Migration urgente',
    chaud: 'Priorité adresse',
    tiede: 'Zone à préparer',
    froid: 'Cuivre maintenu',
  },
  fiber: {
    all: 'Fibre: toutes',
    yes: 'Fibre: oui',
    no: 'Migration à qualifier',
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

const FILTER_GROUPS = [
  {
    title: 'Signaux adresse',
    description: 'Priorise selon cuivre, fibre et timing',
    fields: [
      {
        key: 'segment',
        label: 'Cuivre',
        options: [
          ['all', 'Toutes étapes'],
          ['urgent', 'Migration urgente'],
          ['chaud', 'Priorité adresse'],
          ['tiede', 'Zone à préparer'],
          ['froid', 'Cuivre maintenu'],
        ],
      },
      {
        key: 'fiber',
        label: 'Fibre',
        options: [
          ['all', 'Toutes éligibilités'],
          ['yes', 'Fibre disponible'],
          ['no', 'Migration à qualifier'],
        ],
      },
      {
        key: 'annee',
        label: 'Fermeture',
        options: [
          ['all', 'Toutes années'],
          ['current', 'Année courante'],
          ['future', 'Après année courante'],
        ],
      },
    ],
  },
  {
    title: 'Couverture réseau',
    description: 'Signal mobile complémentaire',
    fields: [
      {
        key: 'coverage4g',
        label: '4G',
        options: [
          ['all', 'Toutes couvertures'],
          ['eleve', '4G élevée'],
          ['moyen', '4G moyenne'],
          ['faible', '4G faible'],
        ],
      },
      {
        key: 'coverage5g',
        label: '5G',
        options: [
          ['all', 'Toutes couvertures'],
          ['eleve', '5G élevée'],
          ['moyen', '5G moyenne'],
          ['faible', '5G faible'],
        ],
      },
    ],
  },
]

const FILTER_DOC_SECTIONS = [
  {
    title: 'Étape cuivre',
    icon: Zap,
    tone: 'border-amber-200 bg-amber-50/70 text-amber-900',
    iconTone: 'bg-amber-100 text-amber-700',
    items: [
      ['Toutes étapes', 'Affiche toutes les adresses, sans tenir compte du niveau de fermeture cuivre.'],
      ['Migration urgente', 'Adresse liée à une fermeture technique: c’est le signal le plus prioritaire.'],
      ['Priorité adresse', 'La fermeture commerciale est signalée directement au niveau de l’adresse.'],
      ['Zone à préparer', 'La fermeture commerciale est signalée au niveau de la zone.'],
      ['Cuivre maintenu', 'Aucun signal de fermeture cuivre n’est remonté pour l’adresse.'],
    ],
  },
  {
    title: 'Fibre',
    icon: CheckCircle2,
    tone: 'border-emerald-200 bg-emerald-50/70 text-emerald-900',
    iconTone: 'bg-emerald-100 text-emerald-700',
    items: [
      ['Toutes éligibilités', 'Affiche les adresses avec ou sans fibre disponible.'],
      ['Fibre disponible', 'Adresse déjà éligible fibre selon les données Acquiscan.'],
      ['Migration à qualifier', 'Adresse sans fibre disponible: cible potentielle pour qualification commerciale.'],
    ],
  },
  {
    title: 'Fermeture',
    icon: AlertCircle,
    tone: 'border-red-200 bg-red-50/70 text-red-900',
    iconTone: 'bg-red-100 text-red-700',
    items: [
      ['Toutes années', 'Ne filtre pas par calendrier de fermeture.'],
      ['Année courante', 'Conserve les adresses dont la fermeture est prévue cette année.'],
      ['Après année courante', 'Conserve les fermetures futures ou annoncées sans date précise.'],
    ],
  },
  {
    title: 'Couverture 4G / 5G',
    icon: Wifi,
    tone: 'border-sky-200 bg-sky-50/70 text-sky-900',
    iconTone: 'bg-sky-100 text-sky-700',
    items: [
      ['Élevée', 'Commune fortement couverte par le réseau mobile concerné.'],
      ['Moyenne', 'Commune avec couverture intermédiaire.'],
      ['Faible', 'Commune moins couverte: peut signaler un contexte réseau plus sensible.'],
    ],
  },
]

export default function AdressesAcquiscan() {
  const {
    filters,
    updateFilter,
    resetFilters,
    territoryLevel,
    selectedDept,
    selectedCommune,
    territoryGeoJson,
    selectedCommuneGeoJson,
    territoryError,
    selectDepartment,
    selectCommune,
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
    initialViewState,
    updateMapViewport,
    stepBackFromMapZoom,
    releaseMapStepBackLock,
    rows,
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
    loading,
    error,
    refetch,
  } = useAdressesAcquiscanLogic()
  const mapRef = useRef(null)
  const mapShellRef = useRef(null)
  const searchInputRef = useRef(null)
  const lastFocusedSuggestionId = useRef(null)
  const lastFocusedAddressId = useRef(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/streets-v12')
  const [isPitched, setIsPitched] = useState(false)
  const [openSections, setOpenSections] = useState({
    search: true,
    territory: true,
    filters: true,
    zone: false,
  })
  const [filterDocsOpen, setFilterDocsOpen] = useState(false)

  const activeFilters = useMemo(() => {
    const entries = []
    if (filters.segment !== 'all')
      entries.push({ key: 'segment', label: FILTER_LABELS.segment[filters.segment] })
    if (filters.fiber !== 'all')
      entries.push({ key: 'fiber', label: FILTER_LABELS.fiber[filters.fiber] })
    if (filters.annee !== 'all')
      entries.push({ key: 'annee', label: FILTER_LABELS.annee[filters.annee] })
    if (filters.coverage4g !== 'all')
      entries.push({ key: 'coverage4g', label: FILTER_LABELS.coverage4g[filters.coverage4g] })
    if (filters.coverage5g !== 'all')
      entries.push({ key: 'coverage5g', label: FILTER_LABELS.coverage5g[filters.coverage5g] })
    return entries
  }, [filters])
  const searchIsOpen = searchExpanded || Boolean(selectedSuggestion) || addressQuery.trim().length > 0

  const toggleSection = key => {
    setOpenSections(current => ({ ...current, [key]: !current[key] }))
  }

  useEffect(() => {
    if (!zoneMode) return
    setOpenSections(current => ({ ...current, zone: true }))
  }, [zoneMode])

  useEffect(() => {
    if (!searchIsOpen) return
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [searchIsOpen])

  useEffect(() => {
    if (!mapShellRef.current) return undefined
    const resizeMap = () => mapRef.current?.resize?.()
    resizeMap()
    const frame = window.requestAnimationFrame(resizeMap)
    const observer = new ResizeObserver(resizeMap)
    observer.observe(mapShellRef.current)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [mapLoaded])

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

  const selectedGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: selectedAddress?.coordinates
        ? [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [
                  selectedAddress.coordinates.longitude,
                  selectedAddress.coordinates.latitude,
                ],
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

  const searchCircle = useMemo(
    () =>
      selectedSuggestion
        ? {
            longitude: selectedSuggestion.longitude,
            latitude: selectedSuggestion.latitude,
            radiusMeters: searchRadiusMeters,
          }
        : null,
    [searchRadiusMeters, selectedSuggestion]
  )
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
    const zoom = event.viewState.zoom
    updateMapViewport(
      {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      },
      zoom
    )
    releaseMapStepBackLock()
  }

  const handleMapMove = event => {
    stepBackFromMapZoom(event.viewState.zoom)
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
  const contextHint = useMemo(() => {
    if (selectedSuggestion) return null
    if (activeFilters.length > 0 && !selectedDept) {
      return 'Sélectionne un département pour afficher les adresses correspondant aux filtres actifs.'
    }
    if (activeFilters.length > 0 && selectedDept && !selectedCommune) {
      return `Filtres appliqués au département ${selectedDept.code}. Les points affichés sont les adresses ciblées; sélectionne une commune pour affiner.`
    }
    if (selectedDept && !selectedCommune) {
      return 'Sélectionne une commune pour afficher les adresses détaillées de ce département.'
    }
    return null
  }, [activeFilters.length, selectedCommune, selectedDept, selectedSuggestion])

  const toggleMapStyle = () => {
    setMapStyle(current =>
      current.includes('satellite')
        ? 'mapbox://styles/mapbox/streets-v12'
        : 'mapbox://styles/mapbox/satellite-streets-v12'
    )
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

  const renderMapToolbar = () => {
    const toolbarFields = FILTER_GROUPS.flatMap(group => group.fields)
    return (
      <div className="rounded-lg border bg-background shadow-sm">
        <div className="flex flex-col gap-2 p-2 lg:flex-row lg:items-center">
          <div
            className={`relative min-w-0 transition-[flex-basis,width,max-width] duration-500 ease-out ${
              searchIsOpen
                ? 'basis-full sm:basis-[360px] lg:basis-[420px] lg:max-w-[420px]'
                : 'basis-10 lg:basis-10'
            }`}
          >
            {!searchIsOpen ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setSearchExpanded(true)}
                className="h-9 w-10 rounded-full shadow-sm transition-all duration-300 hover:w-12 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                title="Rechercher une adresse"
              >
                <Search className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors duration-300" />
                <Input
                  ref={searchInputRef}
                  value={addressQuery}
                  onChange={event => setAddressQuery(event.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
                  placeholder="Rechercher une adresse"
                  className="h-9 rounded-full border-red-100 bg-background pl-9 pr-9 shadow-sm transition-all duration-500 focus-visible:border-red-200 focus-visible:ring-red-200"
                />
                {!selectedSuggestion && !addressQuery && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSearchExpanded(false)
                      setSearchFocused(false)
                    }}
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground"
                    title="Fermer la recherche"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
            {showSuggestions && (
              <div className="absolute left-0 right-0 top-10 z-50 max-h-72 overflow-y-auto rounded-md border bg-background shadow-xl animate-in fade-in-0 zoom-in-95">
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
                      : 'Aucune adresse trouvée. Ajoute la ville si besoin.'}
                  </div>
                )}
                {!suggestionsLoading &&
                  !suggestionsError &&
                  suggestions.map(suggestion => (
                    <button
                      type="button"
                      key={suggestion.id}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => selectSuggestion(suggestion)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted"
                    >
                      <Crosshair className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {suggestion.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[suggestion.postcode, suggestion.city, suggestion.codeInsee]
                            .filter(Boolean)
                            .join(' · ') || 'Adresse géocodée'}
                        </span>
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {activeFilters.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-8 shrink-0 px-2 text-muted-foreground hover:text-foreground"
              >
                Réinitialiser
              </Button>
            )}

            <div className="scrollbar-thin-x flex min-w-[220px] flex-1 items-center gap-1.5 overflow-x-auto pb-0.5">
              {toolbarFields.map(field => (
                <ToolbarSelect
                  key={field.key}
                  field={field}
                  value={filters[field.key]}
                  active={filters[field.key] !== 'all'}
                  onChange={value => updateFilter(field.key, value)}
                />
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFilterDocsOpen(true)}
                className="h-8 shrink-0 gap-1.5 border-red-200 bg-red-50 text-red-800 hover:bg-red-100 hover:text-red-900"
              >
                <HelpCircle className="h-3.5 w-3.5 animate-pulse" />
                Aide filtres
              </Button>
              <Button
                type="button"
                size="sm"
                variant={zoneMode ? 'secondary' : 'outline'}
                onClick={zoneMode ? stopZoneMode : startZoneMode}
                className="h-8 shrink-0 gap-1.5"
              >
                <MapPin className="h-3.5 w-3.5" />
                {zoneMode ? 'Fermer zone' : 'Ciblage zone'}
              </Button>
            </div>
          </div>
        </div>

        {(selectedSuggestion || territoryError || contextHint) && (
          <div className="border-t px-2 py-1.5">
            {territoryError && (
              <p className="text-xs font-medium text-destructive">{territoryError}</p>
            )}
            {contextHint && (
              <p className="text-xs font-medium text-muted-foreground">{contextHint}</p>
            )}
            {selectedSuggestion && (
              <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(300px,440px)_auto] lg:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-red-950">
                    {selectedSuggestion.label}
                  </p>
                  <p className="text-xs text-red-700">
                    {searchPreviewLoading
                      ? 'Chargement des adresses proches...'
                      : `${fmtInt(searchPreview?.totalInCircle || 0)} adresse${(searchPreview?.totalInCircle || 0) > 1 ? 's' : ''} dans ${fmtInt(committedSearchRadiusMeters)} m.`}
                  </p>
                </div>
                <div className="grid min-w-0 grid-cols-[minmax(160px,1fr)_78px] items-end gap-2">
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
                <div className="space-y-1">
                  <span className="block h-4 text-[11px] font-medium uppercase tracking-wide text-transparent">
                    Actions
                  </span>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={recenterOnSearch}
                      className="h-8 gap-1.5"
                    >
                      <LocateFixed className="h-3.5 w-3.5" />
                      Recentrer
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={clearSearchSelection}
                      className="h-8"
                    >
                      Effacer
                    </Button>
                  </div>
                </div>
                {searchPreviewError && (
                  <p className="text-xs font-medium text-red-700">{searchPreviewError}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderZonePanel = () => (
    <div className="max-h-[520px] overflow-hidden rounded-lg border bg-background/95 shadow-xl backdrop-blur xl:max-h-[calc(100vh-310px)]">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <button
          type="button"
          onClick={() => toggleSection('zone')}
          className="min-w-0 flex-1 text-left"
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-red-600" />
            Ciblage zone
            {zonePreviewLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />}
            <ChevronDown
              className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${openSections.zone ? 'rotate-180' : ''}`}
            />
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {activeFilters.length
              ? `Sélection filtrée par ${activeFilters.map(filter => filter.label).join(' · ')}`
              : 'Trace un cercle et garde les adresses Acquiscan incluses.'}
          </p>
        </button>
      </div>

      {openSections.zone && (
        <div className="max-h-[460px] space-y-3 overflow-y-auto p-3 animate-in fade-in-0 slide-in-from-top-1 xl:max-h-[calc(100vh-380px)]">
          {!draftCircle ? (
            <button
              type="button"
              onClick={() =>
                selectedSuggestion &&
                setZoneCenter(selectedSuggestion.longitude, selectedSuggestion.latitude)
              }
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
                <MiniStat
                  icon={MapPin}
                  label="Targets"
                  value={fmtInt(zonePreview?.summary?.totalTargets || 0)}
                />
                <MiniStat
                  icon={CheckCircle2}
                  label="À qualifier"
                  value={fmtInt(zonePreview?.summary?.noFiberTargets || 0)}
                />
                <MiniStat
                  icon={Zap}
                  label="Fermeture"
                  value={fmtInt(zonePreview?.summary?.copperClosureTargets || 0)}
                />
                <MiniStat
                  icon={Wifi}
                  label="Score"
                  value={fmtInt(zonePreview?.summary?.averageOpportunityScore || 0)}
                />
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
                        <span
                          className={`mt-1 h-3 w-3 rounded-full border ${excluded ? 'bg-muted' : 'bg-red-600'}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">
                            {formatAddress(target)}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {Math.round(target.distanceMeters)} m · {target.nbrLogements || 'N/A'}{' '}
                            log. · FO{' '}
                            {target.eligFo === '1' ? 'oui' : target.eligFo === '0' ? 'non' : 'N/A'}
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
                      <Badge
                        variant={selectedAssignments.length ? 'secondary' : 'outline'}
                        className="h-5"
                      >
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
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                  selected
                                    ? 'border-red-500 bg-red-600 text-white'
                                    : 'border-muted-foreground/30 text-transparent'
                                }`}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-medium">
                                  {user.label}
                                </span>
                                <span className="block truncate text-[11px] text-muted-foreground">
                                  {user.subtitle}
                                </span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </FilterField>
                {zoneCreateError && <p className="text-xs text-destructive">{zoneCreateError}</p>}
                {createdZone && (
                  <p className="text-xs font-medium text-emerald-700">
                    Zone créée: {createdZone.nom}
                  </p>
                )}
                <Button
                  type="button"
                  onClick={createZoneFromPreview}
                  disabled={
                    zoneCreateLoading || zonePreviewLoading || !selectedZoneTargetIds.length
                  }
                  className="h-9 w-full gap-2"
                >
                  {zoneCreateLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
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
  )

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Adresses Acquiscan</h1>
          <p className="max-w-3xl text-xs text-muted-foreground">
            Carte des adresses Acquiscan avec filtres et signaux cuivre/fibre.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {error && (
            <Badge variant="destructive" className="gap-2">
              <AlertCircle className="h-3 w-3" />
              {error}
            </Badge>
          )}
          {error && (
            <Button variant="outline" onClick={refetch} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Réessayer
            </Button>
          )}
        </div>
      </div>

      <div className="-mx-4 min-w-0 xl:ml-0 xl:-mr-4">
        <div className="flex min-w-0 flex-col gap-2">
          {renderMapToolbar()}

          <Dialog
            open={Boolean(selectedAddress)}
            onOpenChange={open => !open && setSelectedId(null)}
          >
            <DialogContent className="max-h-[86vh] overflow-y-auto p-0 sm:max-w-xl">
              {selectedAddress && (
                <>
                  <DialogHeader className="border-b px-4 py-3">
                    <DialogTitle className="flex items-center gap-2 text-base">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      Immeuble Acquiscan
                    </DialogTitle>
                    <DialogDescription className="truncate">
                      {formatAddress(selectedAddress)}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="px-4 py-3">
                    <AddressDetailCard row={selectedAddress} onClose={() => setSelectedId(null)} />
                  </div>
                  <DialogFooter className="border-t px-4 py-3">
                    <Button type="button" variant="outline" onClick={() => setSelectedId(null)}>
                      Fermer
                    </Button>
                    <Button type="button" disabled title="Prévu pour une prochaine version">
                      Ajouter aux opportunités
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          <div
            ref={mapShellRef}
            className="relative min-w-0 overflow-hidden border bg-muted shadow-sm min-h-[560px] sm:min-h-[680px] xl:h-[calc(100vh-248px)] xl:min-h-[560px] xl:rounded-lg"
          >
            {loading && mapLoaded && (
              <div className="absolute inset-x-0 top-0 z-30 h-1 overflow-hidden bg-primary/10">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.55)]" />
              </div>
            )}

            {zoneMode && (
              <div className="absolute inset-x-3 top-3 z-20 sm:inset-x-auto sm:left-3 sm:w-[390px] lg:w-[420px]">
                {renderZonePanel()}
              </div>
            )}

            {!MAPBOX_TOKEN ? (
              <div className="flex h-full min-h-[560px] items-center justify-center text-sm text-muted-foreground">
                Token Mapbox manquant
              </div>
            ) : (
              <>
                {!mapLoaded && (
                  <Skeleton className="absolute inset-0 z-10 h-full w-full rounded-none" />
                )}
                <MapboxMap
                  ref={mapRef}
                  initialViewState={initialViewState}
                  mapStyle={mapStyle}
                  style={{ width: '100%', height: '100%' }}
                  onLoad={() => setMapLoaded(true)}
                  onMove={handleMapMove}
                  onMoveEnd={handleMoveEnd}
                  onClick={handleMapClick}
                  interactiveLayerIds={['acquiscan-territory-fill', 'acquiscan-points']}
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
                  {selectedCommuneGeoJson && (
                    <Source
                      id="acquiscan-selected-commune-source"
                      type="geojson"
                      data={selectedCommuneGeoJson}
                    >
                      <Layer {...selectedCommuneFillLayer} />
                      <Layer {...selectedCommuneLineLayer} />
                    </Source>
                  )}
                  <Source id="acquiscan-point-source" type="geojson" data={pointsGeoJson}>
                    <Layer {...pointLayer} />
                  </Source>
                  <Source id="acquiscan-zone-circle-source" type="geojson" data={zoneCircleGeoJson}>
                    <Layer {...zoneCircleFillLayer} />
                    <Layer {...zoneCircleLineLayer} />
                  </Source>
                  <Source
                    id="acquiscan-zone-target-source"
                    type="geojson"
                    data={zoneTargetsGeoJson}
                  >
                    <Layer {...zoneTargetLayer} />
                  </Source>
                  <Source id="acquiscan-selected-source" type="geojson" data={selectedGeoJson}>
                    <Layer {...selectedPointLayer} />
                  </Source>
                  <Source
                    id="acquiscan-search-target-source"
                    type="geojson"
                    data={searchTargetGeoJson}
                  >
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
            <div
              className={`absolute left-4 z-20 rounded-md border bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur ${loading && mapLoaded ? 'bottom-14' : 'bottom-4'}`}
            >
              <p className="font-medium text-foreground">Score d'opportunité</p>
              <p className="mb-1.5 text-[11px] text-muted-foreground">Couleur des points adresse</p>
              <div className="flex flex-wrap gap-3">
                <LegendDot color="#64748b" label="Priorité faible" />
                <LegendDot color="#f59e0b" label="À examiner" />
                <LegendDot color="#ef4444" label="Priorité forte" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={filterDocsOpen} onOpenChange={setFilterDocsOpen}>
        <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-700">
                <HelpCircle className="h-4 w-4" />
              </span>
              Comprendre les filtres Acquiscan
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Les filtres servent à réduire les adresses affichées selon les signaux cuivre,
              fibre, calendrier et couverture mobile.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {FILTER_DOC_SECTIONS.map(section => (
              <div key={section.title} className={`rounded-lg border p-3 ${section.tone}`}>
                <div className="flex items-center gap-2">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${section.iconTone}`}>
                    {React.createElement(section.icon, { className: 'h-4 w-4' })}
                  </span>
                  <p className="text-sm font-semibold tracking-tight">{section.title}</p>
                </div>
                <div className="mt-3 space-y-2.5">
                  {section.items.map(([label, description]) => (
                    <div key={label} className="rounded-md bg-background/70 px-2.5 py-2 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFilterDocsOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span
        className="h-2.5 w-2.5 rounded-full border border-white shadow-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  )
}

function AddressDetailCard({ row, onClose }) {
  const segment = copperSegment(row)
  return (
    <div className="rounded-md border bg-background p-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-snug">{formatAddress(row)}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            Dép. {row.dept} · {row.codeInsee || 'INSEE ?'} · {row.imbCode || row.immeubleId}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <Badge variant="outline" className={`h-6 ${segment.className}`} title={segment.title}>
          {segment.label}
        </Badge>
        <Badge variant="outline" className="h-6 gap-1">
          <Building2 className="h-3 w-3" />
          {row.nbrLogements || 'N/A'} log.
        </Badge>
        <Badge variant="outline" className="h-6 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          FO {row.eligFo === '1' ? 'oui' : row.eligFo === '0' ? 'non' : 'N/A'}
        </Badge>
        <Badge variant="outline" className="h-6 gap-1">
          <Wifi className="h-3 w-3" />
          {row.sites4g ?? 'N/A'} 4G · {row.sites5g ?? 'N/A'} 5G
        </Badge>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
        <div className="rounded-md bg-muted px-2 py-1">
          <p className="text-muted-foreground">Migration urgente</p>
          <p className="font-medium">{row.fermetureTechnique === '1' ? 'Oui' : 'Non'}</p>
        </div>
        <div className="rounded-md bg-muted px-2 py-1">
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
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}

function ToolbarSelect({ field, value, active, onChange }) {
  const selectedLabel = field.options.find(([optionValue]) => optionValue === value)?.[1] || field.label
  const width = Math.min(Math.max(selectedLabel.length * 7.2 + 48, 116), 196)

  return (
    <label className="shrink-0">
      <span className="sr-only">{field.label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          style={{ width }}
          className={`h-8 gap-1 rounded-md px-2 text-xs shadow-none transition-[width,border-color,background-color,color] duration-200 focus:ring-1 focus:ring-red-200 focus:ring-offset-0 focus-visible:ring-1 focus-visible:ring-red-200 focus-visible:ring-offset-0 ${
            active ? 'border-red-200 bg-red-50 text-red-800' : 'bg-background'
          }`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {field.options.map(([optionValue, label]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums leading-none sm:text-base">
        {value}
      </p>
    </div>
  )
}
