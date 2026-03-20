import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import {
  Lock,
  Unlock,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Pencil,
  Search,
  Wifi,
  Signal,
  Zap,
  Tablet,
  Filter,
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

const getRelativeTimeColor = value => {
  if (!value) return 'text-muted-foreground'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'text-muted-foreground'
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 1000 / 60)
  if (diffMin < 5) return 'text-chart-2'
  if (diffMin < 60) return 'text-chart-5'
  return 'text-muted-foreground'
}

const batteryBarColor = level => {
  const value = Number(level) || 0
  if (value > 50) return 'bg-chart-2'
  if (value > 20) return 'bg-chart-5'
  return 'bg-destructive'
}

const batteryTextColor = level => {
  const value = Number(level) || 0
  if (value > 50) return 'text-chart-2'
  if (value > 20) return 'text-chart-5'
  return 'text-destructive'
}

const NetworkIcon = ({ networkType }) => {
  const type = (networkType || '').toLowerCase()
  if (type.includes('wifi') || type.includes('wi-fi')) {
    return <Wifi className="h-3.5 w-3.5 shrink-0 text-primary" />
  }
  return <Signal className="h-3.5 w-3.5 shrink-0 text-chart-5" />
}

export default function DevicesTab({
  devices,
  loading,
  deviceFilters,
  setDeviceFilters,
  onCommand,
  onSetCommercial,
  onRename,
  onDelete,
  onSelectDevice,
}) {
  const { getCommercialName } = useDeviceCommercialNames()

  const filteredDevices = useMemo(() => {
    return (devices || []).filter(device => {
      const commercialName = getCommercialName(device) || ''
      const searchText = `${device.deviceName || ''} ${device.deviceId || ''} ${commercialName}`
      const matchesSearch = searchText
        .toLowerCase()
        .includes((deviceFilters.search || '').toLowerCase())
      const matchesOnline =
        deviceFilters.onlineFilter === 'all' ||
        (deviceFilters.onlineFilter === 'online' && device.online) ||
        (deviceFilters.onlineFilter === 'offline' && !device.online)
      const matchesLock =
        deviceFilters.lockFilter === 'all' ||
        (deviceFilters.lockFilter === 'locked' && device.kioskLocked) ||
        (deviceFilters.lockFilter === 'unlocked' && !device.kioskLocked)
      return matchesSearch && matchesOnline && matchesLock
    })
  }, [devices, deviceFilters, getCommercialName])

  const totalCount = (devices || []).length

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            Parc de tablettes
            <Badge
              variant="secondary"
              className="ml-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
            >
              {totalCount}
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center rounded-lg bg-muted/30 p-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Rechercher une tablette..."
              value={deviceFilters.search}
              onChange={event =>
                setDeviceFilters(current => ({ ...current, search: event.target.value }))
              }
              className="pl-8 h-8 bg-background text-sm"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Filter className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
            <Select
              value={deviceFilters.onlineFilter}
              onValueChange={value => setDeviceFilters(current => ({ ...current, onlineFilter: value }))}
            >
              <SelectTrigger className="h-8 w-36 bg-background text-sm">
                <SelectValue placeholder="Connexion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les états</SelectItem>
                <SelectItem value="online">En ligne</SelectItem>
                <SelectItem value="offline">Hors ligne</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={deviceFilters.lockFilter}
              onValueChange={value => setDeviceFilters(current => ({ ...current, lockFilter: value }))}
            >
              <SelectTrigger className="h-8 w-36 bg-background text-sm">
                <SelectValue placeholder="Verrou" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les verrous</SelectItem>
                <SelectItem value="locked">Verrouillé</SelectItem>
                <SelectItem value="unlocked">Déverrouillé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <RefreshCw className="h-8 w-8 animate-spin opacity-40" />
            <span className="text-sm">Chargement des tablettes...</span>
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-muted/50 p-5">
              <Tablet className="h-12 w-12 text-muted-foreground/30" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">Aucune tablette</p>
              <p className="text-sm text-muted-foreground">
                {(deviceFilters.search || deviceFilters.onlineFilter !== 'all' || deviceFilters.lockFilter !== 'all')
                  ? 'Aucun appareil ne correspond aux filtres actifs.'
                  : 'Aucune tablette enregistrée dans ce parc.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Nom</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Commercial</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Modèle</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Android</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Kiosk</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden lg:table-cell">ProWin</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Batterie</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Réseau</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Verrou</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Activité</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.map(device => {
                  const batteryLevel = Number(device.batteryLevel) || 0
                  const commercialName = getCommercialName(device)

                  return (
                    <TableRow
                      key={device.deviceId}
                      className="cursor-pointer transition-colors duration-150 hover:bg-muted/50"
                      onClick={() => onSelectDevice(device)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <span className="relative flex shrink-0">
                            {device.online ? (
                              <>
                                <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-chart-2 opacity-60" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-chart-2" />
                              </>
                            ) : (
                              <span className="inline-flex h-2 w-2 rounded-full bg-muted-foreground/40" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <span className="block font-semibold text-sm leading-tight truncate">
                              {commercialName || device.deviceName || device.deviceId}
                            </span>
                            {commercialName && (
                              <span className="block text-xs text-muted-foreground truncate">
                                {device.deviceName || device.deviceId}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {commercialName ? (
                          <Badge variant="outline">{commercialName}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Non assigné</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                        {device.model || <span className="opacity-40">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                        {device.androidVersion || <span className="opacity-40">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                        {device.kioskVersion || <span className="opacity-40">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                        {device.prowinVersion || <span className="opacity-40">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {device.batteryCharging && (
                            <Zap className="h-3 w-3 text-chart-5 shrink-0" />
                          )}
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${batteryBarColor(batteryLevel)}`}
                                style={{ width: `${Math.min(100, Math.max(0, batteryLevel))}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium tabular-nums ${batteryTextColor(batteryLevel)}`}>
                              {batteryLevel}%
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {device.networkType ? (
                          <div className="flex items-center gap-1.5">
                            <NetworkIcon networkType={device.networkType} />
                            <span className="text-sm text-muted-foreground truncate max-w-24">
                              {device.networkName || device.networkType}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {device.kioskLocked ? (
                          <div className="flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5 text-destructive" />
                            <span className="text-xs text-destructive font-medium">Verrouillé</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Unlock className="h-3.5 w-3.5 text-chart-2" />
                            <span className="text-xs text-chart-2 font-medium">Libre</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className={`text-xs font-medium ${getRelativeTimeColor(device.lastSeen)}`}>
                          {formatRelativeTime(device.lastSeen)}
                        </span>
                      </TableCell>
                      <TableCell onClick={event => event.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => {
                                const commercialName = window.prompt('Nom du commercial', getCommercialName(device) || '')
                                if (commercialName === null) return
                                onSetCommercial({ deviceId: device.deviceId, commercialName: commercialName.trim() })
                              }}
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                              Assigner commercial
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onRename(device)}>
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                              Renommer
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                onCommand(device, {
                                  action: device.kioskLocked ? 'unlock' : 'lock',
                                })
                              }
                            >
                              {device.kioskLocked ? (
                                <Unlock className="h-4 w-4 text-chart-2" />
                              ) : (
                                <Lock className="h-4 w-4 text-destructive" />
                              )}
                              {device.kioskLocked ? 'Déverrouiller' : 'Verrouiller'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                onCommand(device, {
                                  action: 'ota_check',
                                })
                              }
                            >
                              <RefreshCw className="h-4 w-4 text-primary" />
                              Vérifier MAJ
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => onDelete(device)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
  )
}
