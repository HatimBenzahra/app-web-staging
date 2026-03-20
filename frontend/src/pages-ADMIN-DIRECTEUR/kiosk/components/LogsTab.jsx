import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  Trash2,
  ScrollText,
  ChevronDown,
  ChevronUp,
  Tablet,
  Calendar,
  AlertOctagon,
  TerminalSquare,
  RefreshCw,
  Pause,
  Play,
} from 'lucide-react'
import useDeviceCommercialNames from '../useDeviceCommercialNames'

const formatRelativeTime = value => {
  if (!value) return 'Inconnu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Inconnu'
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  if (diffSec < 60) return "À l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffHour < 24) return `il y a ${diffHour} h`
  if (diffDay < 7) return `il y a ${diffDay} j`
  return date.toLocaleDateString('fr-FR')
}

const formatDateTime = value => {
  if (!value) return 'Inconnu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Inconnu'
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatRefreshTime = value => {
  if (!value) return 'jamais'
  return new Date(value).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const getLogTypeConfig = type => {
  const normalized = (type || '').toLowerCase()
  if (normalized.includes('error')) {
    return {
      dot: 'bg-destructive',
      tag: 'text-destructive border-destructive/40 bg-destructive/10',
    }
  }
  if (normalized.includes('warn')) {
    return {
      dot: 'bg-chart-5',
      tag: 'text-chart-5 border-chart-5/40 bg-chart-5/10',
    }
  }
  if (normalized.includes('heartbeat')) {
    return {
      dot: 'bg-muted-foreground/50',
      tag: 'text-muted-foreground border-border/70 bg-muted/40',
    }
  }
  if (normalized.includes('update')) {
    return {
      dot: 'bg-chart-2',
      tag: 'text-chart-2 border-chart-2/40 bg-chart-2/10',
    }
  }
  return {
    dot: 'bg-primary',
    tag: 'text-primary border-primary/40 bg-primary/10',
  }
}

const getLevelConfig = level => {
  const normalized = (level || '').toLowerCase()
  if (normalized === 'error') return { dot: 'bg-destructive', label: 'error' }
  if (normalized === 'warn') return { dot: 'bg-chart-5', label: 'warn' }
  return { dot: 'bg-chart-2', label: 'info' }
}

const getSeverityFromLog = log => {
  const level = (log?.level || '').toLowerCase()
  if (level === 'error') return 'error'
  if (level === 'warn' || level === 'warning') return 'warn'

  const type = (log?.type || '').toLowerCase()
  if (type.includes('error')) return 'error'
  if (type.includes('warn')) return 'warn'
  return 'info'
}

const getSeverityStyle = severity => {
  if (severity === 'error') {
    return {
      row: 'border-destructive/40',
      badge: 'text-destructive border border-destructive/40 bg-destructive/10',
    }
  }
  if (severity === 'warn') {
    return {
      row: 'border-chart-5/40',
      badge: 'text-chart-5 border border-chart-5/40 bg-chart-5/10',
    }
  }
  return {
    row: 'border-chart-2/35',
    badge: 'text-chart-2 border border-chart-2/40 bg-chart-2/10',
  }
}

export default function LogsTab({
  logs,
  logTypes,
  loading,
  filters,
  setFilters,
  onClearLogs,
  devices,
  isFetching = false,
  onRefresh,
  lastUpdatedAt,
}) {
  const { getCommercialName, getDeviceLabel } = useDeviceCommercialNames()
  const rows = useMemo(() => logs?.logs || [], [logs])
  const total = logs?.total || 0
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const terminalRef = useRef(null)

  const terminalRows = useMemo(
    () =>
      [...rows].sort(
        (left, right) =>
          new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime()
      ),
    [rows]
  )

  useEffect(() => {
    if (!autoScroll || !terminalRef.current || !terminalRows.length) return
    terminalRef.current.scrollTop = 0
  }, [terminalRows, autoScroll])

  const toggleRow = key => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleClearConfirm = () => {
    onClearLogs()
    setShowClearConfirm(false)
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Flux terminal</h2>
            <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold px-2.5 py-0.5 min-w-[2rem]">
              {total}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={onRefresh}
                disabled={isFetching}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                Sync
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setAutoScroll(current => !current)}
            >
              {autoScroll ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {autoScroll ? 'Pause scroll' : 'Auto scroll'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive gap-1.5"
              onClick={() => setShowClearConfirm(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Effacer
            </Button>
          </div>
        </div>

        {showClearConfirm && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            <AlertOctagon className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-sm text-destructive font-medium flex-1">
              Êtes-vous sûr ? Cette action est irréversible.
            </span>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs px-3"
              onClick={handleClearConfirm}
            >
              Confirmer
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-3"
              onClick={() => setShowClearConfirm(false)}
            >
              Annuler
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 border border-border/40 px-3 py-2.5">
          <div className="relative flex items-center min-w-[160px]">
            <Tablet className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Select
              value={filters.deviceId || 'all'}
              onValueChange={value => setFilters(current => ({ ...current, deviceId: value }))}
            >
              <SelectTrigger className="pl-8 h-8 text-xs bg-background border-border/60 min-w-[160px]">
                <SelectValue placeholder="Tablette" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les tablettes</SelectItem>
                {(devices || []).map(device => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {getDeviceLabel(device)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Select
            value={filters.type || 'all'}
            onValueChange={value => setFilters(current => ({ ...current, type: value }))}
          >
            <SelectTrigger className="h-8 text-xs bg-background border-border/60 min-w-[130px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {(logTypes || []).map(type => {
                const config = getLogTypeConfig(type)
                return (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${config.dot} shrink-0`} />
                      {type}
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>

          <Select
            value={filters.level || 'all'}
            onValueChange={value => setFilters(current => ({ ...current, level: value }))}
          >
            <SelectTrigger className="h-8 text-xs bg-background border-border/60 min-w-[110px]">
              <SelectValue placeholder="Niveau" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les niveaux</SelectItem>
              {['info', 'warn', 'error'].map(level => {
                const cfg = getLevelConfig(level)
                return (
                  <SelectItem key={level} value={level}>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${cfg.dot} shrink-0`} />
                      {level}
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Du</span>
            <Input
              type="date"
              value={filters.from || ''}
              onChange={event => setFilters(current => ({ ...current, from: event.target.value }))}
              className="h-8 text-xs bg-background border-border/60 w-[130px]"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Au</span>
            <Input
              type="date"
              value={filters.to || ''}
              onChange={event => setFilters(current => ({ ...current, to: event.target.value }))}
              className="h-8 text-xs bg-background border-border/60 w-[130px]"
            />
          </div>

          <Select
            value={String(filters.limit || 100)}
            onValueChange={value => setFilters(current => ({ ...current, limit: Number(value) }))}
          >
            <SelectTrigger className="h-8 text-xs bg-background border-border/60 w-[80px]">
              <SelectValue placeholder="Limite" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
              <SelectItem value="500">500</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <span className="text-sm">Chargement des logs...</span>
          </div>
        ) : !terminalRows.length ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <ScrollText className="h-14 w-14 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">Aucun log</p>
            <p className="text-xs text-muted-foreground/60">
              Les événements des tablettes apparaîtront ici
            </p>
          </div>
        ) : (
          <div className="border-t border-border/40">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 bg-muted/40 text-muted-foreground">
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <TerminalSquare className="h-3.5 w-3.5 text-primary" />
                <span>stream://kiosk/logs</span>
              </div>
              <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-2">
                <span>{terminalRows.length} lignes</span>
                <span>•</span>
                <span>{isFetching ? 'sync...' : `MAJ ${formatRefreshTime(lastUpdatedAt)}`}</span>
              </div>
            </div>

            <div
              ref={terminalRef}
              className="h-[calc(100dvh-300px)] min-h-[420px] max-h-[760px] overflow-y-auto bg-muted/20 px-2 py-2 space-y-1.5 font-mono"
              style={{ scrollbarWidth: 'thin' }}
            >
              {terminalRows.map((log, index) => {
                const rowKey = log.id || `${log.timestamp || 'na'}-${log.deviceId || 'na'}-${index}`
                const typeConfig = getLogTypeConfig(log.type)
                const levelConfig = getLevelConfig(log.level)
                const severity = getSeverityFromLog(log)
                const severityStyle = getSeverityStyle(severity)
                const isExpanded = expandedRows.has(rowKey)
                const hasExtra = (log.message?.length || 0) > 160 || Boolean(log.data)
                const commercial = getCommercialName({
                  serialNumber: log.deviceId,
                  deviceId: log.deviceId,
                })
                const deviceLabel = commercial || log.deviceName || log.deviceId || '-'

                return (
                  <div
                    key={rowKey}
                    className={`rounded-md border ${severityStyle.row} bg-background/90 transition-colors hover:bg-muted/30`}
                  >
                    <button
                      type="button"
                      disabled={!hasExtra}
                      onClick={() => hasExtra && toggleRow(rowKey)}
                      className={`w-full px-2.5 py-2 text-left ${hasExtra ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 rounded-full ${levelConfig.dot} shrink-0`}
                        />
                        <span className="text-[10px] font-medium tabular-nums text-muted-foreground shrink-0">
                          {formatDateTime(log.timestamp)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/80 shrink-0 hidden lg:inline">
                          {formatRelativeTime(log.timestamp)}
                        </span>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${severityStyle.badge}`}
                        >
                          {severity}
                        </span>
                        <span
                          className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${typeConfig.tag}`}
                        >
                          {log.type || '-'}
                        </span>
                        <span
                          className="shrink-0 max-w-[180px] truncate text-[11px] text-primary"
                          title={deviceLabel}
                        >
                          {deviceLabel}
                        </span>
                        <span
                          className={`min-w-0 flex-1 text-[12px] text-foreground leading-relaxed ${
                            isExpanded ? 'whitespace-pre-wrap break-words' : 'truncate'
                          }`}
                          title={log.message || '-'}
                        >
                          {log.message || '-'}
                        </span>
                        {hasExtra && (
                          <span className="shrink-0 mt-0.5 text-muted-foreground/70">
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </span>
                        )}
                      </div>
                    </button>

                    {isExpanded && log.data && (
                      <div className="px-2.5 pb-2.5">
                        <div className="rounded-md border border-border/60 bg-muted/35 p-2.5">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            payload
                          </p>
                          <pre className="text-[11px] font-mono text-foreground leading-relaxed whitespace-pre-wrap break-all">
                            {typeof log.data === 'string'
                              ? log.data
                              : JSON.stringify(log.data, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
