import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import GameIcon from '@/components/gamification/GameIcon'

/** Tuile KPI : libellé + valeur + indice, icône Game Icons optionnelle (par `iconName`). */
export function StatTile({ iconName, label, value, hint, valueClassName }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className={`mt-2 text-2xl font-bold tracking-tight ${valueClassName || ''}`}>
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground truncate">{hint}</p>}
        </div>
        {iconName && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/60 text-primary">
            <GameIcon name={iconName} size={20} />
          </div>
        )}
      </div>
    </div>
  )
}

/** Titre de section (point + libellé), aligné sur le style des onglets. */
export function SectionTitle({ children }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="h-2 w-2 rounded-full bg-primary" />
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
    </div>
  )
}

function couvertureBadgeClass(value) {
  if (value >= 80)
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
  if (value >= 50) return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
  return 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300'
}

const BUILDINGS_PER_PAGE = 12

/**
 * Table « Bâtiments prospectés » (5 colonnes, paginée). `onRowClick` optionnel
 * (clic → façade côté commercial ; absent côté manager).
 */
export function BuildingsTable({ rows, onRowClick }) {
  const [page, setPage] = useState(0)

  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">Aucun bâtiment prospecté</p>
    )
  }

  const totalPages = Math.ceil(rows.length / BUILDINGS_PER_PAGE)
  const current = Math.min(page, totalPages - 1)
  const start = current * BUILDINGS_PER_PAGE
  const paged = rows.slice(start, start + BUILDINGS_PER_PAGE)

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adresse</TableHead>
                <TableHead className="text-center">Portes</TableHead>
                <TableHead className="text-center">Couverture</TableHead>
                <TableHead className="text-center">Contrats</TableHead>
                <TableHead className="text-center">RDV</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(row => (
                <TableRow
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                  title={onRowClick ? 'Voir la façade du bâtiment' : undefined}
                >
                  <TableCell className="font-medium">{row.address}</TableCell>
                  <TableCell className="text-center tabular-nums">{row.total_doors}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={couvertureBadgeClass(row.couverture || 0)}>
                      {row.couverture || 0}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-green-100 text-green-800">
                      {row.contrats_signes || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-blue-100 text-blue-800">{row.rdv_pris || 0}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular-nums">
            {start + 1}–{Math.min(start + BUILDINGS_PER_PAGE, rows.length)} sur {rows.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="tabular-nums">
              {current + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={current >= totalPages - 1}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
