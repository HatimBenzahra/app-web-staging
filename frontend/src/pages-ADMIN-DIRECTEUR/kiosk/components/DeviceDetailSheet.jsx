import React, { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Lock,
  Unlock,
  RefreshCw,
  X,
  Battery,
  Signal,
  Globe,
  Wifi,
  Smartphone,
  MapPin,
  Copy,
  Check,
  Zap,
  Clock,
  Terminal,
  Cpu,
  Radio,
  KeyRound,
} from 'lucide-react'
import useDeviceCommercialNames from '../useDeviceCommercialNames'
import DeviceCommandDialog from './DeviceCommandDialog'

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

const batteryFillColor = level => {
  const v = Number(level) || 0
  if (v > 50) return 'bg-chart-2'
  if (v > 20) return 'bg-chart-5'
  return 'bg-destructive'
}

const batteryTextColor = level => {
  const v = Number(level) || 0
  if (v > 50) return 'text-chart-2'
  if (v > 20) return 'text-chart-5'
  return 'text-destructive'
}

const SectionCard = ({ icon: Icon, title, borderColor = 'border-primary', children }) => (
  <div
    className={`rounded-xl border border-border/60 bg-card overflow-hidden shadow-[0_1px_3px_0_rgb(0_0_0/_0.04)]`}
  >
    <div
      className={`flex items-center gap-2.5 px-4 py-3 border-b border-border/40 border-l-2 ${borderColor}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
    </div>
    <div className="p-4">{children}</div>
  </div>
)

const InfoRow = ({ label, value, mono = false }) => (
  <div className="flex items-start justify-between gap-4 py-1.5">
    <span className="text-xs text-muted-foreground shrink-0">{label}</span>
    <span className={`text-xs font-medium text-right break-all ${mono ? 'font-mono' : ''}`}>
      {value || <span className="text-muted-foreground/40">—</span>}
    </span>
  </div>
)

const VersionPill = ({ label, value, code }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-xs text-muted-foreground">{label}</span>
    <div className="flex items-center gap-1.5">
      {value ? (
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          {value}
        </span>
      ) : (
        <span className="text-muted-foreground/40 text-xs">—</span>
      )}
      {code && <span className="text-xs text-muted-foreground/60 font-mono">#{code}</span>}
    </div>
  </div>
)

const SignalBars = ({ strength }) => {
  const level = Math.round((Number(strength) || 0) / 25)
  const clamped = Math.max(0, Math.min(4, level))
  return (
    <div className="flex items-end gap-0.5 h-4">
      {[1, 2, 3, 4].map(bar => (
        <div
          key={bar}
          className={`w-1.5 rounded-sm transition-colors ${bar <= clamped ? 'bg-chart-2' : 'bg-muted'}`}
          style={{ height: `${bar * 25}%` }}
        />
      ))}
    </div>
  )
}

const CopyButton = ({ value }) => {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(String(value))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-chart-2" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

export default function DeviceDetailSheet({ device, open, onClose, onCommand, onRename }) {
  const { getCommercialName } = useDeviceCommercialNames()
  const [commandDialogOpen, setCommandDialogOpen] = useState(false)
  const [commandPending, setCommandPending] = useState(false)
  const batteryLevel = Number(device?.batteryLevel) || 0
  const batteryWidth = Math.min(100, Math.max(0, batteryLevel))
  const pendingCount = device?.pendingCommands?.length || 0
  const commercialName = getCommercialName(device)

  return (
    <Sheet open={open} onOpenChange={state => (!state ? onClose() : null)}>
      <SheetContent side="right" className="sm:max-w-lg w-full p-0 flex flex-col gap-0">
        <SheetHeader className="shrink-0 px-5 pt-5 pb-4 border-b border-border/50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-semibold leading-tight truncate ${
                  commercialName ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {commercialName || 'Aucun commercial assigné'}
              </p>
              <SheetTitle className="text-lg font-bold leading-tight truncate">
                {device?.deviceName || 'Tablette'}
              </SheetTitle>
              {device?.model && (
                <p className="text-xs text-muted-foreground mt-0.5">{device.model}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              {device && (
                <Badge
                  className={
                    device.online
                      ? 'bg-chart-2/15 text-chart-2 border-chart-2/30 text-xs'
                      : 'bg-muted text-muted-foreground text-xs'
                  }
                  variant="outline"
                >
                  <span
                    className={`mr-1.5 inline-flex h-1.5 w-1.5 rounded-full ${
                      device.online ? 'bg-chart-2 animate-pulse' : 'bg-muted-foreground/50'
                    }`}
                  />
                  {device.online ? 'En ligne' : 'Hors ligne'}
                </Badge>
              )}
              {pendingCount > 0 && (
                <Badge variant="secondary" className="text-xs tabular-nums">
                  <Terminal className="h-3 w-3 mr-1" />
                  {pendingCount}
                </Badge>
              )}
            </div>
          </div>

          {device && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {device.batteryCharging && (
                      <Zap className="h-3.5 w-3.5 text-chart-5 animate-pulse" />
                    )}
                    <Battery className="h-3.5 w-3.5 text-muted-foreground" />
                    <span
                      className={`text-sm font-bold tabular-nums ${batteryTextColor(batteryLevel)}`}
                    >
                      {batteryLevel}%
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {device.batteryCharging ? 'En charge' : 'Batterie'}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${batteryFillColor(batteryLevel)}`}
                    style={{ width: `${batteryWidth}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </SheetHeader>

        {!device ? (
          <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground text-sm">
            Aucune tablette sélectionnée
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            <SectionCard icon={Smartphone} title="Identité" borderColor="border-l-primary">
              <InfoRow label="Nom" value={device.deviceName} />
              <InfoRow label="Modèle" value={device.model} />
              <InfoRow label="Constructeur" value={device.manufacturer} />
              <InfoRow label="Numéro de série" value={device.serialNumber} mono />
            </SectionCard>

            <SectionCard icon={Cpu} title="Logiciel" borderColor="border-l-chart-2">
              <VersionPill label="Android" value={device.androidVersion} />
              <VersionPill
                label="Kiosk"
                value={device.kioskVersion}
                code={device.kioskVersionCode}
              />
              <VersionPill
                label="ProWin"
                value={device.prowinVersion}
                code={device.prowinVersionCode}
              />
            </SectionCard>

            <SectionCard icon={Radio} title="Réseau" borderColor="border-l-blue-500">
              <div className="space-y-1">
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-muted-foreground">Signal</span>
                  <div className="flex items-center gap-2">
                    <SignalBars strength={device.signalStrength} />
                    {device.signalStrength != null && (
                      <span className="text-xs font-medium tabular-nums">
                        {device.signalStrength}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-muted-foreground">Type</span>
                  <div className="flex items-center gap-1.5">
                    {(device.networkType || '').toLowerCase().includes('wifi') ? (
                      <Wifi className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Signal className="h-3.5 w-3.5 text-chart-5" />
                    )}
                    <span className="text-xs font-medium">{device.networkType || '—'}</span>
                  </div>
                </div>
                <InfoRow label="Nom réseau" value={device.networkName} />
                <InfoRow label="Sous-type" value={device.networkSubtype} />
                <InfoRow label="Opérateur" value={device.operatorName} />
                <InfoRow label="Adresse IP" value={device.ipAddress} mono />
              </div>
            </SectionCard>

            <SectionCard icon={Globe} title="GPS" borderColor="border-l-destructive">
              {device.latitude == null || device.longitude == null ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="rounded-full bg-muted/50 p-3">
                    <MapPin className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-xs text-muted-foreground">Pas de données GPS disponibles</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-muted-foreground">Latitude</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-medium">
                        {Number(device.latitude).toFixed(6)}
                      </span>
                      <CopyButton value={device.latitude} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-muted-foreground">Longitude</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-medium">
                        {Number(device.longitude).toFixed(6)}
                      </span>
                      <CopyButton value={device.longitude} />
                    </div>
                  </div>
                  {device.locationAccuracy != null && (
                    <InfoRow
                      label="Précision"
                      value={`±${Math.round(device.locationAccuracy)} m`}
                    />
                  )}
                  <div className="mt-2 pt-2 border-t border-border/30">
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          `https://www.google.com/maps?q=${device.latitude},${device.longitude}`,
                          '_blank'
                        )
                      }
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <MapPin className="h-3 w-3" />
                      Voir sur la carte
                    </button>
                  </div>
                </div>
              )}
            </SectionCard>

            <SectionCard icon={Clock} title="Chronologie" borderColor="border-l-chart-5">
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-5 w-5 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Premier contact</p>
                    <p className="text-xs font-medium mt-0.5">{formatDateTime(device.firstSeen)}</p>
                  </div>
                </div>
                <div className="ml-2.5 h-4 w-px bg-border/50" />
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Dernier contact</p>
                    <p className="text-xs font-medium mt-0.5">
                      {formatDateTime(device.lastSeen)}
                      <span className="ml-2 text-muted-foreground/60">
                        ({formatRelativeTime(device.lastSeen)})
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {device && (
          <div className="shrink-0 border-t border-border/50 bg-background px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={device.kioskLocked ? 'outline' : 'destructive'}
                className={
                  device.kioskLocked
                    ? 'border-chart-2/40 text-chart-2 hover:bg-chart-2/10 hover:text-chart-2'
                    : ''
                }
                onClick={() =>
                  onCommand({
                    deviceId: device.deviceId,
                    action: device.kioskLocked ? 'unlock' : 'lock',
                  })
                }
              >
                {device.kioskLocked ? (
                  <Unlock className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                {device.kioskLocked ? 'Déverrouiller' : 'Verrouiller'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCommand({ deviceId: device.deviceId, action: 'ota_check' })}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Vérifier MAJ
              </Button>
              <Button size="sm" variant="outline" onClick={() => onRename(device)}>
                Renommer
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-purple-500/30 text-purple-600 hover:bg-purple-500/10 hover:text-purple-600 dark:text-purple-400 dark:hover:text-purple-400"
                onClick={() => setCommandDialogOpen(true)}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Commandes
              </Button>
              <div className="ml-auto">
                <Button size="sm" variant="ghost" onClick={onClose}>
                  <X className="h-3.5 w-3.5" />
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        )}

        <DeviceCommandDialog
          open={commandDialogOpen}
          onClose={() => setCommandDialogOpen(false)}
          device={device}
          isPending={commandPending}
          onSend={async cmd => {
            setCommandPending(true)
            try {
              await onCommand(cmd)
            } finally {
              setCommandPending(false)
            }
            setCommandDialogOpen(false)
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
