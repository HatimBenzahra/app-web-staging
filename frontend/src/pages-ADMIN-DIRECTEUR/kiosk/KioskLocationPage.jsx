import React, { useState, useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { useKioskDevices } from '@/hooks/metier/api/kiosk'
import { useGpsAllPositions, useGpsDevices } from '@/hooks/metier/api/gps-tracking'
import useDeviceCommercialNames from './useDeviceCommercialNames'
import LocationTab from './components/LocationTab'
import KioskErrorState from './components/KioskErrorState'

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

export default function KioskLocationPage() {
  const devicesQuery = useKioskDevices()
  const gpsDevicesQuery = useGpsDevices()
  const { getCommercialName } = useDeviceCommercialNames()

  const [mode, setMode] = useState('live')
  const [selectedDeviceId, setSelectedDeviceId] = useState(null)
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

  const selectedDevice = useMemo(
    () =>
      (devicesQuery.data || []).find(
        d => d.deviceId === selectedDeviceId || d.serialNumber === selectedDeviceId
      ) || null,
    [devicesQuery.data, selectedDeviceId]
  )

  const routeDeviceKey = selectedDeviceId
    ? selectedDevice?.serialNumber || selectedDeviceId
    : undefined

  const allPositionsQuery = useGpsAllPositions(
    mode === 'trajet' ? period.from : '',
    mode === 'trajet' ? period.to : '',
    routeDeviceKey || undefined
  )

  const routePositionsByDevice = useMemo(() => {
    const positions = allPositionsQuery.data?.positions || []
    const valid = positions.filter(
      p => typeof p.latitude === 'number' && typeof p.longitude === 'number'
    )
    const grouped = new Map()
    for (const p of valid) {
      if (!grouped.has(p.deviceId)) {
        grouped.set(p.deviceId, [])
      }
      grouped.get(p.deviceId).push(p)
    }
    return grouped
  }, [allPositionsQuery.data])

  const allDevicesForFilter = useMemo(() => {
    const kioskDevices = (devicesQuery.data || [])
      .filter(d => d.latitude !== null && d.longitude !== null)
      .map(d => ({
        deviceId: d.deviceId,
        serialNumber: d.serialNumber,
        deviceName: d.deviceName || d.deviceId,
      }))
    const gpsDevices = (gpsDevicesQuery.data || []).map(d => ({
      deviceId: d.deviceId,
      serialNumber: d.deviceId,
      deviceName: d.deviceName || d.deviceId,
    }))
    const merged = new Map()
    for (const d of kioskDevices) {
      merged.set(d.serialNumber || d.deviceId, d)
    }
    for (const d of gpsDevices) {
      if (!merged.has(d.deviceId)) {
        merged.set(d.deviceId, d)
      }
    }
    return Array.from(merged.values())
  }, [devicesQuery.data, gpsDevicesQuery.data])

  if (devicesQuery.isLoading) {
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

  if (devicesQuery.error) {
    return (
      <div className="flex flex-1 min-h-0 flex-col gap-6 p-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Localisation</h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Suivi en temps réel et trajets des commerciaux
          </p>
        </div>
        <KioskErrorState error={devicesQuery.error} onRetry={() => devicesQuery.refetch()} />
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col p-3">
      <div className="flex-1 min-h-0">
        <LocationTab
          devices={devicesQuery.data || []}
          loading={devicesQuery.isLoading}
          mode={mode}
          setMode={setMode}
          selectedDeviceId={selectedDeviceId}
          setSelectedDeviceId={setSelectedDeviceId}
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
          routePositionsByDevice={routePositionsByDevice}
          routeLoading={allPositionsQuery.isLoading}
          routeTotal={allPositionsQuery.data?.total || 0}
          allDevicesForFilter={allDevicesForFilter}
          getCommercialName={getCommercialName}
        />
      </div>
    </div>
  )
}
