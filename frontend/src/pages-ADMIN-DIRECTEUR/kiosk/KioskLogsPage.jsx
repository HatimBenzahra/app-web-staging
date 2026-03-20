import React, { useMemo, useState } from 'react'
import { RefreshCw, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  useKioskLogs,
  useKioskLogTypes,
  useKioskDevices,
  useKioskClearLogs,
} from '@/hooks/metier/api/kiosk'
import LogsTab from './components/LogsTab'
import KioskErrorState from './components/KioskErrorState'

const formatRefreshTime = timestamp => {
  if (!timestamp) return 'jamais'
  return new Date(timestamp).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function KioskLogsPage() {
  const [logFilters, setLogFilters] = useState({
    deviceId: 'all',
    type: 'all',
    level: 'all',
    from: '',
    to: '',
    limit: 100,
  })

  const normalizedLogFilters = useMemo(
    () => ({
      deviceId: logFilters.deviceId === 'all' ? undefined : logFilters.deviceId,
      type: logFilters.type === 'all' ? undefined : logFilters.type,
      level: logFilters.level === 'all' ? undefined : logFilters.level,
      from: logFilters.from || undefined,
      to: logFilters.to || undefined,
      limit: Number(logFilters.limit) || 100,
    }),
    [logFilters]
  )

  const logsQuery = useKioskLogs(normalizedLogFilters)
  const logTypesQuery = useKioskLogTypes()
  const devicesQuery = useKioskDevices()
  const clearLogsMutation = useKioskClearLogs()

  const total = logsQuery.data?.total || 0

  if (logsQuery.isLoading || logTypesQuery.isLoading || devicesQuery.isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-muted-foreground">Chargement des logs...</p>
          </div>
        </div>
      </div>
    )
  }

  const mainError = logsQuery.error || logTypesQuery.error || devicesQuery.error
  if (mainError) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logs Kiosk</h1>
          <p className="text-muted-foreground mt-1">
            Supervision en direct des événements et incidents de la flotte
          </p>
        </div>
        <KioskErrorState
          error={mainError}
          onRetry={() => {
            logsQuery.refetch()
            logTypesQuery.refetch()
            devicesQuery.refetch()
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Logs Kiosk</h1>
            <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs tabular-nums">
              {total}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Supervision en direct des événements et incidents de la flotte
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Circle
              className={`h-2.5 w-2.5 fill-current ${logsQuery.isFetching ? 'animate-pulse text-chart-2' : 'text-muted-foreground/60'}`}
            />
            <span>
              {logsQuery.isFetching ? 'Actualisation automatique en cours' : 'Auto-refresh actif'}
            </span>
            <span>•</span>
            <span>Dernière mise à jour : {formatRefreshTime(logsQuery.dataUpdatedAt)}</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="gap-2"
          onClick={() => logsQuery.refetch()}
          disabled={logsQuery.isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${logsQuery.isFetching ? 'animate-spin' : ''}`} />
          Rafraîchir
        </Button>
      </div>

      <LogsTab
        logs={logsQuery.data}
        logTypes={logTypesQuery.data || []}
        loading={logsQuery.isLoading}
        filters={logFilters}
        setFilters={setLogFilters}
        onClearLogs={() => clearLogsMutation.mutate()}
        devices={devicesQuery.data || []}
        isFetching={logsQuery.isFetching}
        onRefresh={() => logsQuery.refetch()}
        lastUpdatedAt={logsQuery.dataUpdatedAt}
      />
    </div>
  )
}
