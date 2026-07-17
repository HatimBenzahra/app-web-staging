/**
 * Paliers de rang WinLeadPlus (gamification) — SOURCE UNIQUE côté web.
 *
 * Le rang de l'app est désormais 100% WPS : points = somme des points d'offres
 * des contrats validés, palier renvoyé par le backend (`rankTierKey` /
 * `rankTierLabel`). Les seuils DOIVENT rester alignés sur
 * `RankingService.pointTiers` (backend) et sur `utils/business/rankTiers.ts` (mobile).
 *
 * On ne fait ici que l'habillage visuel (couleurs) + la progression, le backend
 * restant la source de vérité des seuils/labels.
 */

// key → habillage. `badgeClasses` réutilise la palette de la page Gamification.
const TIERS = {
  BRONZE: {
    key: 'BRONZE',
    label: 'Bronze',
    badgeClasses: 'bg-orange-100 text-orange-800 border-orange-300',
  },
  SILVER: {
    key: 'SILVER',
    label: 'Silver',
    badgeClasses: 'bg-slate-100 text-slate-800 border-slate-300',
  },
  GOLD: {
    key: 'GOLD',
    label: 'Gold',
    badgeClasses: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  },
  PLATINUM: {
    key: 'PLATINUM',
    label: 'Platinum',
    badgeClasses: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  },
  DIAMOND: {
    key: 'DIAMOND',
    label: 'Diamond',
    badgeClasses: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  },
  MASTER: {
    key: 'MASTER',
    label: 'Master',
    badgeClasses: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  GRANDMASTER: {
    key: 'GRANDMASTER',
    label: 'Grandmaster',
    badgeClasses: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
  },
  LEGEND: {
    key: 'LEGEND',
    label: 'Legend',
    badgeClasses: 'bg-rose-100 text-rose-800 border-rose-300',
  },
}

const FALLBACK = TIERS.BRONZE

/**
 * Seuils de points des 8 paliers — alignés backend `RankingService.pointTiers`.
 * Ordre croissant.
 */
export const TIER_ORDER = [
  { key: 'BRONZE', label: 'Bronze', min: 0 },
  { key: 'SILVER', label: 'Silver', min: 250 },
  { key: 'GOLD', label: 'Gold', min: 600 },
  { key: 'PLATINUM', label: 'Platinum', min: 1200 },
  { key: 'DIAMOND', label: 'Diamond', min: 2200 },
  { key: 'MASTER', label: 'Master', min: 3500 },
  { key: 'GRANDMASTER', label: 'Grandmaster', min: 5000 },
  { key: 'LEGEND', label: 'Legend', min: 7000 },
]

/** Habillage (classes badge) d'un palier depuis sa clé serveur. */
export function tierStyle(tierKey) {
  if (!tierKey) return FALLBACK
  return TIERS[String(tierKey).toUpperCase()] || FALLBACK
}

/** Palier correspondant à un total de points (repli quand la clé serveur manque). */
export function tierForPoints(points = 0) {
  let current = TIER_ORDER[0]
  for (const t of TIER_ORDER) {
    if (points >= t.min) current = t
  }
  return tierStyle(current.key)
}

/** Progression vers le palier suivant (identique au mobile). */
export function tierProgress(points = 0) {
  let idx = 0
  for (let i = 0; i < TIER_ORDER.length; i += 1) {
    if (points >= TIER_ORDER[i].min) idx = i
  }
  const current = TIER_ORDER[idx]
  const next = TIER_ORDER[idx + 1] || null
  if (!next) {
    return { current, next: null, progressPercent: 100, pointsToNext: 0, isMax: true }
  }
  const span = next.min - current.min
  const into = points - current.min
  return {
    current,
    next,
    progressPercent: span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 0,
    pointsToNext: Math.max(0, next.min - points),
    isMax: false,
  }
}
