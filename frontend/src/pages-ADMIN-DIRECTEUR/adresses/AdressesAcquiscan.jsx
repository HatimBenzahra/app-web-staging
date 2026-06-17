import React, { useEffect, useRef, useState } from 'react'
import MapboxMap, { Marker, NavigationControl } from 'react-map-gl/mapbox'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Database,
  List,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Wifi,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MapSkeleton } from '@/components/LoadingSkeletons'
import { useAdressesAcquiscanLogic } from './useAdressesAcquiscanLogic'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN
}

const formatAddress = row =>
  [row.addrNumero, row.addrNomVoie, row.addrNomCommune].filter(Boolean).join(' ') || row.imbCode || row.immeubleId

const flagLabel = value => (value === '1' ? 'Oui' : 'Non')

const segmentBadge = row => {
  if (row.fermetureTechnique === '1') return { label: 'Urgent', className: 'bg-red-100 text-red-800' }
  if (row.fermetureComAddr === '1') return { label: 'Chaud', className: 'bg-orange-100 text-orange-800' }
  if (row.fermetureComZone === '1') return { label: 'Tiède', className: 'bg-amber-100 text-amber-800' }
  return { label: 'Froid', className: 'bg-slate-100 text-slate-700' }
}

function AddressMarker({ row, selected, onClick }) {
  const badge = segmentBadge(row)
  const markerColor =
    badge.label === 'Urgent'
      ? 'bg-red-600'
      : badge.label === 'Chaud'
        ? 'bg-orange-500'
        : badge.label === 'Tiède'
          ? 'bg-amber-500'
          : 'bg-slate-600'

  return (
    <Marker longitude={row.coordinates.longitude} latitude={row.coordinates.latitude}>
      <button
        type="button"
        onClick={onClick}
        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-white shadow-lg transition-transform ${markerColor} ${
          selected ? 'scale-125 ring-4 ring-primary/30' : 'hover:scale-110'
        }`}
        title={formatAddress(row)}
      >
        <Building2 className="h-4 w-4" />
      </button>
    </Marker>
  )
}

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate text-lg font-semibold tabular-nums leading-none">{value}</div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</div>
    </div>
  )
}

export default function AdressesAcquiscan() {
  const {
    filters,
    updateFilter,
    page,
    setPage,
    data,
    rows,
    rowsWithCoordinates,
    selectedAddress,
    selectedId,
    setSelectedId,
    stats,
    mapCenter,
    loading,
    importing,
    error,
    importError,
    refetch,
    importCoordinates,
    hasPreviousPage,
    hasNextPage,
  } = useAdressesAcquiscanLogic()
  const mapRef = useRef(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [showResults, setShowResults] = useState(true)

  useEffect(() => {
    if (!selectedAddress?.coordinates || !mapRef.current) return
    mapRef.current.flyTo({
      center: [selectedAddress.coordinates.longitude, selectedAddress.coordinates.latitude],
      zoom: 15,
      duration: 700,
    })
  }, [selectedAddress])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Adresses Acquiscan</h1>
          <p className="text-sm text-muted-foreground">
            Vue cartographique des adresses Acquiscan avec coordonnées ARCEP quand disponibles.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {error && (
            <Badge variant="destructive" className="gap-2">
              <AlertCircle className="h-3 w-3" />
              {error}
            </Badge>
          )}
          {importError && (
            <Badge variant="destructive" className="gap-2">
              <AlertCircle className="h-3 w-3" />
              {importError}
            </Badge>
          )}
          {importing && (
            <Badge variant="secondary" className="gap-2">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Import lancé
            </Badge>
          )}
        </div>
      </div>

      <div className="relative min-h-[760px] overflow-hidden rounded-lg border bg-muted shadow-sm lg:h-[calc(100vh-150px)] lg:min-h-[680px]">
        {loading && !mapLoaded && <MapSkeleton />}
        {!MAPBOX_TOKEN ? (
          <div className="flex h-full min-h-[680px] items-center justify-center text-sm text-muted-foreground">
            Token Mapbox manquant
          </div>
        ) : rowsWithCoordinates.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
            <MapPin className="h-8 w-8" />
            Aucune coordonnée sur cette page
          </div>
        ) : (
          <MapboxMap
            ref={mapRef}
            initialViewState={mapCenter}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            style={{ width: '100%', height: '100%' }}
            onLoad={() => setMapLoaded(true)}
            attributionControl={false}
          >
            <NavigationControl position="bottom-right" />
            {rowsWithCoordinates.map(row => (
              <AddressMarker
                key={row.immeubleId}
                row={row}
                selected={row.immeubleId === selectedId}
                onClick={() => setSelectedId(row.immeubleId)}
              />
            ))}
          </MapboxMap>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-3 p-3 lg:flex-row lg:items-start lg:justify-between lg:p-4">
          <div className="pointer-events-auto w-full rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:max-w-3xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Filtres</span>
              </div>
              <Button variant="outline" size="sm" onClick={refetch} disabled={loading} className="h-8 gap-2">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-6">
              <Input
                value={filters.dept}
                onChange={event => updateFilter('dept', event.target.value)}
                placeholder="Dépt."
                className="h-9 md:col-span-1"
              />
              <Input
                value={filters.commune}
                onChange={event => updateFilter('commune', event.target.value)}
                placeholder="Code INSEE"
                className="h-9 md:col-span-1"
              />
              <div className="relative md:col-span-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={event => updateFilter('search', event.target.value)}
                  placeholder="Rechercher une adresse"
                  className="h-9 pl-9"
                />
              </div>
              <Select value={filters.fiber} onValueChange={value => updateFilter('fiber', value)}>
                <SelectTrigger className="h-9 md:col-span-2"><SelectValue placeholder="Fibre" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Fibre: toutes</SelectItem>
                  <SelectItem value="yes">Fibre: oui</SelectItem>
                  <SelectItem value="no">Fibre: non</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.segment} onValueChange={value => updateFilter('segment', value)}>
                <SelectTrigger className="h-9 md:col-span-2"><SelectValue placeholder="Segment" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous segments</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="chaud">Chaud</SelectItem>
                  <SelectItem value="tiede">Tiède</SelectItem>
                  <SelectItem value="froid">Froid</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.annee} onValueChange={value => updateFilter('annee', value)}>
                <SelectTrigger className="h-9 md:col-span-2"><SelectValue placeholder="Année" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes années</SelectItem>
                  <SelectItem value="current">Année courante</SelectItem>
                  <SelectItem value="future">Après année courante</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.coverage4g} onValueChange={value => updateFilter('coverage4g', value)}>
                <SelectTrigger className="h-9 md:col-span-2"><SelectValue placeholder="4G" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">4G: toutes</SelectItem>
                  <SelectItem value="eleve">4G élevée</SelectItem>
                  <SelectItem value="moyen">4G moyenne</SelectItem>
                  <SelectItem value="faible">4G faible</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.coverage5g} onValueChange={value => updateFilter('coverage5g', value)}>
                <SelectTrigger className="h-9 md:col-span-2"><SelectValue placeholder="5G" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">5G: toutes</SelectItem>
                  <SelectItem value="eleve">5G élevée</SelectItem>
                  <SelectItem value="moyen">5G moyenne</SelectItem>
                  <SelectItem value="faible">5G faible</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={importCoordinates}
                disabled={loading || importing || data?.importStatus?.isImported}
                className="h-9 gap-2 md:col-span-2"
              >
                <Database className={`h-4 w-4 ${importing ? 'animate-pulse' : ''}`} />
                {data?.importStatus?.isImported ? 'Coordonnées importées' : 'Importer coordonnées'}
              </Button>
            </div>
          </div>

          <div className="pointer-events-auto grid w-full grid-cols-2 gap-2 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:grid-cols-5 lg:max-w-xl">
            <Metric icon={Database} label="Résultats" value={stats.total.toLocaleString('fr-FR')} detail={`${stats.shown} affichés`} />
            <Metric icon={MapPin} label="Coord." value={stats.geocoded} detail="page" />
            <Metric icon={Wifi} label="Fibre" value={stats.fiberCount} detail="FO" />
            <Metric icon={Zap} label="Fermeture" value={stats.shutdownCount} detail="signalées" />
            <Metric
              icon={CheckCircle2}
              label="Cache"
              value={data?.importStatus?.importedCount?.toLocaleString('fr-FR') || '0'}
              detail={`Dép. ${filters.dept}`}
            />
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowResults(value => !value)}
          className="absolute bottom-4 left-4 z-20 gap-2 shadow-lg"
        >
          <List className="h-4 w-4" />
          {showResults ? 'Masquer la liste' : 'Afficher la liste'}
        </Button>

        {showResults && (
          <div className="absolute inset-x-3 bottom-16 z-20 overflow-hidden rounded-lg border bg-background/95 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/90 md:left-auto md:right-4 md:top-36 md:bottom-4 md:w-[420px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Adresses affichées</p>
                <p className="text-xs text-muted-foreground">Page {page + 1}</p>
              </div>
              <Badge variant="outline">{rows.length} lignes</Badge>
            </div>
            <div className="max-h-[360px] overflow-y-auto md:h-[calc(100%-105px)] md:max-h-none">
              {rows.map(row => {
                const badge = segmentBadge(row)
                const selected = row.immeubleId === selectedId
                return (
                  <button
                    type="button"
                    key={row.immeubleId}
                    onClick={() => setSelectedId(row.immeubleId)}
                    className={`w-full border-b p-4 text-left transition-colors hover:bg-muted/60 ${
                      selected ? 'bg-primary/10' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium leading-snug">{formatAddress(row)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.codeInsee || 'INSEE inconnu'} · {row.imbCode || row.immeubleId}
                        </p>
                      </div>
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">FO {flagLabel(row.eligFo)}</Badge>
                      <Badge variant="outline">{row.nbrLogements || '0'} log.</Badge>
                      <Badge variant="outline">4G {row.sites4g ?? 'N/A'}/{row.sitesTotal ?? 'N/A'}</Badge>
                      <Badge variant="outline">5G {row.sites5g ?? 'N/A'}/{row.sitesTotal ?? 'N/A'}</Badge>
                      {row.coordinates ? (
                        <Badge variant="secondary">coordonnées</Badge>
                      ) : (
                        <Badge variant="outline">sans coordonnées</Badge>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between border-t p-3">
              <Button variant="outline" size="sm" disabled={!hasPreviousPage || loading} onClick={() => setPage(page - 1)}>
                Précédent
              </Button>
              <span className="text-xs text-muted-foreground">Page {page + 1}</span>
              <Button variant="outline" size="sm" disabled={!hasNextPage || loading} onClick={() => setPage(page + 1)}>
                Suivant
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
