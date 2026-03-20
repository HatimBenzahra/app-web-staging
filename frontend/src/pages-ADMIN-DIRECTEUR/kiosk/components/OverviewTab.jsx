import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatsCard } from '@/components/card'
import {
  Activity,
  Tablet,
  Wifi,
  WifiOff,
  BatteryWarning,
  Server,
  Package,
  ChevronRight,
} from 'lucide-react'

const formatRelativeTime = value => {
  if (!value) return 'Inconnu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Inconnu'
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return "A l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffHour < 24) return `il y a ${diffHour} h`
  if (diffDay < 7) return `il y a ${diffDay} j`
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const formatUptime = uptimeSeconds => {
  const total = Math.max(0, Math.floor(Number(uptimeSeconds) || 0))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return `${hours}h ${minutes}m`
}

const getLogBadgeStyle = type => {
  const normalized = (type || '').toLowerCase()
  if (normalized.includes('error')) return 'destructive'
  if (normalized.includes('warn')) return 'outline'
  return 'secondary'
}

export default function OverviewTab({
  health,
  devices,
  recentLogs,
  onlineCount,
  offlineCount,
  lowBatteryCount,
}) {
  const latestVersions = useMemo(() => Object.entries(health?.latestVersions || {}), [health])
  const totalDevices = devices?.length || 0
  const healthOk = health?.status === 'ok'
  const onlineRatio = totalDevices > 0 ? Math.round(((onlineCount || 0) / totalDevices) * 100) : 0
  const healthSummary = healthOk
    ? 'Tous les services OTA repondent normalement'
    : 'Incident OTA detecte'
  const lowBatterySummary =
    lowBatteryCount > 0
      ? `${lowBatteryCount} tablette${lowBatteryCount > 1 ? 's' : ''} a surveiller`
      : 'Aucune alerte batterie'

  return (
    <div className="space-y-5">
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              Sante du serveur OTA
            </span>
            <Badge
              variant={healthOk ? 'secondary' : 'destructive'}
              className={healthOk ? 'bg-chart-2/15 text-chart-2 border-chart-2/30' : ''}
            >
              {healthOk ? 'En ligne' : 'Hors ligne'}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">{healthSummary}</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Uptime</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">
              {formatUptime(health?.uptime)}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Derniere synchro
            </p>
            <p className="mt-1 text-sm font-semibold">{formatRelativeTime(health?.timestamp)}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Releases connues
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums">{health?.totalReleases || 0}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Disponibilite flotte
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums">{onlineRatio}% en ligne</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Total tablettes"
          value={totalDevices}
          variant="primary"
          icon={<Tablet />}
          description="Flotte enregistree"
        />
        <StatsCard
          title="En ligne"
          value={onlineCount || 0}
          variant="success"
          icon={<Wifi />}
          description={`${onlineRatio}% de disponibilite`}
        />
        <StatsCard
          title="Hors ligne"
          value={offlineCount || 0}
          variant="destructive"
          icon={<WifiOff />}
          description="Verification requise"
        />
        <StatsCard
          title="Batterie faible"
          value={lowBatteryCount || 0}
          variant="warning"
          icon={<BatteryWarning />}
          description={lowBatterySummary}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
        <Card className="border-border/60 bg-card/90">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Dernieres versions publiees
              </span>
              <Badge variant="secondary" className="rounded-full tabular-nums text-xs">
                {latestVersions.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestVersions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune version disponible</p>
            ) : (
              <div className="space-y-2">
                {latestVersions.map(([packageName, version]) => (
                  <div
                    key={packageName}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-sm">{version.appName || packageName}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                        {packageName}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">
                        {version.versionName || '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        code {version.versionCode || '-'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/90">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Activite recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLogs?.length ? (
              <div
                className="space-y-2 max-h-[420px] overflow-y-auto pr-1"
                style={{ scrollbarWidth: 'thin' }}
              >
                {recentLogs.map(log => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <Badge variant={getLogBadgeStyle(log.type)} className="text-[10px]">
                        {log.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2">{log.message || 'Sans message'}</p>
                    <div className="mt-1.5 flex items-center justify-end">
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        Details
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune activite recente</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
