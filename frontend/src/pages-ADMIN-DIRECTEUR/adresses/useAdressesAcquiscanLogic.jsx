import { useCallback, useEffect, useMemo, useState } from 'react'
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
    setMapLoading(true)
    setMapError(null)
    try {
      const result = await api.acquiscan.getMapAddresses(mapInput)
      setMapData(result)
      setSelectedId(current => {
        if (!result.points.length) return null
        return result.points.some(point => point.immeubleId === current) ? current : null
      })
    } catch (err) {
      setMapError(err instanceof Error ? err.message : 'Erreur de chargement des adresses Acquiscan')
    } finally {
      setMapLoading(false)
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

  const loadList = useCallback(async () => {
    if (!listInput) {
      setListData(null)
      setListError(null)
      return
    }

    setListLoading(true)
    setListError(null)
    try {
      const result = await api.acquiscan.getCopperBuildings(listInput)
      setListData(result)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Erreur de chargement des adresses Acquiscan')
    } finally {
      setListLoading(false)
    }
  }, [listInput])

  useEffect(() => {
    loadMap()
  }, [loadMap])

  useEffect(() => {
    loadList()
  }, [loadList])

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'dept') next.commune = ''
      return next
    })
  }, [])

  const updateMapViewport = useCallback((bounds, zoom) => {
    if (!bounds) return
    setMapQuery({
      bounds: normalizeBounds(bounds),
      zoom: Number(zoom.toFixed(2)),
    })
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    setAddressQuery('')
    setSuggestions([])
    setSelectedSuggestion(null)
    setSelectedId(null)
  }, [])

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

  return {
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
