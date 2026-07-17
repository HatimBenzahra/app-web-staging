import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAllZoneHistory } from '@/services'
import { ChevronRight, Loader2, MapPin } from 'lucide-react'
import { formatDateFr } from '@/lib/format-date'

const daysBetween = (from, to) => {
  if (!from || !to) return null
  const d = Math.round((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24))
  return Number.isFinite(d) && d >= 0 ? d : null
}

/**
 * Historique COMPACT des zones passées d'un commercial (aucune carte, pour ne
 * pas alourdir la page). La zone actuelle reste dans « Zones assignées ».
 */
export default function CommercialZoneHistorySection({ commercialId }) {
  const { data: allHistory, loading } = useAllZoneHistory()

  const history = useMemo(() => {
    return (allHistory || [])
      .filter(
        item =>
          item.userId === commercialId &&
          String(item.userType || '').toLowerCase() === 'commercial' &&
          item.unassignedAt // assignations passées uniquement (l'actuelle est ailleurs)
      )
      .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime())
  }, [allHistory, commercialId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Chargement de l'historique des zones...
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="rounded-lg border border-border/40 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
        Aucune zone passée pour ce commercial.
      </div>
    )
  }

  return (
    <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
      {history.map(item => {
        const duree = daysBetween(item.assignedAt, item.unassignedAt)
        return (
          <Link
            key={item.id}
            to={`/zones/${item.zoneId}`}
            className="group flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-border/60 bg-card p-3 transition-colors hover:border-primary/30 hover:bg-muted/40"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate text-sm font-semibold group-hover:text-primary">
                  {item.zone?.nom || `Zone #${item.zoneId}`}
                </span>
              </div>
              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                {formatDateFr(item.assignedAt) ?? '—'} → {formatDateFr(item.unassignedAt) ?? '—'}
                {duree != null && ` · ${duree} j`}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs tabular-nums text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">
                  {item.totalImmeublesProspectes ?? 0}
                </span>{' '}
                imm. prospectés
              </span>
              <span>
                <span className="font-semibold text-foreground">
                  {item.totalContratsSignes ?? 0}
                </span>{' '}
                contrats
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary" />
            </div>
          </Link>
        )
      })}
    </div>
  )
}
