import React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Composant de pagination réutilisable
 */
export function Pagination({
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  totalItems,
  itemLabel = 'éléments',
  onPrevious,
  onNext,
  hasPreviousPage,
  hasNextPage,
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-muted-foreground">
        Affichage de {startIndex + 1} à {Math.min(endIndex, totalItems)} sur {totalItems}{' '}
        {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrevious} disabled={!hasPreviousPage}>
          <ChevronLeft className="h-4 w-4" />
          Précédent
        </Button>
        <span className="text-sm">
          Page {currentPage} sur {totalPages}
        </span>
        <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNextPage}>
          Suivant
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
