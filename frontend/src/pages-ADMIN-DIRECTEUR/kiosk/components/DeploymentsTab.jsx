import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Rocket,
  Clock,
  User,
  Monitor,
  Search,
  ShieldCheck,
  ShieldAlert,
  Wifi,
} from 'lucide-react'
import useDeviceCommercialNames from '../useDeviceCommercialNames'

const formatRelativeTime = value => {
  if (!value) return 'Inconnu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Inconnu'
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `il y a ${days}j`
  if (hours > 0) return `il y a ${hours}h`
  if (minutes > 0) return `il y a ${minutes}min`
  return "à l'instant"
}

const getVersionStatusUI = status => {
  if (status === 'up_to_date')
    return {
      label: 'À jour',
      icon: CheckCircle,
      className: 'bg-chart-2/15 text-chart-2 border-chart-2/30',
    }
  if (status === 'outdated')
    return {
      label: 'Obsolète',
      icon: AlertTriangle,
      className: 'bg-chart-5/20 text-chart-5 border-chart-5/30',
    }
  if (status === 'very_outdated')
    return {
      label: 'Très obsolète',
      icon: XCircle,
      className: 'bg-destructive/15 text-destructive border-destructive/30',
    }
  return {
    label: 'Inconnu',
    icon: HelpCircle,
    className: 'bg-muted text-muted-foreground border-border',
  }
}

const getHistoryStatusUI = status => {
  const normalized = (status || '').toLowerCase()
  if (normalized.includes('success') || normalized.includes('ok'))
    return {
      icon: CheckCircle,
      label: status,
      className: 'bg-chart-2/15 text-chart-2 border-chart-2/30',
    }
  if (normalized.includes('pending') || normalized.includes('progress'))
    return {
      icon: Clock,
      label: status,
      className: 'bg-chart-5/20 text-chart-5 border-chart-5/30',
    }
  if (normalized.includes('error') || normalized.includes('fail'))
    return {
      icon: XCircle,
      label: status,
      className: 'bg-destructive/15 text-destructive border-destructive/30',
    }
  return {
    icon: HelpCircle,
    label: status || '—',
    className: 'bg-muted text-muted-foreground border-border',
  }
}

const getHistoryStatusGroup = status => {
  const normalized = (status || '').toLowerCase()
  if (normalized.includes('success') || normalized.includes('ok')) return 'success'
  if (normalized.includes('pending') || normalized.includes('progress')) return 'pending'
  if (normalized.includes('error') || normalized.includes('fail')) return 'error'
  return 'other'
}

