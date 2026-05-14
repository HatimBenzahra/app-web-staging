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

export function normalizeTime(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function buildSessionExcerpts(session) {
  if (!session) return []

  const moments = (session.keyMoments || []).map(moment => ({
    id: `moment-${moment.id}`,
    source: 'moment',
    sourceId: moment.id,
    kindLabel: moment.type || 'Moment clé',
    title: moment.title || 'Moment clé',
    summary: moment.summary,
    verbatim: moment.verbatim,
    startTime: normalizeTime(moment.startTime),
    endTime: normalizeTime(moment.endTime),
    score: moment.importance,
    rank: 0,
  }))

  const steps = (session.stepEvaluations || [])
    .filter(step => step.verbatim || (step.startTime !== null && step.startTime !== undefined))
    .map(step => ({
      id: `step-${step.id}`,
      source: 'step',
      sourceId: step.id,
      kindLabel: `Étape ${step.ordre}`,
      title: step.titre,
      summary: step.feedback || step.recommendation,
      verbatim: step.verbatim,
      startTime: normalizeTime(step.startTime),
      endTime: normalizeTime(step.endTime),
      score: step.score,
      status: step.coverageStatus,
      rank: 1,
    }))

  const conversations = (session.conversationEvaluations || []).map(conversation => ({
    id: `conversation-${conversation.id}`,
    source: 'conversation',
    sourceId: conversation.id,
    kindLabel: 'Conversation',
    title: conversation.title || `Conversation ${conversation.ordre}`,
    summary: conversation.summary || conversation.reviewReason,
    verbatim: conversation.readableTranscriptText || conversation.transcriptText,
    startTime: normalizeTime(conversation.startTime),
    endTime: normalizeTime(conversation.endTime),
    score: conversation.overallScore,
    status: conversation.status,
    rank: 2,
  }))

  return [...moments, ...steps, ...conversations].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    const aTime = a.startTime ?? Number.POSITIVE_INFINITY
    const bTime = b.startTime ?? Number.POSITIVE_INFINITY
    return aTime - bTime
  })
}
