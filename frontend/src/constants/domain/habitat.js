/**
 * Fichier centralisé pour la gestion des types de bâtiment (Frontend)
 *
 * Source de vérité UNIQUE pour :
 * - L'enum TypeHabitat (synchronisé avec le backend)
 * - La règle legacy `effectiveTypeHabitat` (pavillon avec nbPortesParEtage > 1 = immeuble)
 * - Les métadonnées UI de chaque type (label, icône, couleur, unité, plan)
 * - Le calcul du nombre de portes d'un bâtiment
 *
 * Terme générique : « bâtiment ».
 *
 * IMPORTANT : ne PAS dupliquer le calcul de portes ni le mapping type ailleurs.
 * Toute UI qui affiche un type de bâtiment ou compte ses portes DOIT passer par ce fichier.
 *
 * Sémantique :
 * - IMMEUBLE  = nbEtages × nbPortesParEtage portes, étages + ascenseur + code digital
 * - MAISON    = 1 foyer / 1 porte, pas d'étages
 * - PAVILLON  = nbMaisonsPrevu maisons (1 porte par maison)
 *
 * Règle legacy : un pavillon créé avant le fix (nbPortesParEtage > 1) est traité
 * comme un IMMEUBLE à l'affichage (voir `effectiveTypeHabitat`).
 *
 * DOIT être synchronisé avec :
 * - backend (enum TypeHabitat)
 * - app-mobile/components/immeubles/lieu-terms.ts (même logique, ne PAS importer le mobile)
 */

import { Building2, Home, Warehouse } from 'lucide-react'

/**
 * Enum des types de bâtiment
 * DOIT être synchronisé avec le backend
 */
export const TypeHabitat = {
  IMMEUBLE: 'IMMEUBLE',
  MAISON: 'MAISON',
  PAVILLON: 'PAVILLON',
}

/**
 * Renvoie le type d'habitat effectif pour l'affichage.
 *
 * Un pavillon legacy (nbPortesParEtage > 1) est traité comme IMMEUBLE afin
 * d'éviter des totaux incohérents et une cartographie écrasée. Les vrais
 * immeubles et les nouveaux pavillons (nbPortesParEtage ≤ 1) ne sont pas affectés.
 *
 * @param {{ typeHabitat?: string, nbPortesParEtage?: number|null }} immeuble
 * @returns {string} Un TypeHabitat
 */
export function effectiveTypeHabitat(immeuble) {
  if (!immeuble) return TypeHabitat.IMMEUBLE
  if (immeuble.typeHabitat === TypeHabitat.PAVILLON && (immeuble.nbPortesParEtage ?? 1) > 1) {
    return TypeHabitat.IMMEUBLE
  }
  return immeuble.typeHabitat ?? TypeHabitat.IMMEUBLE
}

/**
 * Métadonnées UI d'un type de bâtiment.
 * @typedef {Object} HabitatMeta
 * @property {string} label - Libellé au singulier ("Immeuble", "Maison", "Pavillon")
 * @property {string} labelPlural - Libellé au pluriel ("Immeubles", "Maisons", "Pavillons")
 * @property {import('lucide-react').LucideIcon} Icon - Icône Lucide React
 * @property {'primary'|'success'|'warning'} tone - Ton sémantique du thème
 * @property {string} accentColor - Classe texte d'accent (ex. "text-blue-600")
 * @property {string} accentBg - Classe fond doux d'accent (ex. "bg-blue-500/10")
 * @property {string} accentBorder - Classe bordure d'accent (ex. "border-blue-500")
 * @property {string} badgeClasses - Classes complètes pour un badge (fond + texte)
 * @property {string} unitLabel - Libellé singulier de l'unité ("Étage" / "Foyer" / "Maison")
 * @property {string} unitLabelPlural - Libellé pluriel de l'unité
 * @property {string} planTitle - Titre de la section plan
 * @property {boolean} showFloors - false uniquement pour MAISON (pas d'étages)
 */

/** @type {Record<string, HabitatMeta>} */
const HABITAT_CONFIG = {
  [TypeHabitat.IMMEUBLE]: {
    label: 'Immeuble',
    labelPlural: 'Immeubles',
    Icon: Building2,
    tone: 'primary',
    accentColor: 'text-blue-600',
    accentBg: 'bg-blue-500/10',
    accentBorder: 'border-blue-500',
    badgeClasses: 'bg-blue-100 text-blue-800',
    unitLabel: 'Étage',
    unitLabelPlural: 'étages',
    planTitle: "Plan de l'immeuble",
    showFloors: true,
  },
  [TypeHabitat.MAISON]: {
    label: 'Maison',
    labelPlural: 'Maisons',
    Icon: Home,
    tone: 'success',
    accentColor: 'text-emerald-600',
    accentBg: 'bg-emerald-500/10',
    accentBorder: 'border-emerald-500',
    badgeClasses: 'bg-emerald-100 text-emerald-800',
    unitLabel: 'Foyer',
    unitLabelPlural: 'foyers',
    planTitle: 'Plan du lieu',
    showFloors: false,
  },
  [TypeHabitat.PAVILLON]: {
    label: 'Pavillon',
    labelPlural: 'Pavillons',
    Icon: Warehouse,
    tone: 'warning',
    accentColor: 'text-amber-600',
    accentBg: 'bg-amber-500/10',
    accentBorder: 'border-amber-500',
    badgeClasses: 'bg-amber-100 text-amber-800',
    unitLabel: 'Maison',
    unitLabelPlural: 'maisons',
    planTitle: 'Plan du lieu',
    showFloors: true,
  },
}

/**
 * Retourne les métadonnées UI d'un type de bâtiment.
 * Repli sur IMMEUBLE pour tout type inconnu ou absent.
 *
 * @param {string} [type] - Un TypeHabitat (idéalement déjà `effectiveTypeHabitat`)
 * @returns {HabitatMeta}
 */
export function getHabitatMeta(type) {
  return HABITAT_CONFIG[type] || HABITAT_CONFIG[TypeHabitat.IMMEUBLE]
}

/**
 * Nombre total de portes d'un bâtiment, selon son type effectif.
 * - IMMEUBLE (ou pavillon legacy) : nbEtages × nbPortesParEtage
 * - MAISON : 1
 * - PAVILLON : nbMaisonsPrevu ?? 0
 *
 * @param {{ typeHabitat?: string, nbEtages?: number|null, nbPortesParEtage?: number|null, nbMaisonsPrevu?: number|null }} immeuble
 * @returns {number}
 */
export function buildingDoorCount(immeuble) {
  if (!immeuble) return 0
  const type = effectiveTypeHabitat(immeuble)
  if (type === TypeHabitat.MAISON) return 1
  if (type === TypeHabitat.PAVILLON) return immeuble.nbMaisonsPrevu ?? 0
  return (immeuble.nbEtages ?? 0) * (immeuble.nbPortesParEtage ?? 0)
}

/**
 * Ventilation d'une liste de bâtiments par type effectif.
 *
 * @param {Array<{ typeHabitat?: string, nbPortesParEtage?: number|null }>} [immeubles]
 * @returns {{ total: number, IMMEUBLE: number, MAISON: number, PAVILLON: number }}
 */
export function habitatBreakdown(immeubles = []) {
  const breakdown = {
    total: immeubles.length,
    [TypeHabitat.IMMEUBLE]: 0,
    [TypeHabitat.MAISON]: 0,
    [TypeHabitat.PAVILLON]: 0,
  }
  for (const immeuble of immeubles) {
    breakdown[effectiveTypeHabitat(immeuble)] += 1
  }
  return breakdown
}
