export function buildUserLookup(users) {
  const lookup = new Map()
  for (const user of users) {
    const safeRoom = `room_${(user.userType || '').toLowerCase()}_${user.id}`
    lookup.set(safeRoom, user)
  }
  return lookup
}

export function enrichRecordingWithUser(recording, userLookup, formatSize) {
  const keyParts = recording.key.split('/').filter(Boolean)
  const safeRoom = keyParts.length >= 2 ? keyParts[keyParts.length - 2] : ''
  const user = userLookup.get(safeRoom)

  const userName = user ? `${user.prenom || ''} ${user.nom || ''}`.trim() : ''
  return {
    id: recording.key,
    key: recording.key,
    url: null,
    rawUrl: null,
    size: recording.size,
    lastModified: recording.lastModified,
    filename: recording.key.split('/').pop() || '',
    date: recording.lastModified ? new Date(recording.lastModified).toLocaleDateString() : '',
    time: recording.lastModified ? new Date(recording.lastModified).toLocaleTimeString() : '',
    duration: formatSize(recording.size),
    userId: user?.id,
    userType: user?.userType,
    userName,
    userPrenom: user?.prenom,
    userNom: user?.nom,
  }
}

export function filterRecordings(recordings, searchTerm, dateFrom, dateTo) {
  if (!recordings) return []
  return recordings.filter(recording => {
    const searchMatch =
      !searchTerm || recording.filename.toLowerCase().includes(searchTerm.toLowerCase())

    const dateMatch = (() => {
      if (!dateFrom && !dateTo) return true
      const recDate = new Date(recording.lastModified).getTime()
      const from = dateFrom ? new Date(dateFrom).setHours(0, 0, 0, 0) : -Infinity
      const to = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : Infinity
      return recDate >= from && recDate <= to
    })()

    return searchMatch && dateMatch
  })
}

export function sortRecordings(recordings, sortConfig, speechScores) {
  if (!recordings?.length) return []

  const sorted = [...recordings].sort((a, b) => {
    let leftValue
    let rightValue

    if (sortConfig.key === 'filename') {
      leftValue = a.filename.toLowerCase()
      rightValue = b.filename.toLowerCase()
    } else if (sortConfig.key === 'size') {
      leftValue = a.size
      rightValue = b.size
    } else if (sortConfig.key === 'speechScore') {
      leftValue = speechScores.get(a.key)?.score ?? -1
      rightValue = speechScores.get(b.key)?.score ?? -1
    } else {
      leftValue = new Date(a.lastModified).getTime()
      rightValue = new Date(b.lastModified).getTime()
    }

    if (leftValue < rightValue) return -1
    if (leftValue > rightValue) return 1
    return 0
  })

  return sortConfig.direction === 'asc' ? sorted : sorted.reverse()
}

export function formatAudioDuration(seconds) {
  if (!seconds || seconds <= 0) return null
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatRelativeDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return "À l'instant"
  if (diffMin < 60) return `Il y a ${diffMin} min`
  if (diffHour < 24) return `Il y a ${diffHour}h`
  if (diffDay === 1) return 'Hier'
  if (diffDay < 7) return `Il y a ${diffDay} jours`

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function formatDate(value) {
  if (!value) return 'n/a'
  return new Date(value).toLocaleString('fr-FR')
}

export function formatSeconds(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a'
  const totalSeconds = Math.max(0, Math.floor(Number(value)))
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function formatDuration(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a'
  const totalSeconds = Math.max(0, Math.floor(Number(value)))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  return `${minutes}m ${String(totalSeconds % 60).padStart(2, '0')}s`
}

export function formatWait(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a'
  const seconds = Math.max(0, Math.floor(Number(value)))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function formatSize(value) {
  if (!value || Number.isNaN(Number(value))) return 'n/a'
  const bytes = Number(value)
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export function statusVariant(status) {
  if (status === 'FAILED') return 'destructive'
  if (status === 'NEEDS_REVIEW') return 'secondary'
  return 'outline'
}

export function exploitabilityVariant(status) {
  if (status === 'PRIORITY') return 'default'
  if (status === 'REVIEW') return 'secondary'
  if (status === 'LOW_VALUE') return 'outline'
  return 'outline'
}

export function filterEcouteUsers(users, searchTerm, showOnlyOnline, isUserOnlineFn, statusFilter) {
  if (!users) return []
  return users.filter(user => {
    const searchMatch =
      user.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.prenom?.toLowerCase().includes(searchTerm.toLowerCase())

    const onlineMatch = showOnlyOnline ? isUserOnlineFn(user.id, user.userType) : true
    const statusMatch = statusFilter === 'ALL' ? true : user?.status === statusFilter

    return searchMatch && onlineMatch && statusMatch
  })
}
