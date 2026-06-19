import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/services'

const INITIAL_VIEW_STATE = {
  longitude: 2.2137,
  latitude: 46.2276,
  zoom: 5,
}

const INITIAL_BOUNDS = {
  west: -5.6,
  south: 41,
  east: 9.8,
  north: 51.5,
}

const ADDRESS_LIMIT = 500

const DEFAULT_FILTERS = {
  dept: '',
  commune: '',
  annee: 'all',
  fiber: 'all',
  coverage4g: 'all',
  coverage5g: 'all',
  segment: 'all',
}

const normalizeFilters = filters => ({
  dept: filters.dept.trim().toUpperCase() || undefined,
  commune: filters.commune.trim() || undefined,
  annee: filters.annee,
  fiber: filters.fiber,
  coverage4g: filters.coverage4g,
  coverage5g: filters.coverage5g,
  segment: filters.segment,
  limit: ADDRESS_LIMIT,
})

const normalizeBounds = bounds => ({
  west: Number(bounds.west.toFixed(6)),
  south: Number(bounds.south.toFixed(6)),
  east: Number(bounds.east.toFixed(6)),
  north: Number(bounds.north.toFixed(6)),
})

const mapPointToAddress = point => ({
  ...point,
  coordinates: {
    latitude: point.latitude,
    longitude: point.longitude,
  },
})

const boundsAround = (longitude, latitude, delta = 0.025) => ({
  west: Math.max(-180, longitude - delta),
  south: Math.max(-90, latitude - delta),
  east: Math.min(180, longitude + delta),
  north: Math.min(90, latitude + delta),
})

const hasValidCoordinates = suggestion => (
  Number.isFinite(suggestion?.longitude)
  && Number.isFinite(suggestion?.latitude)
  && suggestion.longitude >= -180
  && suggestion.longitude <= 180
  && suggestion.latitude >= -90
  && suggestion.latitude <= 90
)

const formatSuggestionError = error => {
  const message = error instanceof Error ? error.message : String(error || '')
  if (/timeout|temps|ECONNABORTED/i.test(message)) {
    return 'Recherche temporairement lente. Réessaie en ajoutant la ville.'
  }
  if (/service unavailable|503/i.test(message)) {
    return 'Recherche adresse temporairement indisponible.'
  }
  return message || 'Erreur de recherche adresse'
}

