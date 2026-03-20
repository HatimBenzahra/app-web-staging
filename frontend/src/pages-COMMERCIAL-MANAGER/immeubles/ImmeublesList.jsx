import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Building2,
  Plus,
  Search,
  ArrowUp,
  Key,
  MapPin,
  DoorOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useRole } from '@/contexts/userole'
import { immeubleApi } from '@/services/api'
import AddImmeubleModal from '@/components/AddImmeubleModal'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useCommercialTheme } from '@/hooks/ui/use-commercial-theme'
import { useErrorToast } from '@/hooks/utils/ui/use-error-toast'
import { UI_TIMING } from '@/constants/ui/timing'

const ITEMS_PER_PAGE = 8

export default function ImmeublesList() {
  const { currentUserId } = useRole()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [showScrollToTop, setShowScrollToTop] = useState(false)

  // Hook pour le thème commercial - centralise TOUS les styles
  const { base, components, getButtonClasses, getInputClasses } = useCommercialTheme()

  // Hook pour les toasts
  const { showError, showSuccess } = useErrorToast()

  const context = useOutletContext()
  const commercial = context?.commercial
  const commercialLoading = context?.commercialLoading
  const refetch = context?.refetch

  // Filter immeubles based on search query
  const filteredImmeubles =
    commercial?.immeubles?.filter(immeuble =>
      immeuble.adresse.toLowerCase().includes(searchQuery.toLowerCase())
    ) || []

  // Sort filtered immeubles by updatedAt (most recent first)
  const sortedImmeubles = [...filteredImmeubles].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  // Pagination logic
  const totalPages = Math.ceil(sortedImmeubles.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedImmeubles = sortedImmeubles.slice(startIndex, endIndex)

  // Reset to page 1 when search query changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  // Détecter le scroll pour afficher le bouton "Remonter"
  React.useEffect(() => {
    const handleScroll = e => {
      const scrollContainer = e.target
      // Afficher le bouton si on a scrollé plus que le seuil défini
      setShowScrollToTop(scrollContainer.scrollTop > UI_TIMING.SCROLL_TO_TOP_THRESHOLD)
    }

    // Attendre que le DOM soit complètement monté
    const timer = setTimeout(() => {
      const scrollContainer = document.querySelector('.commercial-scroll-container')
      if (scrollContainer) {
        scrollContainer.addEventListener('scroll', handleScroll)
      }
    }, UI_TIMING.SCROLL_CONTAINER_SETUP_DELAY)

    return () => {
      clearTimeout(timer)
      const scrollContainer = document.querySelector('.commercial-scroll-container')
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll)
      }
    }
  }, [])

  // Fonction pour remonter en haut de la page
  const scrollToTop = () => {
    const scrollContainer = document.querySelector('.commercial-scroll-container')
    if (scrollContainer) {
      scrollContainer.scrollTo({ behavior: 'smooth', top: 0 })
    }
  }

  const handleAddImmeuble = async immeubleData => {
    try {
      const { isManager } = context || {}

      // Add the current user ID as commercialId or managerId based on role
      const dataWithUser = {
        ...immeubleData,
        ...(isManager ? { managerId: parseInt(currentUserId) } : { commercialId: parseInt(currentUserId) }),
      }

      // Call the GraphQL mutation to create the immeuble
      await immeubleApi.create(dataWithUser)

      // Refetch data after successful creation
      await refetch()

      // Toast de succès
      showSuccess('Immeuble ajouté avec succès !')
    } catch (error) {
      console.error('Error creating immeuble:', error)
      showError(error, 'Ajout immeuble')
    }
  }

  if (commercialLoading) {
    return (
      <div className={components.loading.container}>
        <div className="text-center">
          <div className={`${components.loading.spinner} mx-auto mb-4`}></div>
          <p className={components.loading.text}>Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4 mb-40">
      {/* Page header */}
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setShowAddModal(true)}
            className={`w-full flex items-center space-x-2 ${getButtonClasses('primary')}`}
          >
            <Plus className="h-4 w-4" />
            <span>Ajouter</span>
          </Button>
        </div>

        {/* Stats summary - Responsive grid */}
        <div className="grid grid-cols-2 md:grid-cols-2 gap-2 sm:gap-3">
          <Card className={`${base.bg.card} ${base.border.card}`}>
            <CardContent className="p-2 sm:p-2.5 md:p-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                <div className="flex-1 min-w-0">
                  <p className={`text-[10px] sm:text-xs ${base.text.muted} mb-0.5`}>Immeubles</p>
                  <p className={`text-base sm:text-lg md:text-xl font-bold ${base.text.primary}`}>
                    {filteredImmeubles.length}
                  </p>
                </div>
                <div className="p-1 sm:p-1.5 md:p-2 rounded-lg border border-gray-200 bg-gray-50 flex-shrink-0">
                  <Building2
                    className={`h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 ${base.icon.default}`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`${base.bg.card} ${base.border.card} `}>
            <CardContent className="p-2 sm:p-2.5 md:p-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                <div className="flex-1 min-w-0">
                  <p className={`text-[10px] sm:text-xs ${base.text.muted} mb-0.5`}>Total portes</p>
                  <p className={`text-base sm:text-lg md:text-xl font-bold ${base.text.primary}`}>
                    {filteredImmeubles.reduce(
                      (total, i) => total + i.nbEtages * i.nbPortesParEtage,
                      0
                    )}
                  </p>
                </div>
                <div className="p-1 sm:p-1.5 md:p-2 rounded-lg border border-gray-200 bg-gray-50 flex-shrink-0">
                  <Key className={`h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 ${base.icon.default}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${base.icon.muted}`}
          />
          <Input
            placeholder="Rechercher une adresse..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={getInputClasses(true)}
          />
        </div>
      </div>

      {/* Immeubles grid */}
      <div>
        {filteredImmeubles.length === 0 ? (
          <Card className={`p-8 ${base.bg.card} ${base.border.card}`}>
            <div className="text-center">
              <div
                className={`inline-flex p-4 rounded-lg border ${base.border.default} ${base.bg.muted} mb-4`}
              >
                <Building2 className={`h-12 w-12 ${base.icon.default}`} />
              </div>
              <h3 className={`text-lg font-medium ${base.text.primary} mb-2`}>
                {searchQuery ? 'Aucun résultat' : 'Aucun immeuble'}
              </h3>
              <p className={`${base.text.muted} mb-4`}>
                {searchQuery
                  ? 'Aucun immeuble ne correspond à votre recherche'
                  : "Vous n'avez pas encore d'immeubles prospectés"}
              </p>
              {!searchQuery && (
                <Button
                  variant="ghost"
                  onClick={() => setShowAddModal(true)}
                  className={getButtonClasses('primary')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter votre premier immeuble
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3">
            {paginatedImmeubles.map(immeuble => (
              <Card
                key={immeuble.id}
                className={`${components.card.base} ${components.card.hover}`}
              >
                <CardContent className="p-3 sm:p-3.5 md:p-4">
                  <div className="space-y-2.5 sm:space-y-3">
                    {/* Address header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2 flex-1">
                        <div
                          className={`p-1.5 rounded-lg border ${base.border.default} ${base.bg.muted} flex-shrink-0`}
                        >
                          <MapPin className={`h-3.5 w-3.5 ${base.icon.default}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3
                            className={`font-semibold text-sm sm:text-base leading-tight mb-0.5 ${base.text.primary}`}
                            title={immeuble.adresse}
                          >
                            {immeuble.adresse}
                          </h3>
                          <p className={`text-[10px] sm:text-xs ${base.text.muted}`}>
                            {new Date(immeuble.createdAt).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Building info grid */}
                    <div className={`grid grid-cols-2 gap-3 pt-2 border-t ${base.border.default}`}>
                      <div className="space-y-0.5">
                        <p className={`text-[10px] sm:text-xs ${base.text.muted}`}>Étages</p>
                        <div className="flex items-center space-x-1.5">
                          <Building2 className={`h-3.5 w-3.5 ${base.icon.default}`} />
                          <span className={`font-semibold text-sm ${base.text.primary}`}>
                            {immeuble.nbEtages}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <p className={`text-[10px] sm:text-xs ${base.text.muted}`}>Portes/étage</p>
                        <div className="flex items-center space-x-1.5">
                          <Key className={`h-3.5 w-3.5 ${base.icon.default}`} />
                          <span className={`font-semibold text-sm ${base.text.primary}`}>
                            {immeuble.nbPortesParEtage}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Badges row */}
                    <div className={`flex flex-wrap gap-1.5 pt-2 border-t ${base.border.default}`}>
                      <Badge
                        variant={immeuble.ascenseurPresent ? 'default' : 'secondary'}
                        className={components.badge.default}
                      >
                        <ArrowUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                        <span className="text-[10px] sm:text-xs">
                          {immeuble.ascenseurPresent ? 'Ascenseur' : 'Sans ascenseur'}
                        </span>
                      </Badge>

                      {immeuble.digitalCode && (
                        <Badge variant="outline" className={components.badge.outline}>
                          <Key className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                          <span className="text-[10px] sm:text-xs">
                            Code: {immeuble.digitalCode}
                          </span>
                        </Badge>
                      )}
                    </div>

                    {/* Total doors */}
                    <div
                      className={`p-2 sm:p-2.5 rounded-lg border ${base.border.default} ${base.bg.muted}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs sm:text-sm ${base.text.muted}`}>
                          Total des portes
                        </span>
                        <span className={`text-base sm:text-lg font-bold ${base.text.primary}`}>
                          {immeuble.nbEtages * immeuble.nbPortesParEtage}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <Button
                      variant="ghost"
                      onClick={e => {
                        e.stopPropagation()
                        navigate(`/portes/${immeuble.id}`)
                      }}
                      className={`w-full ${getButtonClasses('primary')}`}
                      size="sm"
                    >
                      <DoorOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
                      Gérer les portes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination controls */}
        {sortedImmeubles.length > ITEMS_PER_PAGE && (
          <div className="mt-6 mb-20 sm:mb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className={`text-sm ${base.text.muted}`}>
              Affichage de {startIndex + 1} à {Math.min(endIndex, sortedImmeubles.length)} sur{' '}
              {sortedImmeubles.length} immeuble{sortedImmeubles.length > 1 ? 's' : ''}
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
                          : `${base.bg.card} ${base.border.card} border hover:${base.bg.hover} min-w-[2.5rem] ${base.text.primary}`
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
      </div>

      {/* Add Immeuble Modal */}
      <AddImmeubleModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSave={handleAddImmeuble}
      />

      {/* Bouton flottant "Remonter" avec animation */}
      {showScrollToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-28 sm:bottom-24 right-4 sm:right-6 z-50 flex flex-col items-center justify-center px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 active:scale-95 border-2 border-blue-400"
          aria-label="Remonter"
        >
          <ArrowUp className="w-5 h-5 sm:w-6 sm:h-6 animate-bounce mb-0.5 sm:mb-1" />
          <span className="font-bold text-[10px] sm:text-xs whitespace-nowrap">Haut</span>
        </button>
      )}
    </div>
  )
}
