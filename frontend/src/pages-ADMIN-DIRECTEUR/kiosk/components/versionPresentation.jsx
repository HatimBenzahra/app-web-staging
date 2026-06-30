import React from 'react'
import { Badge } from '@/components/ui/badge'

// Présentation cohérente des versions à travers les onglets Kiosk.
// versionName (semver lisible) + versionCode (entier monotone) côté code.

const CHANNEL_STYLES = {
  prod: 'bg-chart-2/15 text-chart-2 border-chart-2/30',
  staging: 'bg-chart-5/20 text-chart-5 border-chart-5/30',
}

const CHANNEL_LABELS = {
  prod: 'Prod',
  staging: 'Staging',
}

// Affiche `1.1.3 (code 12)` ; tolère les champs manquants.
export function VersionText({ versionName, versionCode, className = '' }) {
  if (!versionName && versionCode == null) {
    return <span className={`text-muted-foreground/40 ${className}`}>—</span>
  }
  return (
    <span className={`tabular-nums ${className}`}>
      {versionName || '—'}
      {versionCode != null && (
        <span className="ml-1 text-xs text-muted-foreground">(code {versionCode})</span>
      )}
    </span>
  )
}

// Badge de canal de diffusion (staging vs prod), visuellement distinct.
export function ChannelBadge({ channel, className = '' }) {
  const normalized = (channel || '').toLowerCase()
  if (!normalized) return null
  const style = CHANNEL_STYLES[normalized] || 'bg-muted text-muted-foreground border-border'
  const label = CHANNEL_LABELS[normalized] || channel
  return (
    <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${style} ${className}`}>
      {label}
    </Badge>
  )
}