export default function DeploymentsTab({
  versionMatrix,
  deployHistory,
  loading,
  onDeploy,
  deployHistoryFilters,
  setDeployHistoryFilters,
  devices,
  activeTab,
  setActiveTab,
}) {
  const { getCommercialName, getDeviceLabel } = useDeviceCommercialNames()
  const rows = useMemo(() => versionMatrix?.matrix || [], [versionMatrix])
  const historyRows = useMemo(() => deployHistory?.entries || [], [deployHistory])
  const [matrixFilter, setMatrixFilter] = useState('all')
  const [matrixSearch, setMatrixSearch] = useState('')
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all')

  const summary = useMemo(() => {
    let upToDate = 0
    let outdated = 0
    let veryOutdated = 0
    let online = 0

    for (const entry of rows) {
      if (entry.online) online += 1

      const kioskStatus = entry.kiosk?.status
      const prowinStatus = entry.prowin?.status
      if (kioskStatus === 'very_outdated' || prowinStatus === 'very_outdated') {
        veryOutdated += 1
      } else if (kioskStatus === 'outdated' || prowinStatus === 'outdated') {
        outdated += 1
      } else if (kioskStatus === 'up_to_date' && prowinStatus === 'up_to_date') {
        upToDate += 1
      }
    }

    return {
      total: rows.length,
      upToDate,
      outdated,
      veryOutdated,
      needsAttention: outdated + veryOutdated,
      online,
    }
  }, [rows])

  const matrixRows = useMemo(() => {
    const normalizedSearch = matrixSearch.trim().toLowerCase()

    return rows.filter(entry => {
      const kioskStatus = entry.kiosk?.status
      const prowinStatus = entry.prowin?.status
      const derivedStatus =
        kioskStatus === 'very_outdated' || prowinStatus === 'very_outdated'
          ? 'very_outdated'
          : kioskStatus === 'outdated' || prowinStatus === 'outdated'
            ? 'outdated'
            : kioskStatus === 'up_to_date' && prowinStatus === 'up_to_date'
              ? 'up_to_date'
              : 'unknown'

      const passesFilter =
        matrixFilter === 'all'
          ? true
          : matrixFilter === 'attention'
            ? derivedStatus === 'outdated' || derivedStatus === 'very_outdated'
            : matrixFilter === 'offline'
              ? !entry.online
              : derivedStatus === matrixFilter

      if (!passesFilter) return false
      if (!normalizedSearch) return true

      const commercialName =
        getCommercialName({
          serialNumber: entry.deviceId,
          deviceId: entry.deviceId,
        }) || ''

      const haystack = [
        commercialName,
        entry.deviceName || '',
        entry.deviceId || '',
        entry.deviceModel || '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedSearch)
    })
  }, [rows, matrixFilter, matrixSearch, getCommercialName])

  const filteredHistoryRows = useMemo(() => {
    if (historyStatusFilter === 'all') return historyRows
    return historyRows.filter(entry => getHistoryStatusGroup(entry.status) === historyStatusFilter)
  }, [historyRows, historyStatusFilter])

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/60 bg-card/70">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Tablettes
              </span>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{summary.total}</p>
          </CardContent>
        </Card>

        <Card className="border-chart-2/30 bg-chart-2/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-chart-2">À jour</span>
              <ShieldCheck className="h-4 w-4 text-chart-2" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-chart-2">{summary.upToDate}</p>
          </CardContent>
        </Card>

        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-destructive">À corriger</span>
              <ShieldAlert className="h-4 w-4 text-destructive" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-destructive">
              {summary.needsAttention}
            </p>
            <p className="mt-1 text-[11px] text-destructive/80">
              dont {summary.veryOutdated} très obsolète{summary.veryOutdated > 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/25 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-primary">En ligne</span>
              <Wifi className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-primary">{summary.online}</p>
          </CardContent>
        </Card>
      </div>

      <div className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('deploy')}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'deploy'
              ? 'bg-background text-foreground shadow-sm border border-border/60'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
          }`}
        >
          Déployer
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-background text-foreground shadow-sm border border-border/60'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
          }`}
        >
          Historique
        </button>
      </div>

      {activeTab === 'deploy' && (
        <Card className="flex min-w-0 flex-col">
          <CardHeader className="pb-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Matrice des versions</CardTitle>
                <Badge variant="secondary" className="rounded-full tabular-nums text-xs">
                  {matrixRows.length}/{rows.length}
                </Badge>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={matrixSearch}
                  onChange={event => setMatrixSearch(event.target.value)}
                  placeholder="Rechercher tablette..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
            <div
              className="flex items-center gap-1.5 overflow-x-auto pb-1"
              style={{ scrollbarWidth: 'none' }}
            >
              {[
                { id: 'all', label: 'Tous', count: rows.length },
                { id: 'attention', label: 'À corriger', count: summary.needsAttention },
                { id: 'very_outdated', label: 'Très obsolète', count: summary.veryOutdated },
                { id: 'outdated', label: 'Obsolète', count: summary.outdated },
                { id: 'up_to_date', label: 'À jour', count: summary.upToDate },
                {
                  id: 'offline',
                  label: 'Hors ligne',
                  count: Math.max(0, summary.total - summary.online),
                },
              ].map(filter => {
                const active = matrixFilter === filter.id
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setMatrixFilter(filter.id)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border/60 bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    }`}
                  >
                    {filter.label}
                    <span className="ml-1.5 tabular-nums opacity-80">{filter.count}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              État des versions installées sur chaque tablette et actions OTA rapides
            </p>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                <Monitor className="h-8 w-8 animate-pulse opacity-30" />
                <p className="text-sm">Chargement des versions...</p>
              </div>
            ) : !rows.length ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                <Monitor className="h-8 w-8 opacity-30" />
                <p className="text-sm">Aucune donnée de version</p>
              </div>
            ) : !matrixRows.length ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                <Search className="h-8 w-8 opacity-30" />
                <p className="text-sm">Aucune tablette ne correspond à ce filtre</p>
              </div>
            ) : (
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
                <Table className="min-w-[760px]">
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="pl-6 font-semibold">Tablette</TableHead>
                      <TableHead className="font-semibold">Kiosk</TableHead>
                      <TableHead className="font-semibold">ProWin</TableHead>
                      <TableHead className="pr-6 text-right font-semibold">Déployer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matrixRows.map((entry, index) => {
                      const kioskStatus = getVersionStatusUI(entry.kiosk?.status)
                      const prowinStatus = getVersionStatusUI(entry.prowin?.status)
                      const KioskIcon = kioskStatus.icon
                      const ProwinIcon = prowinStatus.icon
                      const commercialName = getCommercialName({
                        serialNumber: entry.deviceId,
                        deviceId: entry.deviceId,
                      })
                      const isOutdated =
                        entry.kiosk?.status !== 'up_to_date' ||
                        entry.prowin?.status !== 'up_to_date'

                      return (
                        <TableRow
                          key={entry.deviceId}
                          className={`transition-colors hover:bg-muted/50 ${
                            index % 2 !== 0 ? 'bg-muted/15' : ''
                          }`}
                        >
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                  entry.online
                                    ? 'bg-chart-2 shadow-sm shadow-chart-2/50'
                                    : 'bg-muted-foreground/30'
                                }`}
                              />
                              <div>
                                <p className="text-sm font-semibold leading-tight">
                                  {commercialName || 'Non assigné'}
                                </p>
                                <p className="text-xs leading-tight text-muted-foreground">
                                  {entry.deviceName || entry.deviceId}
                                </p>
                                {entry.deviceModel && (
                                  <p className="text-xs leading-tight text-muted-foreground">
                                    {entry.deviceModel}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium tabular-nums">
                                {entry.kiosk?.version || '—'}
                              </span>
                              <Badge
                                variant="outline"
                                className={`gap-1 text-xs ${kioskStatus.className}`}
                              >
                                <KioskIcon className="h-3 w-3" />
                                {kioskStatus.label}
                              </Badge>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium tabular-nums">
                                {entry.prowin?.version || '—'}
                              </span>
                              <Badge
                                variant="outline"
                                className={`gap-1 text-xs ${prowinStatus.className}`}
                              >
                                <ProwinIcon className="h-3 w-3" />
                                {prowinStatus.label}
                              </Badge>
                            </div>
                          </TableCell>

                          <TableCell className="pr-6 text-right">
                            <Button
                              size="sm"
                              variant={isOutdated ? 'default' : 'outline'}
                              className="gap-1.5"
                              onClick={() => onDeploy(entry)}
                            >
                              <Rocket className="h-3.5 w-3.5" />
                              Déployer
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'history' && (
        <Card className="flex min-w-0 flex-col">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Historique des déploiements</CardTitle>
                {historyRows.length > 0 && (
                  <Badge variant="secondary" className="rounded-full tabular-nums text-xs">
                    {filteredHistoryRows.length}/{historyRows.length}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select value={historyStatusFilter} onValueChange={setHistoryStatusFilter}>
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous statuts</SelectItem>
                    <SelectItem value="success">Succès</SelectItem>
                    <SelectItem value="pending">En cours</SelectItem>
                    <SelectItem value="error">Erreur</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={deployHistoryFilters.deviceId || 'all'}
                  onValueChange={value =>
                    setDeployHistoryFilters(current => ({ ...current, deviceId: value }))
                  }
                >
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue placeholder="Toutes les tablettes" />
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
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">Lignes</span>
                  <Select
                    value={String(deployHistoryFilters.limit || 20)}
                    onValueChange={value =>
                      setDeployHistoryFilters(current => ({ ...current, limit: Number(value) }))
                    }
                  >
                    <SelectTrigger className="h-8 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20 lignes</SelectItem>
                      <SelectItem value="50">50 lignes</SelectItem>
                      <SelectItem value="100">100 lignes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-0 flex-1 min-h-0">
            {!historyRows.length ? (
              <div className="flex flex-col items-center gap-3 py-14 text-center text-muted-foreground">
                <Clock className="h-8 w-8 opacity-30" />
                <p className="text-sm">Aucun historique de déploiement</p>
              </div>
            ) : !filteredHistoryRows.length ? (
              <div className="flex flex-col items-center gap-3 py-14 text-center text-muted-foreground">
                <Search className="h-8 w-8 opacity-30" />
                <p className="text-sm">Aucun déploiement pour ces filtres</p>
              </div>
            ) : (
              <div
                className="max-h-[calc(100dvh-300px)] overflow-y-auto overflow-x-auto"
                style={{ scrollbarWidth: 'thin' }}
              >
                <Table className="min-w-[980px]">
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="pl-6 font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Tablette</TableHead>
                      <TableHead className="font-semibold">Package</TableHead>
                      <TableHead className="font-semibold">Version</TableHead>
                      <TableHead className="font-semibold">Action</TableHead>
                      <TableHead className="font-semibold">Statut</TableHead>
                      <TableHead className="pr-6 font-semibold">Initié par</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistoryRows.map((entry, index) => {
                      const statusUI = getHistoryStatusUI(entry.status)
                      const StatusIcon = statusUI.icon
                      const commercialName = getCommercialName({
                        serialNumber: entry.deviceId,
                        deviceId: entry.deviceId,
                      })

                      return (
                        <TableRow
                          key={entry.id}
                          className={`transition-colors hover:bg-muted/50 ${
                            index % 2 !== 0 ? 'bg-muted/15' : ''
                          }`}
                        >
                          <TableCell className="pl-6">
                            <span className="text-sm text-muted-foreground">
                              {formatRelativeTime(entry.timestamp)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <span className="text-sm font-medium block">
                                {commercialName || 'Non assigné'}
                              </span>
                              <span className="text-xs text-muted-foreground block">
                                {entry.deviceName || entry.deviceId}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs text-muted-foreground">
                              {entry.packageName || '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm tabular-nums">
                              {entry.versionName || '—'}
                              {entry.versionCode ? (
                                <span className="text-xs text-muted-foreground">
                                  {' '}
                                  ({entry.versionCode})
                                </span>
                              ) : null}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                              {entry.action || '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`gap-1 text-xs ${statusUI.className}`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {statusUI.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="pr-6">
                            <div className="flex items-center gap-1.5">
                              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
                                <User className="h-3 w-3 text-muted-foreground" />
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {entry.initiatedBy || '—'}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
