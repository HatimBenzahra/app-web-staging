import React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle, Bot, Clock, Loader2 } from 'lucide-react'

/**
 * Computes the in-flight treatment state shown above the session detail.
 * Returns `{ active: false }` when nothing should be displayed.
 *
 * @param {Object} session
 */
function getSessionDetailTreatment(session) {
  const jobStatus = session?.analysisJob?.status

  if (!session || session.status === 'COMPLETED' || session.status === 'NEEDS_REVIEW') {
    return { active: false, kind: 'done', title: '', description: '' }
  }

  if (jobStatus === 'QUEUED' || session.status === 'PENDING') {
    return {
      active: true,
      kind: 'queued',
      title: 'Analyse en attente',
      description:
        'La demande est bien lancée. Le rapport apparaîtra ici dès que le traitement commence.',
    }
  }

  if (jobStatus === 'PROCESSING' || session.status === 'PROCESSING') {
    return {
      active: true,
      kind: 'processing',
      title: 'Analyse en cours',
      description: session.analysisJob?.currentStep
        ? `Étape en cours: ${session.analysisJob.currentStep}.`
        : 'Le rapport est en train de se préparer. Les scores et les extraits vont arriver progressivement.',
    }
  }

  return { active: false, kind: 'done', title: '', description: '' }
}

/**
 * Stack of contextual alerts for a session (review reason, treatment in flight,
 * failure reason). Nothing renders when no alert applies.
 *
 * @param {Object} props
 * @param {Object} props.session
 */
function SessionAlerts({ session }) {
  const treatment = getSessionDetailTreatment(session)

  return (
    <div className="space-y-3" aria-live="polite">
      {session.reviewReason ? (
        <Alert className="border-chart-5/30 bg-chart-5/10">
          <Bot className="h-4 w-4" />
          <AlertTitle>Validation humaine requise</AlertTitle>
          <AlertDescription>{session.reviewReason}</AlertDescription>
        </Alert>
      ) : null}

      {treatment.active ? (
        <Alert className="border-accent/35 bg-accent/10">
          {treatment.kind === 'queued' ? (
            <Clock className="h-4 w-4" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          <AlertTitle>{treatment.title}</AlertTitle>
          <AlertDescription>{treatment.description}</AlertDescription>
        </Alert>
      ) : null}

      {session.failureReason ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Le pipeline a échoué</AlertTitle>
          <AlertDescription>{session.failureReason}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}

export default React.memo(SessionAlerts)
