import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil, Archive } from 'lucide-react'
import { getStatusMeta } from '@/constants/domain/user-status'

/**
 * Une personne en card pleine largeur, empilée en liste.
 *
 * Choisie plutôt qu'un tableau : les blocs se replient (`flex-wrap`) au lieu d'imposer
 * un scroll horizontal, et plutôt qu'une grille de petites cards, qui écrasait
 * l'information.
 *
 * Les infos de gamification — palier, rang, points, contrats retenus — viennent de
 * `rankInfo`, issu du snapshot backend via `toRankInfo`, jamais d'un calcul local.
 *
 * Le nom est un `Link` vers la fiche : les specs e2e s'appuient sur
 * `a[href^="/commerciaux/"]`.
 */

function initialsOf(person) {
  const first = (person?.prenom || '').charAt(0)
  const last = (person?.nom || '').charAt(0)
  return `${first}${last}`.toUpperCase() || '?'
}

/** `subtle` : pour une mention textuelle (« Non classé ») plutôt qu'une valeur chiffrée. */
function Stat({ label, value, subtle }) {
  return (
    <div className="min-w-[64px] text-right">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          subtle
            ? 'whitespace-nowrap text-xs font-medium text-muted-foreground'
            : 'text-sm font-semibold tabular-nums'
        }
      >
        {value}
      </p>
    </div>
  )
}

export default function PersonListCard({
  person,
  detailsPath,
  facts = [],
  showRanking = true,
  canEdit,
  onEdit,
  canArchive,
  onArchive,
}) {
  const statusMeta = getStatusMeta(person.status)
  const fullName = `${person.prenom || ''} ${person.nom || ''}`.trim() || `#${person.id}`
  // Une liste fusionnée mêle des rôles dont les fiches vivent sur des routes
  // différentes : la personne peut donc porter son propre chemin.
  const path = person.detailsPath || detailsPath
  const points = person.rankInfo?.points ?? 0
  const contrats = person.contratsRetenus ?? 0
  // Un rang parmi des scores tous nuls ne veut rien dire : on l'affiche seulement
  // quand il y a matière à classer.
  const rank = points > 0 || contrats > 0 ? person.rankInfo?.position : null

  return (
    <Card className="group gap-0 py-0 transition-shadow duration-200 hover:shadow-md">
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
        <div className="flex min-w-[220px] flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold">
            {initialsOf(person)}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                to={`${path}/${person.id}`}
                className="min-w-0 truncate text-sm font-semibold hover:text-primary hover:underline"
              >
                {fullName}
              </Link>
              {person.roleLabel && (
                <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {person.roleLabel}
                </span>
              )}
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusMeta.badgeClass}`}
              >
                {statusMeta.label}
              </span>
            </div>

            {facts.length > 0 && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {facts.map(fact => `${fact.label} ${fact.value || '—'}`).join(' · ')}
              </p>
            )}
          </div>
        </div>

        {showRanking && (
          <div className="flex items-center gap-5">
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${person.rankInfo?.badgeClasses || ''}`}
            >
              {person.rankInfo?.name || '—'}
            </span>
            <Stat label="Rang" value={rank ? `#${rank}` : 'Non classé'} subtle={!rank} />
            <Stat label="Points" value={points} />
            <Stat label="Contrats" value={contrats} />
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="whitespace-nowrap text-[11px] text-muted-foreground">
            {person.lastActivityLabel ? `Vu ${person.lastActivityLabel}` : 'Aucune activité'}
          </span>
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Modifier ${fullName}`}
              onClick={() => onEdit(person)}
              className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {canArchive && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Archiver ${fullName}`}
              title="Archiver (contrat fini)"
              onClick={() => onArchive(person)}
              className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
