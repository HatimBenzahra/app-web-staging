import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, useCommercials, useManagers } from '@/services'

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
const SEARCH_RADIUS_DEFAULT = 600
const SEARCH_RADIUS_MIN = 100
const SEARCH_RADIUS_MAX = 3000
const SEARCH_RADIUS_API_DEBOUNCE_MS = 1400
const COMMUNE_BACK_ZOOM = 8.8
const DEPARTMENT_BACK_ZOOM = 5.7

const DEFAULT_FILTERS = {
  dept: '',
  commune: '',
  annee: 'all',
  fiber: 'all',
  coverage4g: 'all',
  coverage5g: 'all',
  segment: 'all',
}

const isCommuneCompatibleWithDept = (commune, dept) => {
  if (!commune || !dept) return true
  return commune.toUpperCase().startsWith(dept.toUpperCase())
}

const normalizeDeptInput = dept => {
  const normalized = dept.trim().toUpperCase()
  if (!normalized) return undefined
  if (/^\d$/.test(normalized)) return normalized.padStart(2, '0')
  if (/^(\d{2,3}|2A|2B)$/.test(normalized)) return normalized
  return undefined
}

const normalizeFilters = filters => {
  const dept = normalizeDeptInput(filters.dept)
  const commune = filters.commune.trim() || undefined
  return {
    dept,
    commune: isCommuneCompatibleWithDept(commune, dept) ? commune : undefined,
    annee: filters.annee,
    fiber: filters.fiber,
    coverage4g: filters.coverage4g,
    coverage5g: filters.coverage5g,
    segment: filters.segment,
    limit: ADDRESS_LIMIT,
  }
}

const hasActiveBusinessFilters = filters =>
  filters.fiber !== 'all' ||
  filters.coverage4g !== 'all' ||
  filters.coverage5g !== 'all' ||
  filters.segment !== 'all'

const inferDeptFromSuggestion = suggestion => {
  const code = suggestion?.codeInsee || suggestion?.postcode
  if (!code) return undefined
  const normalized = String(code).trim().toUpperCase()
  if (/^97[1-6]/.test(normalized)) return normalized.slice(0, 3)
  if (/^20/.test(normalized)) return undefined
  if (/^\d{5}$/.test(normalized)) return normalized.slice(0, 2)
  return undefined
}

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

const hasValidCoordinates = suggestion =>
  Number.isFinite(suggestion?.longitude) &&
  Number.isFinite(suggestion?.latitude) &&
  suggestion.longitude >= -180 &&
  suggestion.longitude <= 180 &&
  suggestion.latitude >= -90 &&
  suggestion.latitude <= 90

const emptyMapData = {
  points: [],
  clusters: [],
  totalInBounds: 0,
  returnedCount: 0,
  tooManyResults: false,
  clustered: false,
  coverage: [],
}

const enrichTerritoryGeoJson = (geoJson, rows, level) => {
  const statsByCode = new Map(
    rows.map(row => [level === 'france' ? row.codeDept : row.codeInsee, row])
  )
  return {
    ...geoJson,
    features: (geoJson?.features || []).flatMap(feature => {
      const code = feature.properties?.code
      const row = statsByCode.get(code)
      const summary = row?.summary || {}
      if (!row || !summary.totalBuildings) return []
      return [
        {
          ...feature,
          properties: {
            ...feature.properties,
            level,
            code,
            name: feature.properties?.nom || row?.nomCommune || code,
            totalBuildings: summary.totalBuildings,
            copperShutdown: summary.copperShutdown || 0,
            fiberBuildings: summary.fiberBuildings || 0,
            opportunityScore: summary.opportunityScore || 0,
          },
        },
      ]
    }),
  }
}

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

const isRateLimitError = error => {
  const message = error instanceof Error ? error.message : String(error || '')
  return /\b429\b|too many requests|rate limit|trop de requêtes/i.test(message)
}

const formatAcquiscanError = (error, fallback) => {
  if (isRateLimitError(error)) return null
  return error instanceof Error ? error.message : fallback
}

