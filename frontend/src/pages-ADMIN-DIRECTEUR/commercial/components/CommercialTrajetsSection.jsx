import { useMemo, useState } from 'react'
import LocationTab from '@/pages-ADMIN-DIRECTEUR/gps-tracking/components/LocationTab'
import { useGpsRouteByActor } from '@/hooks/metier/api/gps-tracking'

// Presets alignés sur TRAJET_QUICK_FILTERS de LocationTab (today / yesterday / custom)
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
}

/**
 * Trajet GPS d'UN commercial, intégré dans sa page détail. Réutilise la carte
 * riche `LocationTab` en mode `embedded` (acteur verrouillé, pas de sélecteur
 * d'acteur ni de vue Live), avec le sélecteur de jour interne (today/yesterday/
 * date perso).
 */
export default function CommercialTrajetsSection({ commercialId, commercialName }) {
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

  // Acteur unique verrouillé = le commercial. La clé suit le format attendu
  // par LocationTab : `${userType}-${userId}`.
  const actor = useMemo(
    () => ({
      key: `COMMERCIAL-${commercialId}`,
      userId: commercialId,
      userType: 'COMMERCIAL',
      name: commercialName,
    }),
    [commercialId, commercialName]
  )

  const routeQuery = useGpsRouteByActor(commercialId, 'COMMERCIAL', period.from, period.to)

  const routePositions = useMemo(() => {
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
  }, [routeQuery.data])

  return (
    <LocationTab
      embedded
      actors={[actor]}
      loading={false}
      mode="trajet"
      setMode={() => {}}
      selectedActorKey={actor.key}
      setSelectedActorKey={() => {}}
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
  )
}
