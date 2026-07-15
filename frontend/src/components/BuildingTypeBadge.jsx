import { Badge } from '@/components/ui/badge'
import { effectiveTypeHabitat, getHabitatMeta } from '@/constants/domain/habitat'

/**
 * Badge affichant le type de bâtiment (icône Lucide + libellé).
 *
 * Source de rendu UNIQUE du badge de type : réutilisé par la liste admin des
 * immeubles et les tables des pages détail (commercial / manager). Ne PAS
 * dupliquer ce rendu ailleurs.
 *
 * On peut fournir soit un `type` déjà résolu, soit un `immeuble` brut (le type
 * effectif est alors calculé via `effectiveTypeHabitat`).
 *
 * @param {Object} props
 * @param {string} [props.type] - Un TypeHabitat déjà résolu (prioritaire)
 * @param {Object} [props.immeuble] - Bâtiment brut, si `type` n'est pas fourni
 * @param {string} [props.className] - Classes additionnelles (ex. taille du texte)
 * @returns {JSX.Element}
 */
export function BuildingTypeBadge({ type, immeuble, className = '' }) {
  const resolvedType = type ?? effectiveTypeHabitat(immeuble)
  const meta = getHabitatMeta(resolvedType)
  const TypeIcon = meta.Icon

  return (
    <Badge className={`${meta.badgeClasses} gap-1 ${className}`.trim()}>
      <TypeIcon className="h-3 w-3" />
      {meta.label}
    </Badge>
  )
}

export default BuildingTypeBadge