export function useAdressesAcquiscanLogic() {
  const { data: managers = [] } = useManagers()
  const { data: commercials = [] } = useCommercials()
  const latestMapRequest = useRef(0)
  const latestListRequest = useRef(0)
  const latestZonePreviewRequest = useRef(0)
  const latestSearchPreviewRequest = useRef(0)
  const mapStepBackLocked = useRef(false)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [territoryLevel, setTerritoryLevel] = useState('france')
  const [selectedDept, setSelectedDept] = useState(null)
  const [selectedCommune, setSelectedCommune] = useState(null)
  const [departmentGeoJson, setDepartmentGeoJson] = useState(null)
  const [communeGeoJson, setCommuneGeoJson] = useState(null)
  const [departmentOpportunities, setDepartmentOpportunities] = useState(null)
  const [communeOpportunities, setCommuneOpportunities] = useState(null)
  const [territoryLoading, setTerritoryLoading] = useState(false)
  const [territoryError, setTerritoryError] = useState(null)
  const [addressQuery, setAddressQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState(null)
  const [searchReturnContext, setSearchReturnContext] = useState(null)
  const [searchRadiusMeters, setSearchRadiusMeters] = useState(SEARCH_RADIUS_DEFAULT)
  const [committedSearchRadiusMeters, setCommittedSearchRadiusMeters] =
    useState(SEARCH_RADIUS_DEFAULT)
  const [searchPreview, setSearchPreview] = useState(null)
  const [searchPreviewLoading, setSearchPreviewLoading] = useState(false)
  const [searchPreviewError, setSearchPreviewError] = useState(null)
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
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState([])

  useEffect(() => {
    if (!filters.dept || !filters.commune) return
    if (isCommuneCompatibleWithDept(filters.commune.trim(), filters.dept.trim())) return
    setFilters(prev => ({ ...prev, commune: '' }))
  }, [filters.commune, filters.dept])

  const hasFilterPointMapContext =
    Boolean(selectedDept) && hasActiveBusinessFilters(filters) && !selectedSuggestion
  const hasAddressMapContext =
    Boolean(selectedCommune) && !hasFilterPointMapContext && !selectedSuggestion

  const mapInput = useMemo(() => {
    if (!hasAddressMapContext) return null
    const normalized = normalizeFilters(filters)
    if (!normalized.dept) return null
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
      cluster: hasFilterPointMapContext ? false : mapQuery.zoom < 10,
    }
  }, [filters, hasAddressMapContext, hasFilterPointMapContext, mapQuery])

  useEffect(() => {
    let cancelled = false
    const loadInitialTerritories = async () => {
      setTerritoryLoading(true)
      setTerritoryError(null)
      try {
        const [geoJson, opportunities] = await Promise.all([
          api.acquiscan.getTerritoryGeoJson({ level: 'departments' }),
          api.acquiscan.getDepartmentOpportunities(),
        ])
        if (cancelled) return
        setDepartmentGeoJson(geoJson)
        setDepartmentOpportunities(opportunities)
      } catch (err) {
        if (!cancelled)
          setTerritoryError(
            err instanceof Error ? err.message : 'Erreur de chargement des territoires Acquiscan'
          )
      } finally {
        if (!cancelled) setTerritoryLoading(false)
      }
    }
    loadInitialTerritories()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedDept) {
      setCommuneGeoJson(null)
      setCommuneOpportunities(null)
      return
    }
    let cancelled = false
    const loadCommunes = async () => {
      setTerritoryLoading(true)
      setTerritoryError(null)
      try {
        const [geoJson, opportunities] = await Promise.all([
          api.acquiscan.getTerritoryGeoJson({
            level: 'communes',
            dept: selectedDept.code,
            deptName: selectedDept.name,
          }),
          api.acquiscan.getCommuneOpportunities({ dept: selectedDept.code }),
        ])
        if (cancelled) return
        setCommuneGeoJson(geoJson)
        setCommuneOpportunities(opportunities)
      } catch (err) {
        if (!cancelled)
          setTerritoryError(
            err instanceof Error ? err.message : 'Erreur de chargement des communes Acquiscan'
          )
      } finally {
        if (!cancelled) setTerritoryLoading(false)
      }
    }
    loadCommunes()
    return () => {
      cancelled = true
    }
  }, [selectedDept])

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
    if (!mapInput) {
      latestMapRequest.current += 1
      setMapData(emptyMapData)
      setMapLoading(false)
      setMapError(null)
      setSelectedId(null)
      return
    }
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
      setMapError(formatAcquiscanError(err, 'Erreur de chargement des adresses Acquiscan'))
    } finally {
      if (latestMapRequest.current === requestId) setMapLoading(false)
    }
  }, [mapInput])

  const listInput = useMemo(() => {
    const normalized = normalizeFilters(filters)
    if (!normalized.dept || (!normalized.commune && !hasFilterPointMapContext)) return null
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
  }, [filters, hasFilterPointMapContext])

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

  const searchPreviewInput = useMemo(() => {
    if (!selectedSuggestion || !hasValidCoordinates(selectedSuggestion)) return null
    const normalized = normalizeFilters(filters)
    const inferredDept = inferDeptFromSuggestion(selectedSuggestion)
    const inferredCommune = selectedSuggestion.codeInsee || undefined
    return {
      longitude: Number(selectedSuggestion.longitude.toFixed(7)),
      latitude: Number(selectedSuggestion.latitude.toFixed(7)),
      radiusMeters: Math.round(committedSearchRadiusMeters),
      dept: normalized.dept || inferredDept,
      commune: normalized.commune || inferredCommune,
      annee: normalized.annee,
      fiber: normalized.fiber,
      coverage4g: normalized.coverage4g,
      coverage5g: normalized.coverage5g,
      segment: normalized.segment,
      limit: ADDRESS_LIMIT,
    }
  }, [committedSearchRadiusMeters, filters, selectedSuggestion])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCommittedSearchRadiusMeters(searchRadiusMeters)
    }, SEARCH_RADIUS_API_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchRadiusMeters])

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
      setListError(formatAcquiscanError(err, 'Erreur de chargement des adresses Acquiscan'))
    } finally {
      if (latestListRequest.current === requestId) setListLoading(false)
    }
  }, [listInput])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadMap()
    }, 550)
    return () => window.clearTimeout(timer)
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
      setExcludedTargetIds(current =>
        current.filter(id => result.targets.some(target => target.immeubleId === id))
      )
    } catch (err) {
      if (latestZonePreviewRequest.current !== requestId) return
      setZonePreviewError(formatAcquiscanError(err, 'Erreur de preview zone Acquiscan'))
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

  const loadSearchPreview = useCallback(async () => {
    if (!searchPreviewInput) {
      latestSearchPreviewRequest.current += 1
      setSearchPreview(null)
      setSearchPreviewError(null)
      setSearchPreviewLoading(false)
      return
    }

    const requestId = latestSearchPreviewRequest.current + 1
    latestSearchPreviewRequest.current = requestId
    setSearchPreviewLoading(true)
    setSearchPreviewError(null)
    try {
      const result = await api.acquiscan.getZonePreview(searchPreviewInput)
      if (latestSearchPreviewRequest.current !== requestId) return
      setSearchPreview(result)
      setSelectedId(current => {
        if (!result.targets.length) return null
        return result.targets.some(target => target.immeubleId === current) ? current : null
      })
    } catch (err) {
      if (latestSearchPreviewRequest.current !== requestId) return
      setSearchPreviewError(formatAcquiscanError(err, 'Erreur de recherche proximité Acquiscan'))
    } finally {
      if (latestSearchPreviewRequest.current === requestId) setSearchPreviewLoading(false)
    }
  }, [searchPreviewInput])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadSearchPreview()
    }, 450)
    return () => window.clearTimeout(timer)
  }, [loadSearchPreview])

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'dept') next.commune = ''
      return next
    })
  }, [])

  const selectDepartment = useCallback(department => {
    if (!department?.code) return
    setSelectedDept({
      code: department.code,
      name: department.name || department.nom || department.code,
    })
    setSelectedCommune(null)
    setTerritoryLevel('department')
    setListData(null)
    setMapData(emptyMapData)
    setFilters(prev => ({ ...prev, dept: department.code, commune: '' }))
  }, [])

  const selectCommune = useCallback(
    commune => {
      if (!selectedDept?.code || !commune?.code) return
      setSelectedCommune({ code: commune.code, name: commune.name || commune.nom || commune.code })
      setTerritoryLevel('commune')
      setMapData(null)
      setFilters(prev => ({ ...prev, dept: selectedDept.code, commune: commune.code }))
    },
    [selectedDept]
  )

  const goBackTerritory = useCallback(() => {
    if (territoryLevel === 'commune') {
      setSelectedCommune(null)
      setTerritoryLevel('department')
      setListData(null)
      setMapData(emptyMapData)
      setSelectedId(null)
      setFilters(prev => ({ ...prev, commune: '' }))
      return
    }
    if (territoryLevel === 'department') {
      setSelectedDept(null)
      setSelectedCommune(null)
      setTerritoryLevel('france')
      setListData(null)
      setMapData(emptyMapData)
      setSelectedId(null)
      setFilters(prev => ({ ...prev, dept: '', commune: '' }))
    }
  }, [territoryLevel])

  const restoreSearchReturnContext = useCallback(() => {
    if (searchReturnContext) {
      setTerritoryLevel(searchReturnContext.territoryLevel)
      setSelectedDept(searchReturnContext.selectedDept)
      setSelectedCommune(searchReturnContext.selectedCommune)
      setFilters(prev => ({
        ...prev,
        dept: searchReturnContext.dept,
        commune: searchReturnContext.commune,
      }))
      setSearchReturnContext(null)
      return
    }

    if (selectedCommune && selectedDept) {
      setFilters(prev => ({ ...prev, dept: selectedDept.code, commune: selectedCommune.code }))
      return
    }

    if (selectedDept) {
      setFilters(prev => ({ ...prev, dept: selectedDept.code, commune: '' }))
    }
  }, [searchReturnContext, selectedCommune, selectedDept])

  const stepBackFromMapZoom = useCallback(
    zoom => {
      if (zoneMode) return false
      if (mapStepBackLocked.current) return false
      if (selectedSuggestion) return false

      if (territoryLevel === 'commune' && zoom <= COMMUNE_BACK_ZOOM) {
        mapStepBackLocked.current = true
        setSelectedCommune(null)
        setTerritoryLevel('department')
        setListData(null)
        setMapData(emptyMapData)
        setSelectedId(null)
        setFilters(prev => ({ ...prev, commune: '' }))
        return true
      }

      if (territoryLevel === 'department' && zoom <= DEPARTMENT_BACK_ZOOM) {
        mapStepBackLocked.current = true
        setSelectedDept(null)
        setSelectedCommune(null)
        setTerritoryLevel('france')
        setListData(null)
        setMapData(emptyMapData)
        setSelectedId(null)
        setFilters(prev => ({ ...prev, dept: '', commune: '' }))
        return true
      }

      return false
    },
    [selectedSuggestion, territoryLevel, zoneMode]
  )

  const releaseMapStepBackLock = useCallback(() => {
    mapStepBackLocked.current = false
  }, [])

  const updateMapViewport = useCallback((bounds, zoom) => {
    if (!bounds) return
    const nextBounds = normalizeBounds(bounds)
    const nextZoom = Number(zoom.toFixed(2))
    setMapQuery(current => {
      const sameBounds =
        current.bounds.west === nextBounds.west &&
        current.bounds.south === nextBounds.south &&
        current.bounds.east === nextBounds.east &&
        current.bounds.north === nextBounds.north
      if (sameBounds && current.zoom === nextZoom) return current
      return {
        bounds: nextBounds,
        zoom: nextZoom,
      }
    })
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      fiber: DEFAULT_FILTERS.fiber,
      coverage4g: DEFAULT_FILTERS.coverage4g,
      coverage5g: DEFAULT_FILTERS.coverage5g,
      segment: DEFAULT_FILTERS.segment,
    }))
    setListData(null)
    setMapData(null)
    setSelectedId(null)
  }, [])

  const clearSearchSelection = useCallback(() => {
    setAddressQuery('')
    setSuggestions([])
    setSuggestionsError(null)
    setSelectedSuggestion(null)
    setSearchPreview(null)
    setSearchPreviewError(null)
    setSelectedId(null)
    restoreSearchReturnContext()
  }, [restoreSearchReturnContext])

  const searchRows = useMemo(
    () =>
      (searchPreview?.targets || []).map(target => ({
        ...target,
        coordinates: {
          latitude: target.latitude,
          longitude: target.longitude,
        },
      })),
    [searchPreview?.targets]
  )
  const mapRows = useMemo(() => (mapData?.points || []).map(mapPointToAddress), [mapData?.points])
  const remoteCoordinateRows = useMemo(
    () =>
      (listData?.rows || []).filter(
        row => row.hasCoordinates && row.coordinates?.latitude && row.coordinates?.longitude
      ),
    [listData?.rows]
  )
  const hasSearchMode = Boolean(selectedSuggestion)
  const rows = useMemo(() => {
    if (hasSearchMode) return searchRows
    return remoteCoordinateRows.length ? remoteCoordinateRows : mapRows
  }, [hasSearchMode, mapRows, remoteCoordinateRows, searchRows])
  const selectedAddress = useMemo(
    () => rows.find(row => row.immeubleId === selectedId) || null,
    [rows, selectedId]
  )

  const territoryGeoJson = useMemo(() => {
    if (hasSearchMode) return null
    if (hasFilterPointMapContext) return null
    if (territoryLevel === 'france' && departmentGeoJson && departmentOpportunities) {
      return enrichTerritoryGeoJson(departmentGeoJson, departmentOpportunities.rows || [], 'france')
    }
    if (
      (territoryLevel === 'department' || territoryLevel === 'commune') &&
      communeGeoJson &&
      communeOpportunities
    ) {
      const enriched = enrichTerritoryGeoJson(
        communeGeoJson,
        communeOpportunities.rows || [],
        'department'
      )
      if (territoryLevel === 'commune') return null
      return enriched
    }
    return null
  }, [
    communeGeoJson,
    communeOpportunities,
    departmentGeoJson,
    departmentOpportunities,
    hasFilterPointMapContext,
    hasSearchMode,
    territoryLevel,
  ])

  const selectedCommuneGeoJson = useMemo(() => {
    if (!selectedCommune?.code || !communeGeoJson?.features?.length) return null
    const feature = communeGeoJson.features.find(
      item => item.properties?.code === selectedCommune.code
    )
    if (!feature) return null
    return {
      type: 'FeatureCollection',
      features: [
        {
          ...feature,
          properties: {
            ...feature.properties,
            name: selectedCommune.name || feature.properties?.nom || selectedCommune.code,
          },
        },
      ],
    }
  }, [communeGeoJson, selectedCommune])

  const stats = useMemo(() => {
    const shutdownCount = rows.filter(
      row =>
        row.fermetureTechnique === '1' ||
        row.fermetureComAddr === '1' ||
        row.fermetureComZone === '1'
    ).length
    const fiberCount = rows.filter(row => row.eligFo === '1').length
    return {
      total: hasSearchMode ? searchPreview?.totalInCircle || 0 : mapData?.totalInBounds || 0,
      shown: hasSearchMode ? rows.length : mapData?.returnedCount || rows.length,
      rows: rows.length,
      shutdownCount,
      fiberCount,
      listTotal: hasSearchMode
        ? searchPreview?.totalInCircle || rows.length
        : listData?.total || mapData?.totalInBounds || 0,
    }
  }, [
    hasSearchMode,
    listData?.total,
    mapData?.returnedCount,
    mapData?.totalInBounds,
    rows,
    searchPreview?.totalInCircle,
  ])

  const updateSearchRadius = useCallback(radiusMeters => {
    const nextRadius = Number(radiusMeters)
    if (!Number.isFinite(nextRadius)) return
    setSearchRadiusMeters(Math.min(SEARCH_RADIUS_MAX, Math.max(SEARCH_RADIUS_MIN, nextRadius)))
  }, [])

  const selectSuggestion = useCallback(
    suggestion => {
      if (!hasValidCoordinates(suggestion)) {
        setSuggestionsError('Coordonnées invalides pour cette adresse.')
        return
      }
      setSearchReturnContext({
        territoryLevel,
        selectedDept,
        selectedCommune,
        dept: filters.dept,
        commune: filters.commune,
      })
      setSelectedSuggestion(suggestion)
      setSearchRadiusMeters(current => current || SEARCH_RADIUS_DEFAULT)
      setCommittedSearchRadiusMeters(current => current || SEARCH_RADIUS_DEFAULT)
      setSearchPreview(null)
      setSearchPreviewError(null)
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
    },
    [
      draftCircle?.radiusMeters,
      filters.commune,
      filters.dept,
      selectedCommune,
      selectedDept,
      territoryLevel,
      zoneMode,
    ]
  )

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
    setSelectedAssignmentIds([])
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
    setDraftCircle(current =>
      current
        ? {
            ...current,
            radiusMeters: Math.min(10000, Math.max(50, nextRadius)),
          }
        : current
    )
    setCreatedZone(null)
  }, [])

  const toggleZoneTarget = useCallback(immeubleId => {
    setExcludedTargetIds(current =>
      current.includes(immeubleId)
        ? current.filter(id => id !== immeubleId)
        : [...current, immeubleId]
    )
  }, [])

  const selectedZoneTargetIds = useMemo(() => {
    const excluded = new Set(excludedTargetIds)
    return (zonePreview?.targets || [])
      .filter(target => !excluded.has(target.immeubleId))
      .map(target => target.immeubleId)
  }, [excludedTargetIds, zonePreview?.targets])

  const assignableUsers = useMemo(() => {
    const formatName = user =>
      [user?.prenom, user?.nom].filter(Boolean).join(' ').trim() ||
      user?.email ||
      `Utilisateur ${user?.id}`

    const managerItems = (managers || []).map(manager => ({
      key: `manager:${manager.id}`,
      id: manager.id,
      role: 'manager',
      label: formatName(manager),
      subtitle: 'Manager',
    }))

    const commercialItems = (commercials || []).map(commercial => ({
      key: `commercial:${commercial.id}`,
      id: commercial.id,
      role: 'commercial',
      label: formatName(commercial),
      subtitle: 'Commercial',
    }))

    return [...managerItems, ...commercialItems].sort((a, b) =>
      a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' })
    )
  }, [commercials, managers])

  const selectedAssignments = useMemo(() => {
    const selected = new Set(selectedAssignmentIds)
    return assignableUsers.filter(user => selected.has(user.key))
  }, [assignableUsers, selectedAssignmentIds])

  const toggleAssignment = useCallback(key => {
    setSelectedAssignmentIds(current =>
      current.includes(key) ? current.filter(item => item !== key) : [...current, key]
    )
  }, [])

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

      if (selectedAssignments.length) {
        const assignments = await Promise.allSettled(
          selectedAssignments.map(async user => {
            const assigned =
              user.role === 'manager'
                ? await api.managers.assignZone(user.id, zone.id)
                : await api.commercials.assignZone(user.id, zone.id)
            if (!assigned) throw new Error(`Assignation ${user.label} refusée`)
            return assigned
          })
        )
        const failedCount = assignments.filter(result => result.status === 'rejected').length
        if (failedCount) {
          setZoneCreateError(
            `Zone créée, mais ${failedCount} assignation${failedCount > 1 ? 's' : ''} ont échoué.`
          )
        }
      }

      setCreatedZone(zone)
      return zone
    } catch (err) {
      setZoneCreateError(
        err instanceof Error ? err.message : 'Erreur de création de zone Acquiscan'
      )
      return null
    } finally {
      setZoneCreateLoading(false)
    }
  }, [selectedAssignments, selectedZoneTargetIds, zoneName, zonePreviewInput])

  return {
    filters,
    updateFilter,
    resetFilters,
    territoryLevel,
    selectedDept,
    selectedCommune,
    territoryGeoJson,
    selectedCommuneGeoJson,
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
    initialViewState: INITIAL_VIEW_STATE,
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
    stats,
    loading: mapLoading || listLoading || searchPreviewLoading,
    mapLoading,
    listLoading,
    error: mapError || listError || searchPreviewError,
    mapError,
    listError,
    refetch: () => {
      loadMap()
      loadList()
      loadSearchPreview()
    },
  }
}
