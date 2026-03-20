import { useState, useMemo, useEffect } from 'react'
//component utilisé pour la pagination dans la page EcouteLive et Enregistrement
/**
 * Hook personnalisé pour gérer la pagination
 * @param {Array} items - Liste des éléments à paginer
 * @param {number} itemsPerPage - Nombre d'éléments par page (défaut: 10)
 * @returns {Object} - Objet contenant les données paginées et les contrôles
 */
export function usePagination(items = [], itemsPerPage = 10) {
  const [currentPage, setCurrentPage] = useState(1)

  // Calculer les valeurs de pagination
  const totalPages = Math.ceil(items.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex]
  )

  // Réinitialiser la page quand les items changent (ex: après un filtre)
  useEffect(() => {
    setCurrentPage(1)
  }, [items.length])

  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1))
  }

  const goToPreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1))
  }

  const goToPage = page => {
    const pageNumber = Math.max(1, Math.min(totalPages, page))
    setCurrentPage(pageNumber)
  }

  return {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    currentItems,
    goToNextPage,
    goToPreviousPage,
    goToPage,
    setCurrentPage,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  }
}
