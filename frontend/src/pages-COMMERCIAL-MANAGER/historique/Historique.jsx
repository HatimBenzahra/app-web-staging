import React, { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { Building2, ChevronRight, ChevronLeft, Clock } from 'lucide-react'
import { useCommercialTheme } from '@/hooks/ui/use-commercial-theme'

const ITEMS_PER_PAGE = 8

// Plus de chargement de portes ici: on affiche seulement l'immeuble, trié par updatedAt

/**
 * Page Historique - Affiche l'historique des immeubles avec portes modifiées
 */
export default function Historique() {
  const context = useOutletContext()
  const commercial = context?.commercial
  const { colors, base, getButtonClasses } = useCommercialTheme()
  const navigate = useNavigate()

  const [periodFilter, setPeriodFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  // Utiliser le paquet d'immeubles déjà chargé au dashboard
  const immeubles = React.useMemo(() => commercial?.immeubles || [], [commercial])

  // Tri: du plus récent au plus ancien selon updatedAt
  const sortedImmeubles = React.useMemo(() => {
    return [...immeubles].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  }, [immeubles])

  // Reset to page 1 when period filter changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [periodFilter])

  // Plus de tracking via portes; on utilise updatedAt de l'immeuble
  const sortedImmeubleIds = React.useMemo(() => sortedImmeubles.map(i => i.id), [sortedImmeubles])

  // Pagination
  const totalPages = Math.ceil(sortedImmeubleIds.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedImmeubleIds = new Set(sortedImmeubleIds.slice(startIndex, endIndex))

  return (
    <div className="space-y-4 mb-40">
      {/* Filtres temporels */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          variant={periodFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPeriodFilter('all')}
          className={`${periodFilter === 'all' ? `${colors.primaryLight.bg} ${colors.black.text} hover:${colors.primaryLight.bg}` : getButtonClasses('outline')} text-xs sm:text-sm`}
        >
          Tout
        </Button>
        <Button
          variant={periodFilter === '24h' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPeriodFilter('24h')}
          className={`${periodFilter === '24h' ? `${colors.primaryLight.bg} ${colors.black.text} hover:${colors.primaryLight.bg}` : getButtonClasses('outline')} text-xs sm:text-sm`}
        >
          24 heures
        </Button>
        <Button
          variant={periodFilter === '7d' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPeriodFilter('7d')}
          className={`${periodFilter === '7d' ? `${colors.primaryLight.bg} ${colors.black.text} hover:${colors.primaryLight.bg}` : getButtonClasses('outline')} text-xs sm:text-sm`}
        >
          7 jours
        </Button>
        <Button
          variant={periodFilter === '30d' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPeriodFilter('30d')}
          className={`${periodFilter === '30d' ? `${colors.primaryLight.bg} ${colors.black.text} hover:${colors.primaryLight.bg}` : getButtonClasses('outline')} text-xs sm:text-sm`}
        >
          30 jours
        </Button>
      </div>

      {/* Liste des immeubles */}
      <div className="space-y-3">
        {immeubles.length === 0 ? (
          <Card className={`p-8 ${base.bg.card} ${base.border.card}`}>
            <div className="text-center">
              <Building2 className={`w-12 h-12 mx-auto mb-3 ${base.text.muted}`} />
              <p className={`text-sm ${base.text.muted}`}>Aucun immeuble trouvé</p>
            </div>
          </Card>
        ) : (
          <>
            {sortedImmeubles
              .filter(imm => {
                // Filtre période basé sur immeuble.updatedAt uniquement
                const lastModified = new Date(imm.updatedAt).getTime()
                const now = Date.now()
                switch (periodFilter) {
                  case '24h':
                    return now - lastModified < 24 * 60 * 60 * 1000
                  case '7d':
                    return now - lastModified < 7 * 24 * 60 * 60 * 1000
                  case '30d':
                    return now - lastModified < 30 * 24 * 60 * 60 * 1000
                  default:
                    return true
                }
              })
              .map(
                immeuble =>
                  paginatedImmeubleIds.has(immeuble.id) && (
                    <Card
                      key={immeuble.id}
                      className={`${base.bg.card} ${base.border.card} cursor-pointer hover:shadow-md transition-all hover:scale-[1.01]`}
                      onClick={() => navigate(`/portes/lecture/${immeuble.id}`)}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-xl ${colors.primary.bg} flex items-center justify-center shrink-0 shadow-sm`}
                          >
                            <Building2 className="w-6 h-6 text-white" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3
                              className={`font-semibold text-sm sm:text-base ${base.text.primary} truncate`}
                            >
                              {immeuble.adresse}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span
                                className={`text-xs ${base.text.muted} flex items-center gap-1`}
                              >
                                <Clock className="w-3 h-3" />
                                {new Date(immeuble.updatedAt).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                          </div>

                          <ChevronRight
                            className={`w-5 h-5 ${colors.primary.text} shrink-0`}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )
              )}

            {/* Message si aucun immeuble visible après filtrage */}
            {sortedImmeubleIds.length === 0 && immeubles.length > 0 && (
              <Card className={`p-8 ${base.bg.card} ${base.border.card}`}>
                <div className="text-center">
                  <Building2 className={`w-12 h-12 mx-auto mb-3 ${base.text.muted}`} />
                  <p className={`text-sm ${base.text.muted}`}>
                    Aucun immeuble modifié pour cette période
                  </p>
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Pagination controls */}
      {sortedImmeubleIds.length > ITEMS_PER_PAGE && (
        <div className="mt-6 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className={`text-sm ${base.text.muted}`}>
            Affichage de {startIndex + 1} à {Math.min(endIndex, sortedImmeubleIds.length)} sur{' '}
            {sortedImmeubleIds.length} immeuble
            {sortedImmeubleIds.length > 1 ? 's' : ''}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`${base.bg.card} ${base.border.card} border hover:${base.bg.hover} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Précédent
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                // Show first page, last page, current page, and pages around current
                const showPage =
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)

                if (!showPage) {
                  // Show ellipsis for skipped pages
                  if (
                    (page === currentPage - 2 && currentPage > 3) ||
                    (page === currentPage + 2 && currentPage < totalPages - 2)
                  ) {
                    return (
                      <span key={page} className={`px-2 ${base.text.muted}`}>
                        ...
                      </span>
                    )
                  }
                  return null
                }

                return (
                  <Button
                    key={page}
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={
                      currentPage === page
                        ? getButtonClasses('primary')
                        : `${base.bg.card} ${base.border.card} border hover:${base.bg.hover} min-w-10 ${base.text.primary}`
                    }
                  >
                    {page}
                  </Button>
                )
              })}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`${base.bg.card} ${base.border.card} border hover:${base.bg.hover} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Suivant
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Vue détaillée déplacée vers la page de lecture des portes */}
    </div>
  )
}
