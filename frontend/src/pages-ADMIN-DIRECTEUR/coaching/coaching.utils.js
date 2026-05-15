import { QUEUE_LABELS } from './coaching.constants'

export {
  exploitabilityVariant,
  formatDate,
  formatDuration,
  formatSeconds,
  formatSize,
  formatWait,
  statusVariant,
} from '@/utils/recordings/recording-utils'

export function getRecordingAnalysisStatus(recording, logic) {
  if (logic?.launchingRecordingKeys?.has(recording.key)) {
    return {
      kind: 'launching',
      label: 'Lancement...',
      hint: 'La demande est envoyée',
      canLaunch: false,
    }
  }

  if (recording.analysisJobStatus === 'QUEUED' || recording.latestSessionStatus === 'PENDING') {
    return {
      kind: 'queued',
      label: 'En attente',
      hint: 'Analyse programmée',
      canLaunch: false,
    }
  }

  if (
    recording.analysisJobStatus === 'PROCESSING' ||
    recording.latestSessionStatus === 'PROCESSING'
  ) {
    return {
      kind: 'processing',
      label: 'Analyse en cours',
      hint: 'Le rapport se prépare',
      canLaunch: false,
    }
  }

  if (recording.latestSessionStatus === 'COMPLETED') {
    return {
      kind: 'done',
      label: 'Déjà analysé',
      hint: 'Fiche disponible',
      canLaunch: false,
    }
  }

  if (recording.analysisJobStatus && recording.analysisJobStatus !== 'FAILED') {
    return {
      kind: 'locked',
      label: QUEUE_LABELS[recording.analysisJobStatus] || recording.analysisJobStatus,
      hint: 'Analyse déjà lancée',
      canLaunch: false,
    }
  }

  return {
    kind: 'ready',
    label: 'Prêt',
    hint: '',
    canLaunch: true,
  }
}

export function normalizeTime(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function numberOrZero(value) {
  return value === null || value === undefined || value === '' ? 0 : value
}

export function formatScoreValue(value) {
  return `${numberOrZero(value)}/100`
}

export function badgeToneClass(tone = 'neutral') {
  const tones = {
    primary: 'border-primary/30 bg-primary/10 text-primary',
    accent: 'border-accent/35 bg-accent/15 text-accent-foreground',
    success: 'border-chart-2/35 bg-chart-2/12 text-foreground',
    warning: 'border-chart-5/35 bg-chart-5/12 text-foreground',
    danger: 'border-destructive/35 bg-destructive/10 text-destructive',
    neutral: 'border-border/70 bg-muted/35 text-foreground',
  }
  return tones[tone] || tones.neutral
}

export function statusTone(status) {
  if (
    ['COMPLETED', 'VALIDATED', 'NOT_REQUIRED', 'PUBLISHED', 'ACTIVE', 'ALREADY_ANALYZED'].includes(
      status
    )
  ) {
    return 'success'
  }
  if (['QUEUED', 'PENDING', 'PROCESSING', 'NEEDS_REVIEW', 'REVIEW', 'PARTIAL'].includes(status)) {
    return 'warning'
  }
  if (['FAILED', 'REJECTED', 'CANCELLED'].includes(status)) {
    return 'danger'
  }
  if (['PRIORITY', 'GOOD', 'READY', 'COVERED', 'moment'].includes(status)) return 'primary'
  if (['conversation', 'step'].includes(status)) return 'accent'
  return 'neutral'
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
