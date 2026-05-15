export {
  exploitabilityVariant,
  formatDate,
  formatDuration,
  formatSeconds,
  formatSize,
  formatWait,
  statusVariant,
} from '@/utils/recordings/recording-utils'

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
