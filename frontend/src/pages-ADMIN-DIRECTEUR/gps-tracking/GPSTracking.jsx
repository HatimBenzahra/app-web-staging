import React, { useMemo, useState } from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useGpsLatestActorPositions, useGpsRouteByActor } from '@/hooks/metier/api/gps-tracking'
import { useActorDirectory } from './useActorDirectory'
import LocationTab from './components/LocationTab'

const PERIOD_PRESETS = {
  today: () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    return { from: start.toISOString(), to: now.toISOString(), label: "Aujourd'hui" }
  },
  yesterday: () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59)
    return { from: start.toISOString(), to: end.toISOString(), label: 'Hier' }
  },
  last6h: () => {
    const now = new Date()
    return {
      from: new Date(now.getTime() - 6 * 3600000).toISOString(),
      to: now.toISOString(),
      label: '6 dernières heures',
    }
  },
  last3h: () => {
    const now = new Date()
    return {
      from: new Date(now.getTime() - 3 * 3600000).toISOString(),
      to: now.toISOString(),
      label: '3 dernières heures',
    }
  },
  last1h: () => {
    const now = new Date()
    return {
      from: new Date(now.getTime() - 3600000).toISOString(),
      to: now.toISOString(),
      label: 'Dernière heure',
    }
  },
  last30m: () => {
    const now = new Date()
    return {
      from: new Date(now.getTime() - 30 * 60000).toISOString(),
      to: now.toISOString(),
      label: '30 dernières minutes',
    }
  },
  morning: () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0)
    return { from: start.toISOString(), to: end.toISOString(), label: 'Ce matin (8h-12h)' }
  },
  afternoon: () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0)
    return { from: start.toISOString(), to: end.toISOString(), label: 'Cet après-midi (12h-18h)' }
  },
}

export default function GPSTracking() {
  const positionsQuery = useGpsLatestActorPositions()
  const { buildActors } = useActorDirectory()

  const [mode, setMode] = useState('live')
  const [selectedActorKey, setSelectedActorKey] = useState(null)
  const [periodKey, setPeriodKey] = useState('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [customFromTime, setCustomFromTime] = useState('00:00')
  const [customToTime, setCustomToTime] = useState('23:59')

  const period = useMemo(() => {
    if (periodKey === 'custom' && customFrom) {
      const fromStr = `${customFrom}T${customFromTime || '00:00'}:00`
      const toStr = customTo
        ? `${customTo}T${customToTime || '23:59'}:59`
        : `${customFrom}T${customToTime || '23:59'}:59`
      return {
        from: new Date(fromStr).toISOString(),
        to: new Date(toStr).toISOString(),
        label: 'Personnalisé',
      }
    }
    return PERIOD_PRESETS[periodKey]?.() || PERIOD_PRESETS.today()
  }, [periodKey, customFrom, customTo, customFromTime, customToTime])

  // Source unique = app mobile (positions actor-keyed). La jointure
  // (userId, userType) -> commercial / manager est centralisée dans
  // useActorDirectory().
  const actors = useMemo(
    () => buildActors(positionsQuery.data ?? []),
    [positionsQuery.data, buildActors]
  )

  const selectedActor = useMemo(() => {
    if (!selectedActorKey) return null
    const found = actors.find(a => a.key === selectedActorKey)
    if (found) return found
    const sep = selectedActorKey.indexOf('-')
    const rawType = selectedActorKey.slice(0, sep)
    const userId = Number(selectedActorKey.slice(sep + 1))
    if (!Number.isFinite(userId)) return null
    return {
      key: selectedActorKey,
      userId,
      userType: rawType === 'MANAGER' ? 'MANAGER' : 'COMMERCIAL',
    }
  }, [selectedActorKey, actors])

  const isTrajet = mode === 'trajet'
  const routeQuery = useGpsRouteByActor(
    isTrajet ? (selectedActor?.userId ?? null) : null,
    isTrajet ? (selectedActor?.userType ?? null) : null,
    isTrajet && selectedActor ? period.from : '',
    isTrajet && selectedActor ? period.to : ''
  )

  // Un seul actor est sélectionné à la fois : on passe directement le trajet
  // (actor-keyed, source mobile) sous forme de tableau chronologique.
  const routePositions = useMemo(() => {
    if (!selectedActorKey) return []
    const positions = (routeQuery.data?.positions ?? []).filter(
      p =>
        typeof p.latitude === 'number' &&
        typeof p.longitude === 'number' &&
        p.recordedAt &&
        !Number.isNaN(new Date(p.recordedAt).getTime())
    )
    return [...positions].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    )
  }, [selectedActorKey, routeQuery.data])

  if (positionsQuery.isLoading) {
    return (
      <div className="flex flex-1 min-h-0 flex-col gap-6 p-6">
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-muted-foreground">Chargement de la localisation...</p>
          </div>
        </div>
      </div>
    )
  }

  if (positionsQuery.error) {
    return (
      <div className="flex flex-1 min-h-0 flex-col gap-6 p-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Localisation</h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Suivi en temps réel et trajets des commerciaux
          </p>
        </div>
        <Card className="border-destructive/30 border-2 border-dashed bg-card/50">
          <CardContent className="flex flex-col items-center gap-5 py-12 px-6">
            <div className="rounded-full p-4 bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="text-center max-w-md space-y-2">
              <h3 className="text-lg font-semibold">Erreur de chargement</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Impossible de récupérer les positions GPS des commerciaux.
              </p>
            </div>
            <Button
              onClick={() => positionsQuery.refetch()}
              variant="outline"
              className="gap-2 mt-2"
            >
              <RefreshCw className="h-4 w-4" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col p-3">
      <div className="flex-1 min-h-0">
        <LocationTab
          actors={actors}
          loading={positionsQuery.isLoading}
          mode={mode}
          setMode={setMode}
          selectedActorKey={selectedActorKey}
          setSelectedActorKey={setSelectedActorKey}
          periodKey={periodKey}
          setPeriodKey={setPeriodKey}
          periodLabel={period.label}
          customFrom={customFrom}
          setCustomFrom={setCustomFrom}
          customTo={customTo}
          setCustomTo={setCustomTo}
          customFromTime={customFromTime}
          setCustomFromTime={setCustomFromTime}
          customToTime={customToTime}
          setCustomToTime={setCustomToTime}
          routePositions={routePositions}
          routeLoading={routeQuery.isLoading}
          routeTotal={routeQuery.data?.positions?.length || 0}
        />
      </div>
    </div>
  )
}
