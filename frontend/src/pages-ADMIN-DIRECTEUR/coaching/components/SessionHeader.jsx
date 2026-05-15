import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { CompactScore, ToneBadge } from './CoachingShared'
import { REVIEW_LABELS, STATUS_LABELS } from '../coaching.constants'
import { formatDate } from '../coaching.utils'

/**
 * Top header card for the session review page. Hosts the navigation, refresh
 * button, session identity and the four headline scores.
 *
 * @param {Object} props
 * @param {Object} props.session
 * @param {() => void} props.onRefresh
 * @param {boolean} props.submitting
 */
function SessionHeader({ session, onRefresh, submitting }) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-5 py-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to="/coaching/sessions">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux analyses
              </Link>
            </Button>
            <Button type="button" variant="outline" onClick={onRefresh} disabled={submitting}>
              <RefreshCw className={['mr-2 h-4 w-4', submitting ? 'animate-spin' : ''].join(' ')} />
              Actualiser
            </Button>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">Analyse #{session.id}</h2>
              <ToneBadge status={session.status}>
                {STATUS_LABELS[session.status] || session.status}
              </ToneBadge>
              <ToneBadge status={session.reviewStatus}>
                {REVIEW_LABELS[session.reviewStatus] || session.reviewStatus}
              </ToneBadge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {session.commercialNom || 'Commercial inconnu'} ·{' '}
              {session.salesPlanNom || 'Plan non trouvé'} ·{' '}
              {formatDate(session.processedAt || session.launchedAt)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[520px]">
          <CompactScore label="Global" value={session.overallScore} strong tone="primary" />
          <CompactScore label="Plan" value={session.planCoverageScore} tone="accent" />
          <CompactScore label="Exécution" value={session.executionQualityScore} tone="success" />
          <CompactScore label="Closing" value={session.closingScore} tone="warning" />
        </div>
      </div>
    </div>
  )
}

export default React.memo(SessionHeader)
