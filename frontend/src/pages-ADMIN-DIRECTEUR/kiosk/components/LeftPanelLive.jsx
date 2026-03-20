import { Battery, BatteryLow, BatteryMedium, BatteryFull, ChevronRight } from 'lucide-react'

const getBatteryIcon = level => {
  if (!level || level < 20) return BatteryLow
  if (level < 50) return Battery
  if (level < 80) return BatteryMedium
  return BatteryFull
}

const getBatteryColor = level => {
  if (!level || level < 20) return 'text-destructive'
  if (level < 50) return 'text-chart-5'
  return 'text-chart-2'
}

const formatRelativeTime = value => {
  if (!value) return 'Inconnu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Inconnu'
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMin / 60)
  if (diffMin < 1) return "À l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffHour < 24) return `il y a ${diffHour} h`
  return date.toLocaleDateString('fr-FR')
}

export default function LeftPanelLive({
  devices,
  selectedDeviceId,
  onSelect,
  onViewTrajet,
  getCommercialName,
}) {
  if (!devices.length) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-12 gap-3 text-muted-foreground">
        <p className="text-sm">Aucune position disponible</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
      {devices.map(device => {
        const isSelected = device.deviceId === selectedDeviceId
        const BattIcon = getBatteryIcon(device.batteryLevel)
        const battColor = getBatteryColor(device.batteryLevel)
        const commercialName = getCommercialName(device)

        return (
          <button
            key={device.deviceId}
            type="button"
            onClick={() => onSelect(device)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all border-b border-border/30 hover:bg-muted/30 ${
              isSelected
                ? 'bg-primary/5 border-l-2 border-l-primary'
                : 'border-l-2 border-l-transparent'
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full shrink-0 ${device.online ? 'bg-chart-2' : 'bg-muted-foreground/40'}`}
            />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{commercialName || 'Non assigné'}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {device.deviceName} · {formatRelativeTime(device.lastSeen)}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-1">
                <BattIcon className={`h-3 w-3 ${battColor}`} />
                <span className={`text-[11px] font-medium tabular-nums ${battColor}`}>
                  {device.batteryLevel || 0}%
                </span>
              </div>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  onViewTrajet(device.deviceId)
                }}
                className="text-[10px] text-primary/60 hover:text-primary flex items-center gap-0.5"
              >
                Trajet <ChevronRight className="h-2.5 w-2.5" />
              </button>
            </div>
          </button>
        )
      })}
    </div>
  )
}
