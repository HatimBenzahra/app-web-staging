/**
 * Fichier centralisé pour la lecture visuelle de la DURÉE d'un enregistrement porte (Frontend)
 *
 * Objectif produit : la durée d'un audio est un signal. Un audio long est
 * *susceptible d'être intéressant* (vraie conversation à la porte), un audio
 * court ou absent l'est peu. Ces tranches permettent de filtrer/repérer
 * visuellement les enregistrements à écouter en priorité.
 *
 * Réutilisé par : le tableau des portes et le plan du bâtiment
 * (pages-ADMIN-DIRECTEUR/immeubles) — garder une seule source de vérité pour
 * les seuils et les couleurs.
 */

/**
 * Tranches de durée, du plus court (peu intéressant) au plus long (intéressant).
 * `min` en secondes, borne inférieure incluse. `signal` = potentiellement à écouter.
 */
export const DurationTier = {
  NONE: 'none',
  SHORT: 'short',
  BRIEF: 'brief',
  MEDIUM: 'medium',
  LONG: 'long',
}

// Rampe d'INTENSITÉ monochrome basée uniquement sur les tokens du design
// system (primary / muted / muted-foreground) → cohérent en thème clair ET
// sombre, sans couleur en dur. Plus l'audio est long (signal fort), plus le
// badge est rempli/marqué ; l'absence d'audio reste neutre (muted).
const TIER_CONFIG = {
  [DurationTier.NONE]: {
    key: DurationTier.NONE,
    label: 'Sans audio',
    badgeClasses: 'bg-muted text-muted-foreground',
    dotClass: 'bg-muted-foreground/40',
    signal: false,
  },
  [DurationTier.SHORT]: {
    key: DurationTier.SHORT,
    label: '< 30s',
    badgeClasses: 'bg-primary/5 text-primary',
    dotClass: 'bg-primary/30',
    signal: false,
  },
  [DurationTier.BRIEF]: {
    key: DurationTier.BRIEF,
    label: '30s–1min',
    badgeClasses: 'bg-primary/10 text-primary',
    dotClass: 'bg-primary/50',
    signal: false,
  },
  [DurationTier.MEDIUM]: {
    key: DurationTier.MEDIUM,
    label: '1–3min',
    badgeClasses: 'bg-primary/15 text-primary',
    dotClass: 'bg-primary/70',
    signal: true,
  },
  [DurationTier.LONG]: {
    key: DurationTier.LONG,
    label: '> 3min',
    badgeClasses: 'bg-primary/25 text-primary font-semibold',
    dotClass: 'bg-primary',
    signal: true,
  },
}

/**
 * Retourne la clé de tranche pour une durée en secondes.
 * `null`/`undefined`/0 → NONE (pas d'audio exploitable).
 */
export function getDurationTierKey(durationSec) {
  if (durationSec == null || durationSec <= 0) return DurationTier.NONE
  if (durationSec < 30) return DurationTier.SHORT
  if (durationSec < 60) return DurationTier.BRIEF
  if (durationSec < 180) return DurationTier.MEDIUM
  return DurationTier.LONG
}

/**
 * Métadonnées UI (label, couleurs, signal) d'une durée en secondes.
 */
export function getDurationTier(durationSec) {
  return TIER_CONFIG[getDurationTierKey(durationSec)]
}

/**
 * Options de filtre par tranche, dans l'ordre d'affichage (pills).
 * `all` inclus en tête ; les autres suivent l'ordre croissant de durée.
 */
export const DURATION_FILTERS = [
  { value: 'all', label: 'Toutes durées' },
  { value: DurationTier.NONE, label: TIER_CONFIG[DurationTier.NONE].label },
  { value: DurationTier.SHORT, label: TIER_CONFIG[DurationTier.SHORT].label },
  { value: DurationTier.BRIEF, label: TIER_CONFIG[DurationTier.BRIEF].label },
  { value: DurationTier.MEDIUM, label: TIER_CONFIG[DurationTier.MEDIUM].label },
  { value: DurationTier.LONG, label: TIER_CONFIG[DurationTier.LONG].label },
]

/**
 * Vrai si la durée correspond à la tranche de filtre demandée.
 */
export function matchesDurationFilter(durationSec, filterValue) {
  if (!filterValue || filterValue === 'all') return true
  return getDurationTierKey(durationSec) === filterValue
}
