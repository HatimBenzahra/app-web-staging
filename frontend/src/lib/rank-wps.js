import { tierStyle, tierForPoints } from '@/constants/domain/rank-tiers'

/** Clé de période mensuelle courante ("YYYY-MM"), format backend gamification. */
export function currentMonthlyPeriodKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Normalise un snapshot WPS en info de rang prête à afficher.
 * Repli sur Bronze / 0 pt si aucun snapshot (user non mappé WPS ou sans contrat
 * ce mois) — comme le mobile et l'ancien barème ProWin.
 */
export function toRankInfo(snapshot) {
  const points = snapshot?.points ?? 0
  const style = snapshot?.rankTierKey ? tierStyle(snapshot.rankTierKey) : tierForPoints(points)
  return {
    points,
    position: snapshot?.rank ?? null,
    tierKey: style.key,
    name: snapshot?.rankTierLabel || style.label,
    badgeClasses: style.badgeClasses,
  }
}

/** Sélectionne le snapshot mensuel courant dans la liste des snapshots d'un user. */
export function pickMonthlySnapshot(snapshots, periodKey = currentMonthlyPeriodKey()) {
  return (snapshots || []).find(s => s.period === 'MONTHLY' && s.periodKey === periodKey) || null
}

/**
 * Indexe une liste de classement (`ranking(MONTHLY, key)`) par utilisateur.
 * Retourne { byCommercial: Map<id, snapshot>, byManager: Map<id, snapshot> }.
 */
export function indexRankingByUser(rankingList) {
  const byCommercial = new Map()
  const byManager = new Map()
  for (const s of rankingList || []) {
    if (s.commercialId != null) byCommercial.set(s.commercialId, s)
    else if (s.managerId != null) byManager.set(s.managerId, s)
  }
  return { byCommercial, byManager }
}
