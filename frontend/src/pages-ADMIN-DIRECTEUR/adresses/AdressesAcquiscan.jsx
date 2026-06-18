import React, { useEffect, useMemo, useRef, useState } from 'react'
import MapboxMap, { Layer, NavigationControl, Source } from 'react-map-gl/mapbox'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  CircleOff,
  Crosshair,
  Layers,
  List,
  LocateFixed,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
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

const pointLayer = {
  id: 'acquiscan-points',
  type: 'circle',
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['get', 'score'], 40, 5, 80, 9],
    'circle-color': ['step', ['get', 'score'], '#64748b', 55, '#f59e0b', 75, '#ef4444'],
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 2,
  },
}

const selectedPointLayer = {
  id: 'acquiscan-selected-point',
  type: 'circle',
  paint: {
    'circle-radius': 13,
    'circle-color': '#2563eb',
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 3,
  },
}

const searchTargetLayer = {
  id: 'acquiscan-search-target',
  type: 'circle',
  paint: {
    'circle-radius': 12,
    'circle-color': '#10b981',
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 4,
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

export default function AdressesAcquiscan() {
  const {
    filters,
    updateFilter,
    resetFilters,
    addressQuery,
    setAddressQuery,
    suggestions,
    suggestionsLoading,
    suggestionsError,
    selectedSuggestion,
    selectSuggestion,
    initialViewState,
    updateMapViewport,
    rows,
    listRows,
    clusters,
    selectedAddress,
    selectedId,
    setSelectedId,
    stats,
    loading,
    listLoading,
    error,
    refetch,
    tooManyResults,
    clustered,
  } = useAdressesAcquiscanLogic()
  const mapRef = useRef(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [showList, setShowList] = useState(true)
  const [searchFocused, setSearchFocused] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  const activeFilters = useMemo(() => {
    const entries = []
    if (filters.dept.trim()) entries.push({ key: 'dept', label: `Dépt. ${filters.dept.trim().toUpperCase()}` })
    if (filters.commune.trim()) entries.push({ key: 'commune', label: `INSEE ${filters.commune.trim()}` })
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
          address: formatAddress(row),
        },
      })),
    }),
    [rows]
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
    if (!feature) return

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
    if (!selectedAddress?.coordinates || !mapRef.current) return
    mapRef.current.flyTo({
      center: [selectedAddress.coordinates.longitude, selectedAddress.coordinates.latitude],
      zoom: Math.max(mapRef.current.getZoom?.() || 0, 14),
      duration: 600,
    })
  }, [selectedAddress])

  useEffect(() => {
    if (!selectedSuggestion || !mapRef.current) return
    mapRef.current.flyTo({
      center: [selectedSuggestion.longitude, selectedSuggestion.latitude],
      zoom: 15,
      duration: 700,
    })
  }, [selectedSuggestion])

  const showSuggestions = searchFocused && (suggestions.length > 0 || suggestionsLoading || suggestionsError)

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
          <Button variant="outline" onClick={refetch} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      <div className="relative min-h-[780px] overflow-hidden rounded-lg border bg-muted shadow-sm lg:h-[calc(100vh-128px)] lg:min-h-[720px]">
        {loading && mapLoaded && (
          <div className="absolute inset-x-0 top-0 z-30 h-1 overflow-hidden bg-primary/10">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.55)]" />
          </div>
        )}

        {!MAPBOX_TOKEN ? (
          <div className="flex h-full min-h-[690px] items-center justify-center text-sm text-muted-foreground">
            Token Mapbox manquant
          </div>
        ) : (
          <>
            {!mapLoaded && <Skeleton className="absolute inset-0 z-10 h-full w-full rounded-none" />}
            <MapboxMap
              ref={mapRef}
              initialViewState={initialViewState}
              mapStyle="mapbox://styles/mapbox/streets-v12"
              style={{ width: '100%', height: '100%' }}
              onLoad={() => setMapLoaded(true)}
              onMoveEnd={handleMoveEnd}
              onClick={handleMapClick}
              interactiveLayerIds={['acquiscan-clusters', 'acquiscan-cluster-count', 'acquiscan-points']}
              attributionControl={false}
            >
              <NavigationControl position="bottom-right" />
              <Source id="acquiscan-cluster-source" type="geojson" data={clustersGeoJson}>
                <Layer {...clusterLayer} />
                <Layer {...clusterCountLayer} />
              </Source>
              <Source id="acquiscan-point-source" type="geojson" data={pointsGeoJson}>
                <Layer {...pointLayer} />
              </Source>
              <Source id="acquiscan-selected-source" type="geojson" data={selectedGeoJson}>
                <Layer {...selectedPointLayer} />
              </Source>
              <Source id="acquiscan-search-target-source" type="geojson" data={searchTargetGeoJson}>
                <Layer {...searchTargetLayer} />
              </Source>
            </MapboxMap>
          </>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex max-h-[52svh] flex-col gap-2 overflow-y-auto overscroll-contain p-2 sm:max-h-none sm:overflow-visible lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,390px)] lg:items-start lg:gap-2">
          <div className="pointer-events-auto grid w-full items-start gap-2 xl:grid-cols-[minmax(280px,420px)_minmax(0,1fr)]">
            <div className={`self-start rounded-lg border bg-background/95 p-2 shadow-lg backdrop-blur transition-all duration-300 ${
              searchFocused ? 'border-primary/40 shadow-xl ring-2 ring-primary/10' : ''
            }`}>
              <div className="mb-1.5 flex items-center justify-between gap-2 md:hidden">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Search className="h-3.5 w-3.5" />
                  Recherche adresse
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant={showMobileFilters || activeFilters.length > 0 ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setShowMobileFilters(value => !value)}
                    className="h-7 px-2 text-xs md:hidden"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filtres{activeFilters.length > 0 ? ` ${activeFilters.length}` : ''}
                  </Button>
                  {selectedSuggestion && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAddressQuery('')
                      resetFilters()
                    }}
                    className="h-7 px-2 text-xs"
                  >
                    <X className="h-3.5 w-3.5" />
                    Effacer
                  </Button>
                  )}
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={addressQuery}
                  onChange={event => setAddressQuery(event.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
                  placeholder="Rechercher une adresse exacte"
                  className="h-9 pl-9 text-sm"
                />
                {showSuggestions && (
                  <div className="absolute left-0 right-0 top-10 z-30 overflow-hidden rounded-md border bg-background shadow-xl animate-in fade-in-0 zoom-in-95">
                    {suggestionsLoading && (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Recherche...
                      </div>
                    )}
                    {suggestionsError && (
                      <div className="px-3 py-2 text-sm text-destructive">{suggestionsError}</div>
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
            </div>

            <div className={`${showMobileFilters ? 'block' : 'hidden'} self-start rounded-lg border bg-background/95 p-2 shadow-lg backdrop-blur transition-all duration-300 animate-in fade-in-0 slide-in-from-top-2 md:block ${
              loading ? 'border-primary/30 shadow-xl' : ''
            }`}>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
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

              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                <Input
                  value={filters.dept}
                  onChange={event => updateFilter('dept', event.target.value)}
                  placeholder="Dépt."
                  className="h-8"
                />
                <Input
                  value={filters.commune}
                  onChange={event => updateFilter('commune', event.target.value)}
                  placeholder="INSEE"
                  className="h-8"
                />
                <Select value={filters.segment} onValueChange={value => updateFilter('segment', value)}>
                  <SelectTrigger className="h-8 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Étape cuivre: toutes</SelectItem>
                    <SelectItem value="urgent">Fermeture technique</SelectItem>
                    <SelectItem value="chaud">Commerciale adresse</SelectItem>
                    <SelectItem value="tiede">Commerciale zone</SelectItem>
                    <SelectItem value="froid">Cuivre actif</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filters.fiber} onValueChange={value => updateFilter('fiber', value)}>
                  <SelectTrigger className="h-8 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Fibre: toutes</SelectItem>
                    <SelectItem value="yes">Fibre: oui</SelectItem>
                    <SelectItem value="no">Fibre: non</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filters.annee} onValueChange={value => updateFilter('annee', value)}>
                  <SelectTrigger className="h-8 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes années</SelectItem>
                    <SelectItem value="current">Année courante</SelectItem>
                    <SelectItem value="future">Après année courante</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filters.coverage4g} onValueChange={value => updateFilter('coverage4g', value)}>
                  <SelectTrigger className="h-8 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">4G: toutes</SelectItem>
                    <SelectItem value="eleve">4G élevée</SelectItem>
                    <SelectItem value="moyen">4G moyenne</SelectItem>
                    <SelectItem value="faible">4G faible</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filters.coverage5g} onValueChange={value => updateFilter('coverage5g', value)}>
                  <SelectTrigger className="h-8 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">5G: toutes</SelectItem>
                    <SelectItem value="eleve">5G élevée</SelectItem>
                    <SelectItem value="moyen">5G moyenne</SelectItem>
                    <SelectItem value="faible">5G faible</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <div className="flex min-h-7 flex-1 flex-wrap items-center gap-1.5">
                  {activeFilters.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Aucun filtre restrictif</span>
                  ) : (
                    activeFilters.map(filter => (
                      <Badge
                        key={filter.key}
                        variant="outline"
                        className="animate-in fade-in-0 zoom-in-95 bg-background/80"
                      >
                        {filter.label}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="pointer-events-auto grid w-full grid-cols-4 gap-1 rounded-lg border bg-background/95 p-1 shadow-lg backdrop-blur transition-all duration-300 lg:justify-self-end">
            <MiniStat icon={MapPin} label="Zone" value={fmtInt(stats.total)} />
            <MiniStat icon={Layers} label="Clust." value={fmtInt(stats.clusters)} />
            <MiniStat icon={List} label="Liste" value={fmtInt(stats.listTotal)} />
            <MiniStat icon={Zap} label="Cuivre" value={fmtInt(stats.shutdownCount)} />
          </div>
        </div>

        {selectedSuggestion && (
          <div className="pointer-events-none absolute left-3 top-[104px] z-20 max-w-[calc(100%-1.5rem)] rounded-md border bg-background/95 px-3 py-2 text-sm shadow-lg backdrop-blur animate-in fade-in-0 slide-in-from-top-2 md:left-4 md:top-[190px] md:max-w-[calc(100%-2rem)] xl:top-[132px]">
            <div className="flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-emerald-600" />
              <span className="truncate font-medium">{selectedSuggestion.label}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Adresses Acquiscan proches affichées selon les coordonnées disponibles.
            </p>
          </div>
        )}

        {loading && mapLoaded && (
          <Badge className="absolute bottom-4 right-4 z-20 gap-2 shadow-lg" variant="secondary">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Chargement
          </Badge>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowList(value => !value)}
          className="absolute bottom-4 left-4 z-20 gap-2 shadow-lg"
        >
          <List className="h-4 w-4" />
          {showList ? 'Masquer la liste' : 'Afficher la liste'}
        </Button>

        {showList && (
          <div className={`absolute inset-x-2 bottom-20 z-20 overflow-hidden rounded-lg border bg-background/95 shadow-xl backdrop-blur transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-3 sm:inset-x-3 md:left-auto md:right-4 md:top-36 md:bottom-6 md:w-[390px] xl:top-32 ${
            listLoading ? 'ring-2 ring-primary/15' : ''
          }`}>
            <div className="flex items-center justify-between border-b px-3 py-2.5">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  Adresses affichées
                  {listLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />}
                </p>
                <p className="text-xs text-muted-foreground">
                  {filters.dept
                    ? `${fmtInt(stats.listTotal)} adresses Acquiscan pour ce département`
                    : clustered
                      ? 'Clique un cluster ou zoome pour voir les adresses'
                      : `${rows.length} adresses géocodées dans la vue`}
                </p>
              </div>
              <Badge variant="outline">{tooManyResults && !filters.dept ? 'dense' : `${listRows.length}`}</Badge>
            </div>

            <div className="max-h-[42svh] overflow-y-auto pb-6 md:h-[calc(100%-57px)] md:max-h-none">
              {listLoading ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-20 w-full rounded-md" />
                  ))}
                </div>
              ) : listRows.length === 0 ? (
                <EmptyList clustered={clustered} hasDepartment={Boolean(filters.dept)} />
              ) : (
                listRows.map(row => {
                  const segment = copperSegment(row)
                  const selected = selectedId === row.immeubleId
                  const onMap = Boolean(row.coordinates?.latitude && row.coordinates?.longitude)
                  return (
                    <button
                      type="button"
                      key={row.immeubleId}
                      onClick={() => onMap && setSelectedId(row.immeubleId)}
                      className={`w-full border-b px-3 py-2.5 text-left transition-colors hover:bg-muted/60 ${
                        selected ? 'bg-primary/10' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{formatAddress(row)}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            Dép. {row.dept} · {row.codeInsee || 'INSEE ?'} · {row.imbCode || row.immeubleId}
                          </p>
                        </div>
                        <Badge variant="outline" className={scoreTone(row.opportunityScore || 50)}>
                          {row.opportunityScore || 'N/A'}
                        </Badge>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
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
                        <Badge variant={onMap ? 'secondary' : 'outline'} className="gap-1.5">
                          <LocateFixed className="h-3 w-3" />
                          {onMap ? 'carte' : 'liste'}
                        </Badge>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0 rounded-md border bg-background px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums leading-none sm:text-base">{value}</p>
    </div>
  )
}

function EmptyList({ clustered, hasDepartment }) {
  return (
    <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
      <CircleOff className="h-8 w-8" />
      <p>
        {hasDepartment
          ? 'Aucune adresse Acquiscan pour ces filtres.'
          : clustered
            ? 'Zoome ou clique un cluster pour afficher les adresses géocodées.'
            : 'Aucune adresse géocodée dans cette zone.'}
      </p>
    </div>
  )
}
