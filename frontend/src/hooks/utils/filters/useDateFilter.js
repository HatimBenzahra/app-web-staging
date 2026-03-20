import { useState } from 'react'

/**
 * Hook pour gérer les filtres de date et filtrer les données par période
 * @returns {Object} Objet contenant les états et fonctions de filtrage
 */
export function useDateFilter() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [appliedStartDate, setAppliedStartDate] = useState('')
  const [appliedEndDate, setAppliedEndDate] = useState('')

  // Fonction pour valider les filtres
  const handleApplyFilters = () => {
    setAppliedStartDate(startDate)
    setAppliedEndDate(endDate)
  }

  // Fonction pour réinitialiser les filtres
  const handleResetFilters = () => {
    setStartDate('')
    setEndDate('')
    setAppliedStartDate('')
    setAppliedEndDate('')
  }

  return {
    startDate,
    endDate,
    appliedStartDate,
    appliedEndDate,
    setStartDate,
    setEndDate,
    handleApplyFilters,
    handleResetFilters,
  }
}

/**
 * Filtre les statistiques par période
 * @param {Array} statistics - Tableau des statistiques à filtrer
 * @param {string} start - Date de début (format ISO)
 * @param {string} end - Date de fin (format ISO)
 * @returns {Array} Statistiques filtrées
 */
export function filterStatisticsByDate(statistics, start, end) {
  if (!statistics || !statistics.length) return []
  if (!start && !end) return statistics

  return statistics.filter(stat => {
    const statDate = new Date(stat.createdAt)
    if (start) {
      const startDateTime = new Date(start)
      startDateTime.setHours(0, 0, 0, 0)
      if (statDate < startDateTime) return false
    }
    if (end) {
      const endDateTime = new Date(end)
      endDateTime.setHours(23, 59, 59, 999) // Inclure toute la journée de fin
      if (statDate > endDateTime) return false
    }
    return true
  })
}

/**
 * Filtre les portes par date de dernière visite
 * @param {Array} portes - Tableau des portes à filtrer
 * @param {string} start - Date de début (format ISO)
 * @param {string} end - Date de fin (format ISO)
 * @returns {Array} Portes filtrées
 */
export function filterPortesByDate(portes, start, end) {
  if (!portes || !portes.length) return []
  if (!start && !end) return portes

  return portes.filter(porte => {
    const dateToCheck = porte.derniereVisite || porte.updatedAt || porte.createdAt
    if (!dateToCheck) return false
    const porteDate = new Date(dateToCheck)
    if (start) {
      const startDateTime = new Date(start)
      startDateTime.setHours(0, 0, 0, 0)
      if (porteDate < startDateTime) return false
    }
    if (end) {
      const endDateTime = new Date(end)
      endDateTime.setHours(23, 59, 59, 999)
      if (porteDate > endDateTime) return false
    }
    return true
  })
}
