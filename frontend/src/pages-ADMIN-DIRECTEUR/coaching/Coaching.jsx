import React from 'react'
import { useLocation } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, Bot, RefreshCw } from 'lucide-react'
import { useCoachingLogic } from './useCoachingLogic'
import DashboardView from './components/DashboardView'
import PlansView from './components/PlansView'
import RecordingsView from './components/RecordingsView'
import SessionReviewView from './components/SessionReviewView'
import SessionsView from './components/SessionsView'

export default function Coaching() {
  const logic = useCoachingLogic()
  const location = useLocation()

  const currentSection = React.useMemo(() => {
    if (/\/coaching\/sessions\/\d+/.test(location.pathname)) return 'session-detail'
    if (location.pathname.startsWith('/coaching/recordings')) return 'recordings'
    if (location.pathname.startsWith('/coaching/sessions')) return 'sessions'
    if (location.pathname.startsWith('/coaching/plans')) return 'plans'
    return 'dashboard'
  }, [location.pathname])

  if (logic.loading) {
    return <CoachingLoadingSkeleton />
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      {currentSection !== 'session-detail' ? (
        <div className="mx-auto w-full max-w-[1500px] rounded-lg border border-border/70 bg-card px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Bot className="h-3.5 w-3.5" />
                Directeur · coaching IA
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Coaching IA</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Prioriser les enregistrements, suivre les analyses et valider les rapports
                  terrain.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-start">
              <Button
                type="button"
                variant="outline"
                onClick={logic.refreshAll}
                disabled={logic.submitting}
                className="w-full sm:w-auto"
              >
                <RefreshCw
                  className={['mr-2 h-4 w-4', logic.submitting ? 'animate-spin' : ''].join(' ')}
                />
                Actualiser
              </Button>
            </div>
          </div>

          {logic.error ? (
            <Alert variant="destructive" role="alert" aria-live="polite">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Le module coaching a rencontré une erreur</AlertTitle>
              <AlertDescription>
                {logic.error.message || 'Une erreur est survenue pendant le chargement.'}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}

      {currentSection === 'session-detail' && logic.error ? (
        <Alert
          variant="destructive"
          role="alert"
          aria-live="polite"
          className="mx-auto w-full max-w-[1500px]"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Le module coaching a rencontré une erreur</AlertTitle>
          <AlertDescription>
            {logic.error.message || 'Une erreur est survenue pendant le chargement.'}
          </AlertDescription>
        </Alert>
      ) : null}

      {currentSection === 'dashboard' ? <DashboardView logic={logic} /> : null}
      {currentSection === 'recordings' ? <RecordingsView logic={logic} /> : null}
      {currentSection === 'sessions' ? <SessionsView logic={logic} /> : null}
      {currentSection === 'plans' ? <PlansView logic={logic} /> : null}
      {currentSection === 'session-detail' ? <SessionReviewView logic={logic} /> : null}
    </div>
  )
}

function CoachingLoadingSkeleton() {
  const rows = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5']

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="mx-auto w-full max-w-[1500px] rounded-lg border border-border/70 bg-card px-5 py-5 shadow-sm sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-7 w-48 rounded-full" />
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-4 w-full max-w-2xl" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1500px] rounded-lg border border-border/70 bg-background">
        <div className="space-y-3 border-b border-border/70 p-6">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-full max-w-lg" />
          <div className="grid gap-3 pt-3 lg:grid-cols-4">
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
          </div>
        </div>
        <div className="space-y-3 p-6">
          {rows.map(row => (
            <Skeleton key={row} className="h-12 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  )
}
