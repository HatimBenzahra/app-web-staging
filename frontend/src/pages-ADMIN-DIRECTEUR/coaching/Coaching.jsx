import React from 'react'
import { useLocation } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, Bot, Loader2, RefreshCw } from 'lucide-react'
import { useCoachingLogic } from './useCoachingLogic'
import DashboardView from './components/DashboardView'
import PlansView from './components/PlansView'
import RecordingsView from './components/RecordingsView'
import SessionReviewView from './components/SessionReviewView'
import SessionsView from './components/SessionsView'
import { SectionNav } from './components/CoachingShared'

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
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Chargement du module coaching...
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Bot className="h-3.5 w-3.5" />
              Espace coaching directeur
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Coaching IA</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                Une navigation claire par usage: prioriser les bons enregistrements, piloter la
                queue, relire les analyses, et faire évoluer les plans sans tout mélanger.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {currentSection !== 'plans' ? (
              <div className="min-w-72">
                <Label htmlFor="plan-version-select">
                  Version publiée utilisée pour les analyses
                </Label>
                <Select
                  value={logic.selectedPlanVersionId}
                  onValueChange={logic.setSelectedPlanVersionId}
                >
                  <SelectTrigger id="plan-version-select" className="mt-2">
                    <SelectValue placeholder="Choisir une version publiée" />
                  </SelectTrigger>
                  <SelectContent>
                    {logic.publishedVersions.map(version => (
                      <SelectItem key={version.id} value={String(version.id)}>
                        {version.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <Button
              type="button"
              variant="outline"
              onClick={logic.refreshAll}
              disabled={logic.submitting}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
          </div>
        </div>

        {logic.error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Le module coaching a rencontré une erreur</AlertTitle>
            <AlertDescription>
              {logic.error.message || 'Une erreur est survenue pendant le chargement.'}
            </AlertDescription>
          </Alert>
        ) : null}

        {currentSection !== 'session-detail' ? (
          <SectionNav currentSection={currentSection} />
        ) : null}
      </div>

      {currentSection === 'dashboard' ? <DashboardView logic={logic} /> : null}
      {currentSection === 'recordings' ? <RecordingsView logic={logic} /> : null}
      {currentSection === 'sessions' ? <SessionsView logic={logic} /> : null}
      {currentSection === 'plans' ? <PlansView logic={logic} /> : null}
      {currentSection === 'session-detail' ? <SessionReviewView logic={logic} /> : null}
    </div>
  )
}