export function useAdressesAcquiscanLogic() {
  const latestMapRequest = useRef(0)
  const latestListRequest = useRef(0)
  const latestZonePreviewRequest = useRef(0)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [addressQuery, setAddressQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState(null)
  const [mapQuery, setMapQuery] = useState({
    bounds: INITIAL_BOUNDS,
    zoom: INITIAL_VIEW_STATE.zoom,
  })
  const [mapData, setMapData] = useState(null)
  const [listData, setListData] = useState(null)
  const [mapLoading, setMapLoading] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [mapError, setMapError] = useState(null)
  const [listError, setListError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [zoneMode, setZoneMode] = useState(false)
  const [draftCircle, setDraftCircle] = useState(null)
  const [zonePreview, setZonePreview] = useState(null)
  const [zonePreviewLoading, setZonePreviewLoading] = useState(false)
  const [zonePreviewError, setZonePreviewError] = useState(null)
  const [excludedTargetIds, setExcludedTargetIds] = useState([])
  const [zoneName, setZoneName] = useState('')
  const [zoneCreateLoading, setZoneCreateLoading] = useState(false)
  const [zoneCreateError, setZoneCreateError] = useState(null)
  const [createdZone, setCreatedZone] = useState(null)

  const mapInput = useMemo(() => {
    const normalized = normalizeFilters(filters)
    return {
      bounds: mapQuery.bounds,
      zoom: mapQuery.zoom,
      dept: normalized.dept,
      commune: normalized.commune,
      annee: normalized.annee,
      fiber: normalized.fiber,
      coverage4g: normalized.coverage4g,
      coverage5g: normalized.coverage5g,
      segment: normalized.segment,
      limit: normalized.limit,
      cluster: mapQuery.zoom < 10,
    }
  }, [filters, mapQuery])

  const loadSuggestions = useCallback(async query => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setSuggestions([])
      setSuggestionsError(null)
      return
    }

    setSuggestionsLoading(true)
    setSuggestionsError(null)
    try {
      const result = await api.acquiscan.getAddressSuggestions({ query: trimmed, limit: 20 })
      setSuggestions(result)
    } catch (err) {
      setSuggestionsError(formatSuggestionError(err))
      setSuggestions([])
    } finally {
      setSuggestionsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadSuggestions(addressQuery)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [addressQuery, loadSuggestions])

  const loadMap = useCallback(async () => {
    const requestId = latestMapRequest.current + 1
    latestMapRequest.current = requestId
    setMapLoading(true)
    setMapError(null)
    try {
      const result = await api.acquiscan.getMapAddresses(mapInput)
      if (latestMapRequest.current !== requestId) return
      setMapData(result)
      setSelectedId(current => {
        if (!result.points.length) return null
        return result.points.some(point => point.immeubleId === current) ? current : null
      })
    } catch (err) {
      if (latestMapRequest.current !== requestId) return
      setMapError(err instanceof Error ? err.message : 'Erreur de chargement des adresses Acquiscan')
    } finally {
      if (latestMapRequest.current === requestId) setMapLoading(false)
    }
  }, [mapInput])

  const listInput = useMemo(() => {
    const normalized = normalizeFilters(filters)
    if (!normalized.dept) return null
    return {
      dept: normalized.dept,
      commune: normalized.commune,
      annee: normalized.annee,
      fiber: normalized.fiber,
      coverage4g: normalized.coverage4g,
      coverage5g: normalized.coverage5g,
      segment: normalized.segment,
      limit: Math.min(normalized.limit, 500),
      offset: 0,
    }
  }, [filters])

  const zonePreviewInput = useMemo(() => {
    if (!zoneMode || !draftCircle) return null
    const normalized = normalizeFilters(filters)
    return {
      longitude: Number(draftCircle.longitude.toFixed(7)),
      latitude: Number(draftCircle.latitude.toFixed(7)),
      radiusMeters: Math.round(draftCircle.radiusMeters),
      dept: normalized.dept,
      commune: normalized.commune,
      annee: normalized.annee,
      fiber: normalized.fiber,
      coverage4g: normalized.coverage4g,
      coverage5g: normalized.coverage5g,
      segment: normalized.segment,
      limit: ADDRESS_LIMIT,
    }
  }, [draftCircle, filters, zoneMode])

  useEffect(() => {
    if (zoneMode) {
      setZonePreview(null)
      setZonePreviewError(null)
    }
  }, [zonePreviewInput, zoneMode])

  const loadList = useCallback(async () => {
    if (!listInput) {
      latestListRequest.current += 1
      setListData(null)
      setListError(null)
      setListLoading(false)
      return
    }

    const requestId = latestListRequest.current + 1
    latestListRequest.current = requestId
    setListLoading(true)
    setListError(null)
    try {
      const result = await api.acquiscan.getCopperBuildings(listInput)
      if (latestListRequest.current !== requestId) return
      setListData(result)
    } catch (err) {
      if (latestListRequest.current !== requestId) return
      setListError(err instanceof Error ? err.message : 'Erreur de chargement des adresses Acquiscan')
    } finally {
      if (latestListRequest.current === requestId) setListLoading(false)
    }
  }, [listInput])

  useEffect(() => {
    loadMap()
  }, [loadMap])

  useEffect(() => {
    loadList()
  }, [loadList])

  const loadZonePreview = useCallback(async () => {
    if (!zonePreviewInput) {
      latestZonePreviewRequest.current += 1
      setZonePreview(null)
      setZonePreviewError(null)
      setZonePreviewLoading(false)
      return
    }

    const requestId = latestZonePreviewRequest.current + 1
    latestZonePreviewRequest.current = requestId
    setZonePreviewLoading(true)
    setZonePreviewError(null)
    try {
      const result = await api.acquiscan.getZonePreview(zonePreviewInput)
      if (latestZonePreviewRequest.current !== requestId) return
      setZonePreview(result)
      setExcludedTargetIds(current => current.filter(id => result.targets.some(target => target.immeubleId === id)))
    } catch (err) {
      if (latestZonePreviewRequest.current !== requestId) return
      setZonePreviewError(err instanceof Error ? err.message : 'Erreur de preview zone Acquiscan')
    } finally {
      if (latestZonePreviewRequest.current === requestId) setZonePreviewLoading(false)
    }
  }, [zonePreviewInput])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadZonePreview()
    }, 350)
    return () => window.clearTimeout(timer)
  }, [loadZonePreview])

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'dept') next.commune = ''
      return next
    })
  }, [])

  const updateMapViewport = useCallback((bounds, zoom) => {
    if (!bounds) return
    const nextBounds = normalizeBounds(bounds)
    const nextZoom = Number(zoom.toFixed(2))
    setMapQuery(current => {
      const sameBounds = current.bounds.west === nextBounds.west
        && current.bounds.south === nextBounds.south
        && current.bounds.east === nextBounds.east
        && current.bounds.north === nextBounds.north
      if (sameBounds && current.zoom === nextZoom) return current
      return {
        bounds: nextBounds,
        zoom: nextZoom,
      }
    })
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    setAddressQuery('')
    setSuggestions([])
    setSelectedSuggestion(null)
    setSelectedId(null)
  }, [])

  const clearSearchSelection = useCallback(() => {
    setAddressQuery('')
    setSuggestions([])
    setSuggestionsError(null)
    setSelectedSuggestion(null)
  }, [])

  const rows = useMemo(() => (mapData?.points || []).map(mapPointToAddress), [mapData?.points])
  const listRows = useMemo(
    () => (listData?.rows?.length ? listData.rows : rows),
    [listData?.rows, rows]
  )
  const clusters = mapData?.clusters || []
  const coverage = mapData?.coverage || []
  const selectedAddress = useMemo(
    () => rows.find(row => row.immeubleId === selectedId)
      || listRows.find(row => row.immeubleId === selectedId && row.coordinates?.latitude && row.coordinates?.longitude)
      || null,
    [listRows, rows, selectedId]
  )

  const stats = useMemo(() => {
    const shutdownCount = rows.filter(
      row => row.fermetureTechnique === '1' || row.fermetureComAddr === '1' || row.fermetureComZone === '1'
    ).length
    const fiberCount = rows.filter(row => row.eligFo === '1').length
    return {
      total: mapData?.totalInBounds || 0,
      shown: mapData?.returnedCount || rows.length,
      rows: rows.length,
      listRows: listRows.length,
      clusters: clusters.length,
      shutdownCount,
      fiberCount,
      departments: coverage.length,
      listTotal: listData?.total || mapData?.totalInBounds || 0,
    }
  }, [clusters.length, coverage.length, listData?.total, listRows.length, mapData?.returnedCount, mapData?.totalInBounds, rows])

  const selectSuggestion = useCallback(suggestion => {
    if (!hasValidCoordinates(suggestion)) {
      setSuggestionsError('Coordonnées invalides pour cette adresse.')
      return
    }
    setSelectedSuggestion(suggestion)
    setAddressQuery(suggestion.label)
    setSuggestions([])
    setSelectedId(null)
    setFilters(prev => ({ ...prev, dept: '', commune: '' }))
    setMapQuery({
      bounds: boundsAround(suggestion.longitude, suggestion.latitude),
      zoom: 15,
    })
    if (zoneMode) {
      setDraftCircle({
        longitude: suggestion.longitude,
        latitude: suggestion.latitude,
        radiusMeters: draftCircle?.radiusMeters || 600,
      })
    }
  }, [draftCircle?.radiusMeters, zoneMode])

  const startZoneMode = useCallback(() => {
    setZoneMode(true)
    setZoneCreateError(null)
    setCreatedZone(null)
    setDraftCircle(current => {
      if (current) return current
      if (selectedAddress?.coordinates?.latitude && selectedAddress?.coordinates?.longitude) {
        return {
          longitude: selectedAddress.coordinates.longitude,
          latitude: selectedAddress.coordinates.latitude,
          radiusMeters: 600,
        }
      }
      if (selectedSuggestion) {
        return {
          longitude: selectedSuggestion.longitude,
          latitude: selectedSuggestion.latitude,
          radiusMeters: 600,
        }
      }
      return null
    })
  }, [selectedAddress, selectedSuggestion])

  const stopZoneMode = useCallback(() => {
    setZoneMode(false)
    setDraftCircle(null)
    setZonePreview(null)
    setExcludedTargetIds([])
    setZoneCreateError(null)
    setCreatedZone(null)
  }, [])

  const setZoneCenter = useCallback((longitude, latitude) => {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return
    setZoneMode(true)
    setDraftCircle(current => ({
      longitude,
      latitude,
      radiusMeters: current?.radiusMeters || 600,
    }))
    setCreatedZone(null)
  }, [])

  const updateZoneRadius = useCallback(radiusMeters => {
    const nextRadius = Number(radiusMeters)
    if (!Number.isFinite(nextRadius)) return
    setDraftCircle(current => current ? {
      ...current,
      radiusMeters: Math.min(10000, Math.max(50, nextRadius)),
    } : current)
    setCreatedZone(null)
  }, [])

  const toggleZoneTarget = useCallback(immeubleId => {
    setExcludedTargetIds(current => (
      current.includes(immeubleId)
        ? current.filter(id => id !== immeubleId)
        : [...current, immeubleId]
    ))
  }, [])

  const selectedZoneTargetIds = useMemo(() => {
    const excluded = new Set(excludedTargetIds)
    return (zonePreview?.targets || [])
      .filter(target => !excluded.has(target.immeubleId))
      .map(target => target.immeubleId)
  }, [excludedTargetIds, zonePreview?.targets])

  const createZoneFromPreview = useCallback(async () => {
    if (!zonePreviewInput) {
      setZoneCreateError('Trace un cercle avant de créer la zone.')
      return null
    }
    if (!zoneName.trim()) {
      setZoneCreateError('Ajoute un nom de zone.')
      return null
    }
    if (!selectedZoneTargetIds.length) {
      setZoneCreateError('Aucune adresse Acquiscan sélectionnée dans le cercle.')
      return null
    }

    setZoneCreateLoading(true)
    setZoneCreateError(null)
    try {
      const zone = await api.acquiscan.createZone({
        ...zonePreviewInput,
        nom: zoneName.trim(),
        selectedImmeubleIds: selectedZoneTargetIds,
      })
      setCreatedZone(zone)
      return zone
    } catch (err) {
      setZoneCreateError(err instanceof Error ? err.message : 'Erreur de création de zone Acquiscan')
      return null
    } finally {
      setZoneCreateLoading(false)
    }
  }, [selectedZoneTargetIds, zoneName, zonePreviewInput])

  return {
    filters,
    updateFilter,
    resetFilters,
    clearSearchSelection,
    addressQuery,
    setAddressQuery,
    suggestions,
    suggestionsLoading,
    suggestionsError,
    selectedSuggestion,
    selectSuggestion,
    initialViewState: INITIAL_VIEW_STATE,
    updateMapViewport,
    rows,
    listRows,
    rowsWithCoordinates: rows,
    clusters,
    coverage,
    selectedAddress,
    selectedId,
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
    zoneName,
    setZoneName,
    createZoneFromPreview,
    zoneCreateLoading,
    zoneCreateError,
    createdZone,
    stats,
    mapData,
    loading: mapLoading || listLoading,
    mapLoading,
    listLoading,
    error: mapError || listError,
    mapError,
    listError,
    refetch: () => {
      loadMap()
      loadList()
    },
    tooManyResults: Boolean(mapData?.tooManyResults),
    clustered: Boolean(mapData?.clustered),
  }
}
