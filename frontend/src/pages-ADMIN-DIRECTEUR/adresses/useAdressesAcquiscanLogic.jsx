import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/services'

const DEFAULT_FILTERS = {
  dept: '75',
  commune: '',
  annee: 'all',
  search: '',
  fiber: 'all',
  coverage4g: 'all',
  coverage5g: 'all',
  segment: 'all',
  limit: 100,
}

const normalizeFilters = filters => ({
  dept: filters.dept.trim().toUpperCase(),
  commune: filters.commune.trim() || undefined,
  annee: filters.annee,
  search: filters.search.trim() || undefined,
  fiber: filters.fiber,
  coverage4g: filters.coverage4g,
  coverage5g: filters.coverage5g,
  segment: filters.segment,
  limit: Number(filters.limit) || 100,
})

const hasCoordinates = row =>
  typeof row.coordinates?.latitude === 'number' && typeof row.coordinates?.longitude === 'number'

export function useAdressesAcquiscanLogic() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [page, setPage] = useState(0)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)
  const [importError, setImportError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  const offset = page * Number(filters.limit || 100)

  const queryInput = useMemo(
    () => ({
      ...normalizeFilters(filters),
      offset,
      enrichCoordinates: false,
    }),
    [filters, offset]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.acquiscan.getAddresses(queryInput)
      setData(result)
      setSelectedId(currentId =>
        result.rows.length && !result.rows.some(row => row.immeubleId === currentId)
          ? result.rows[0].immeubleId
          : currentId
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement Acquiscan')
    } finally {
      setLoading(false)
    }
  }, [queryInput])

  useEffect(() => {
    load()
  }, [load])

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(0)
  }, [])

  const importCoordinates = useCallback(async () => {
    const dept = normalizeFilters(filters).dept
    setImporting(true)
    setImportError(null)
    try {
      await api.acquiscan.importCoordinates(dept)
      await load()
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Erreur import coordonnées Acquiscan')
    } finally {
      setImporting(false)
    }
  }, [filters, load])

  const rows = data?.rows || []
  const rowsWithCoordinates = useMemo(() => rows.filter(hasCoordinates), [rows])

  const selectedAddress = useMemo(
    () => rows.find(row => row.immeubleId === selectedId) || rows[0] || null,
    [rows, selectedId]
  )

  const stats = useMemo(() => {
    const fiberCount = rows.filter(row => row.eligFo === '1').length
    const shutdownCount = rows.filter(
      row =>
        row.fermetureTechnique === '1' ||
        row.fermetureComAddr === '1' ||
        row.fermetureComZone === '1'
    ).length
    return {
      total: data?.total || 0,
      shown: rows.length,
      geocoded: rowsWithCoordinates.length,
      fiberCount,
      shutdownCount,
    }
  }, [data?.total, rows, rowsWithCoordinates.length])

  const mapCenter = useMemo(() => {
    if (!rowsWithCoordinates.length) {
      return { longitude: 2.3522, latitude: 48.8566, zoom: 5 }
    }

    const avgLatitude =
      rowsWithCoordinates.reduce((sum, row) => sum + row.coordinates.latitude, 0) /
      rowsWithCoordinates.length
    const avgLongitude =
      rowsWithCoordinates.reduce((sum, row) => sum + row.coordinates.longitude, 0) /
      rowsWithCoordinates.length
    return { longitude: avgLongitude, latitude: avgLatitude, zoom: rowsWithCoordinates.length > 1 ? 11 : 15 }
  }, [rowsWithCoordinates])

  return {
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
    refetch: load,
    importCoordinates,
    hasPreviousPage: page > 0,
    hasNextPage: offset + rows.length < (data?.total || 0),
  }
}
