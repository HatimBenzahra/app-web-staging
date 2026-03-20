import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useEcoutesUsers } from '@/hooks/ecoutes/useEcoutesUsers'
import { usePagination } from '@/hooks/utils/data/usePagination'
import { useErrorToast } from '@/hooks/utils/ui/use-error-toast'
import { RecordingService } from '@/services/audio'
import { getStatusFilterOptions } from '@/constants/domain/user-status'
import {
  buildUserLookup,
  enrichRecordingWithUser,
  filterRecordings,
  sortRecordings,
} from './ecoutes-utils'

export function useEnregistrementLogic() {
  const { allUsers, loading, error, refetch } = useEcoutesUsers()
  const { showSuccess, showError } = useErrorToast()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCommercialForRecordings, setSelectedCommercialForRecordings] = useState(null)
  const [recordings, setRecordings] = useState([])
  const [loadingRecordings, setLoadingRecordings] = useState(false)
  const [playingRecording, setPlayingRecording] = useState(null)
  const [statusFilter, setStatusFilter] = useState('ACTIF')
  const [recentRecordings, setRecentRecordings] = useState([])
  const [loadingRecentRecordings, setLoadingRecentRecordings] = useState(false)
  const [recentRecordingsError, setRecentRecordingsError] = useState(null)
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' })
  const [dateFrom, setDateFrom] = useState(null)
  const [dateTo, setDateTo] = useState(null)
  const [selectedRecordingIds, setSelectedRecordingIds] = useState(new Set())
  const [bulkDownloading, setBulkDownloading] = useState(false)
  const [currentModalRecordingIndex, setCurrentModalRecordingIndex] = useState(null)
  const [extractionQueue, setExtractionQueue] = useState([])
  const [extractionDrawerOpen, setExtractionDrawerOpen] = useState(false)
  const [selectedRecentIds, setSelectedRecentIds] = useState(new Set())
  const [processedKeys, setProcessedKeys] = useState(new Set())
  const [speechScores, setSpeechScores] = useState(new Map())
  const speechScoresRef = useRef(speechScores)
  speechScoresRef.current = speechScores

  const statusFilterOptions = useMemo(
    () => [{ value: 'ALL', label: 'Tous' }, ...getStatusFilterOptions()],
    []
  )

  const filteredUsers = useMemo(() => {
    if (!allUsers) return []
    return allUsers.filter(user =>
      statusFilter === 'ALL' ? true : user?.status === statusFilter
    )
  }, [allUsers, statusFilter])

  useEffect(() => {
    if (!allUsers || allUsers.length === 0) {
      setRecentRecordings([])
      setRecentRecordingsError(null)
      setLoadingRecentRecordings(false)
      return
    }

    let isActive = true

    const loadRecentRecordings = async () => {
      setLoadingRecentRecordings(true)
      setRecentRecordingsError(null)

      const roomNames = allUsers.map(
        user => `room:${(user.userType || '').toLowerCase()}:${user.id}`
      )
      const userLookup = buildUserLookup(allUsers)

      const { items } = await RecordingService.getAllRecentRecordings(roomNames)

      if (!isActive) return

      const enriched = items.map(recording =>
        enrichRecordingWithUser(recording, userLookup, RecordingService.formatFileSize)
      )

      setRecentRecordings(enriched)
      setRecentRecordingsError(null)
      setLoadingRecentRecordings(false)
    }

    loadRecentRecordings().catch(loadError => {
      if (!isActive) return
      console.warn('Erreur chargement enregistrements récents:', loadError)
      setRecentRecordings([])
      setRecentRecordingsError('Impossible de charger les enregistrements récents')
      setLoadingRecentRecordings(false)
    })

    return () => {
      isActive = false
    }
  }, [allUsers])

  useEffect(() => {
    if (!recentRecordings.length) return
    let active = true

    const keys = recentRecordings.map(r => r.key)
    RecordingService.getProcessedKeys(keys).then(processed => {
      if (active) setProcessedKeys(processed)
    })

    return () => { active = false }
  }, [recentRecordings])

  useEffect(() => {
    const allKeys = [
      ...recentRecordings.map(r => r.key),
      ...recordings.map(r => r.key),
    ].filter(Boolean)
    const uniqueKeys = [...new Set(allKeys)]
    if (!uniqueKeys.length) return

    let active = true
    let timerId

    const fetchScores = async () => {
      if (!active) return

      const currentScores = speechScoresRef.current
      const keysToFetch = uniqueKeys.filter(k => {
        const cached = currentScores.get(k)
        return !cached || cached.status !== 'ready'
      })

      if (!keysToFetch.length) return

      try {
        const results = await RecordingService.getSpeechScores(keysToFetch)
        if (!active) return
        setSpeechScores(prev => {
          let changed = false
          for (const r of results) {
            const existing = prev.get(r.key)
            if (!existing || existing.status !== r.status || existing.score !== r.score) {
              changed = true
              break
            }
          }
          if (!changed) return prev

          const next = new Map(prev)
          results.forEach(r => { next.set(r.key, r) })
          return next
        })
        const hasUnready = results.some(r => r.status !== 'ready')
        if (hasUnready && active) {
          timerId = setTimeout(fetchScores, 4000)
        }
      } catch {
        void 0
      }
    }

    fetchScores()

    return () => {
      active = false
      clearTimeout(timerId)
    }
  }, [recentRecordings, recordings])

  const handleSort = useCallback(key => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }))
  }, [])

  const resetSelection = useCallback(() => {
    setSelectedCommercialForRecordings(null)
    setRecordings([])
  }, [])

  useEffect(() => {
    if (!selectedCommercialForRecordings) return

    const stillVisible = filteredUsers.some(
      user =>
        user.id === selectedCommercialForRecordings.id &&
        user.userType === selectedCommercialForRecordings.userType
    )

    if (!stillVisible) {
      resetSelection()
    }
  }, [filteredUsers, selectedCommercialForRecordings, resetSelection])

  // Charger les enregistrements pour un utilisateur sélectionné
  const loadRecordingsForCommercial = useCallback(async commercial => {
    if (!commercial) {
      setRecordings([])
      return
    }

    setLoadingRecordings(true)
    try {
      // Utiliser userType pour charger les bons enregistrements (manager ou commercial)
      const userType = commercial.userType
      const recordingsData = await RecordingService.getRecordingsForUser(commercial.id, userType)
      setRecordings(recordingsData)
      showSuccess(
        `${recordingsData.length} enregistrement(s) chargé(s) pour ${commercial.prenom} ${commercial.nom}`
      )
    } catch (error) {
      console.error('Erreur chargement enregistrements:', error)
      showError('Erreur lors du chargement des enregistrements')
      setRecordings([])
    } finally {
      setLoadingRecordings(false)
    }
  }, [showSuccess, showError])

  const filteredRecordings = useMemo(
    () => filterRecordings(recordings, searchTerm, dateFrom, dateTo),
    [recordings, searchTerm, dateFrom, dateTo]
  )

  const sortedRecordings = useMemo(
    () => sortRecordings(filteredRecordings, sortConfig, speechScores),
    [filteredRecordings, sortConfig, speechScores]
  )

  // Utiliser le hook de pagination
  const {
    currentItems: currentRecordings,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToNextPage,
    goToPreviousPage,
    hasNextPage,
    hasPreviousPage,
  } = usePagination(sortedRecordings, 20)

  const selectableCurrentRecordings = useMemo(
    () => currentRecordings.filter(recording => !processedKeys.has(recording.key)),
    [currentRecordings, processedKeys]
  )

  const selectedCount = useMemo(
    () =>
      selectableCurrentRecordings.reduce(
        (count, recording) => (selectedRecordingIds.has(recording.id) ? count + 1 : count),
        0
      ),
    [selectableCurrentRecordings, selectedRecordingIds]
  )

  const toggleRecordingSelection = useCallback(id => {
    setSelectedRecordingIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedRecordingIds(new Set())
  }, [])

  const toggleSelectAll = useCallback(() => {
    const selectableIds = selectableCurrentRecordings.map(recording => recording.id)
    if (!selectableIds.length) return

    const allCurrentSelected = selectableIds.every(id => selectedRecordingIds.has(id))

    setSelectedRecordingIds(prev => {
      const next = new Set(prev)
      if (allCurrentSelected) {
        selectableIds.forEach(id => {
          next.delete(id)
        })
      } else {
        selectableIds.forEach(id => {
          next.add(id)
        })
      }
      return next
    })
  }, [selectableCurrentRecordings, selectedRecordingIds])

  useEffect(() => {
    if (!selectedCommercialForRecordings && currentPage === 1) {
      setSelectedRecordingIds(new Set())
      return
    }

    setSelectedRecordingIds(new Set())
  }, [selectedCommercialForRecordings, currentPage])

  useEffect(() => {
    setSelectedRecordingIds(prev => {
      if (!prev.size) return prev

      const selectableIds = new Set(
        currentRecordings
          .filter(recording => !processedKeys.has(recording.key))
          .map(recording => recording.id)
      )

      let changed = false
      const next = new Set()

      prev.forEach(id => {
        if (selectableIds.has(id)) {
          next.add(id)
        } else {
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [currentRecordings, processedKeys])

  const handleBulkDownload = useCallback(async () => {
    if (!selectedRecordingIds.size) return

    setBulkDownloading(true)
    try {
      const toDownload = currentRecordings.filter(recording => selectedRecordingIds.has(recording.id))

      for (const recording of toDownload) {
        try {
          const url = recording.rawUrl || recording.url || await RecordingService.getStreamingUrl(recording.key)
          if (url) {
            RecordingService.downloadRecording(url, recording.filename)
            await new Promise(resolve => setTimeout(resolve, 300))
          }
        } catch {
          console.warn('Erreur téléchargement:', recording.filename)
        }
      }

      showSuccess(`${toDownload.length} fichier(s) téléchargé(s)`)
      clearSelection()
    } finally {
      setBulkDownloading(false)
    }
  }, [selectedRecordingIds, currentRecordings, showSuccess, clearSelection])

  const currentModalRecording = useMemo(() => {
    if (currentModalRecordingIndex === null) return null
    return currentRecordings[currentModalRecordingIndex] || null
  }, [currentModalRecordingIndex, currentRecordings])

  const hasNextRecording =
    currentModalRecordingIndex !== null && currentModalRecordingIndex < currentRecordings.length - 1
  const hasPreviousRecording = currentModalRecordingIndex !== null && currentModalRecordingIndex > 0

  const openRecordingModal = useCallback(
    recording => {
      const index = currentRecordings.findIndex(item => item.id === recording.id)
      if (index >= 0) {
        setCurrentModalRecordingIndex(index)
      }
    },
    [currentRecordings]
  )

  const closeRecordingModal = useCallback(() => {
    setCurrentModalRecordingIndex(null)
  }, [])

  const goToNextRecording = useCallback(() => {
    setCurrentModalRecordingIndex(prev => {
      if (prev === null || prev >= currentRecordings.length - 1) return prev
      return prev + 1
    })
  }, [currentRecordings.length])

  const goToPreviousRecording = useCallback(() => {
    setCurrentModalRecordingIndex(prev => {
      if (prev === null || prev <= 0) return prev
      return prev - 1
    })
  }, [])

  useEffect(() => {
    if (currentModalRecordingIndex === null) return
    if (currentModalRecordingIndex >= currentRecordings.length) {
      setCurrentModalRecordingIndex(null)
    }
  }, [currentModalRecordingIndex, currentRecordings.length])

  const hasActiveExtractions = extractionQueue.some(
    item => item.step !== 'done' && item.step !== 'error'
  )
  const shouldPoll = extractionDrawerOpen || hasActiveExtractions

  useEffect(() => {
    if (!shouldPoll) return

    let active = true
    let timerId

    const poll = async () => {
      if (!active) return
      try {
        const queue = await RecordingService.getExtractionQueue()
        if (active) setExtractionQueue(queue)
      } catch (error) {
        void error
      }
      if (active) timerId = setTimeout(poll, 2000)
    }

    timerId = setTimeout(poll, 2000)

    return () => {
      active = false
      clearTimeout(timerId)
    }
  }, [shouldPoll])

  const toggleRecentSelection = useCallback(id => {
    setSelectedRecentIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearRecentSelection = useCallback(() => {
    setSelectedRecentIds(new Set())
  }, [])

  useEffect(() => {
    setSelectedRecentIds(prev => {
      if (!prev.size) return prev

      const selectableIds = new Set(
        recentRecordings
          .filter(recording => !processedKeys.has(recording.key))
          .map(recording => recording.id)
      )

      let changed = false
      const next = new Set()

      prev.forEach(id => {
        if (selectableIds.has(id)) {
          next.add(id)
        } else {
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [recentRecordings, processedKeys])

  const handleBatchExtraction = useCallback(async () => {
    if (!selectedRecordingIds.size) return

    const keys = currentRecordings
      .filter(r => selectedRecordingIds.has(r.id) && !processedKeys.has(r.key))
      .map(r => r.key)

    if (!keys.length) return

    try {
      await RecordingService.triggerBatchExtraction(keys)
      setExtractionDrawerOpen(true)
      const queue = await RecordingService.getExtractionQueue()
      setExtractionQueue(queue)
      showSuccess(`${keys.length} extraction(s) lancée(s)`)
    } catch (err) {
      console.error('Erreur batch extraction:', err)
      showError("Erreur lors du lancement des extractions")
    }
  }, [selectedRecordingIds, currentRecordings, processedKeys, showSuccess, showError])

  const handleRecentBatchExtraction = useCallback(async (recentRecordings) => {
    if (!selectedRecentIds.size) return

    const keys = recentRecordings
      .filter(r => selectedRecentIds.has(r.id) && !processedKeys.has(r.key))
      .map(r => r.key)

    if (!keys.length) return

    try {
      await RecordingService.triggerBatchExtraction(keys)
      setExtractionDrawerOpen(true)
      clearRecentSelection()
      const queue = await RecordingService.getExtractionQueue()
      setExtractionQueue(queue)
      showSuccess(`${keys.length} extraction(s) lancée(s)`)
    } catch (err) {
      console.error('Erreur batch extraction:', err)
      showError("Erreur lors du lancement des extractions")
    }
  }, [selectedRecentIds, processedKeys, clearRecentSelection, showSuccess, showError])

  const handleDownloadRecording = async recording => {
    try {
      const url = recording.url || recording.rawUrl || await RecordingService.getStreamingUrl(recording.key)
      if (url) {
        RecordingService.downloadRecording(url, recording.filename)
        showSuccess(`Téléchargement de ${recording.filename} démarré`)
      } else {
        showError('URL de téléchargement non disponible')
      }
    } catch {
      showError('Erreur lors de la génération du lien de téléchargement')
    }
  }

  const handlePlayRecording = async recording => {
    if (playingRecording?.id === recording.id) {
      setPlayingRecording(null)
      return
    }

    try {
      const streamingUrl = await RecordingService.getStreamingUrl(recording.key)

      if (!streamingUrl) {
        showError("Impossible de générer l'URL de streaming")
        return
      }

      const recordingWithStreamingUrl = {
        ...recording,
        url: streamingUrl,
      }

      setPlayingRecording(recordingWithStreamingUrl)
    } catch (error) {
      console.error('Erreur génération URL streaming:', error)
      showError('Erreur lors de la préparation de la lecture')
    }
  }

  const handleUserSelection = useCallback(user => {
    setSelectedCommercialForRecordings(user)
    loadRecordingsForCommercial(user)
  }, [loadRecordingsForCommercial])

  return {
    filteredUsers,
    allUsers,
    loading,
    error,
    refetch,
    searchTerm,
    setSearchTerm,
    selectedCommercialForRecordings,
    recordings,
    loadingRecordings,
    playingRecording,
    currentRecordings,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToNextPage,
    goToPreviousPage,
    hasNextPage,
    hasPreviousPage,
    filteredRecordingsCount: filteredRecordings.length,
    handleDownloadRecording,
    handlePlayRecording,
    resetSelection,
    handleUserSelection,
    statusFilter,
    setStatusFilter,
    statusFilterOptions,
    recentRecordings,
    loadingRecentRecordings,
    recentRecordingsError,
    sortConfig,
    handleSort,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    selectedRecordingIds,
    selectedCount,
    toggleRecordingSelection,
    toggleSelectAll,
    clearSelection,
    handleBulkDownload,
    bulkDownloading,
    currentModalRecording,
    openRecordingModal,
    closeRecordingModal,
    goToNextRecording,
    goToPreviousRecording,
    hasNextRecording,
    hasPreviousRecording,
    extractionQueue,
    extractionDrawerOpen,
    setExtractionDrawerOpen,
    handleBatchExtraction,
    selectedRecentIds,
    toggleRecentSelection,
    clearRecentSelection,
    handleRecentBatchExtraction,
    processedKeys,
    speechScores,
  }
}
