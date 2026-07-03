import { Battery, BatteryLow, BatteryMedium, BatteryFull, BatteryWarning } from 'lucide-react'

// Le kiosk renvoie batteryLevel = -1 quand le niveau est inconnu
// (cf. DeviceReporter.kt : `if (level > 0 && scale > 0) ... else -1`).
// null/undefined = pas encore remonté. Dans les deux cas → « inconnu », à ne PAS
// afficher comme 0 % ni -1 %.
export const isBatteryKnown = level => Number.isFinite(Number(level)) && Number(level) >= 0

export const clampBattery = level => Math.min(100, Math.max(0, Number(level) || 0))

// Libellé affichable : « 72 % » ou « — » si inconnu.
export const formatBattery = level => (isBatteryKnown(level) ? `${clampBattery(level)} %` : '—')

export const getBatteryIcon = level => {
  if (!isBatteryKnown(level)) return BatteryWarning
  const lvl = clampBattery(level)
  if (lvl < 20) return BatteryLow
  if (lvl < 50) return Battery
  if (lvl < 80) return BatteryMedium
  return BatteryFull
}

export const getBatteryColor = level => {
  if (!isBatteryKnown(level)) return 'text-muted-foreground/50'
  const lvl = clampBattery(level)
  if (lvl < 20) return 'text-destructive'
  if (lvl < 50) return 'text-chart-5'
  return 'text-chart-2'
}

export const getBatteryHexColor = level => {
  if (!isBatteryKnown(level)) return '#9ca3af'
  const lvl = clampBattery(level)
  if (lvl < 20) return '#ef4444'
  if (lvl < 50) return '#f97316'
  return '#22c55e'
}
