import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, ArrowLeft, Eye, CheckCircle2, RotateCcw, MapPin, Plus, Minus } from 'lucide-react'
import { useCommercialTheme } from '@/hooks/ui/use-commercial-theme'
import { useImmeuble } from '@/hooks/metier/use-api'
import PorteCardOriginal from './PorteCardOriginal'
import ScrollToTopButton from './ScrollToTopButton'
import StatusFilters from './StatusFilters'
import { useStatutOptions } from '../hooks/useStatutOptions'

export default function PortesTemplate({
  // Données
  portes = [],
  loading = false,

  // Mode d'affichage
  readOnly = false,
  showStatusFilters = false,

  // Filtres
  selectedStatuts = [],
  onStatutToggle,
  onClearStatutFilters,

  // Actions portes (mode édition seulement)
  onPorteEdit,
  onQuickStatusChange,
  onRepassageChange,

  // Navigation
  onBack,
  backButtonText = 'Retour',

  // Scroll target pour le bouton "remonter"
  scrollTarget,
  scrollTargetText = 'Haut',

  // Filtres personnalisés additionnels
  customFilters,

  // Actions additionnelles
  additionalActions,

  // Nouvelles actions de gestion d'étages et portes
  onAddPorteToEtage,
  onAddEtage,
  onRemoveEtage,
  onRemovePorteFromEtage,
  addingPorteToEtage = false,
  addingEtage = false,

  // Floor Filtering
  onFloorSelect,
  selectedFloor,
  isFetchingMore = false,
  statsData = null,

  // Header control - permet au parent de gérer le header
  hideHeader = false,
}) {
  const { immeubleId } = useParams()
  const navigate = useNavigate()
  const { colors, base, components, getButtonClasses } = useCommercialTheme()
  const statutOptions = useStatutOptions()
  const etageRefs = useRef({})

  // Récupérer les informations de l'immeuble
  const { data: immeuble, loading: immeubleLoading } = useImmeuble(parseInt(immeubleId))

  // Fonction de navigation par défaut
  const defaultBackHandler = () => {
    if (onBack) {
      onBack()
    } else {
      navigate(-1)
    }
  }

  // Filtrer les portes selon les statuts sélectionnés (si filtres activés)
  const allFilteredPortes = useMemo(() => {
    if (!showStatusFilters || selectedStatuts.length === 0) return portes
    return portes.filter(porte => selectedStatuts.includes(porte.statut))
  }, [portes, selectedStatuts, showStatusFilters])

  // --- PROGRESSIVE RENDERING LOGIC ---
  const [visibleCount, setVisibleCount] = useState(20)
  const loaderRef = useRef(null)

  // Reset quand les filtres ou les portes changent
  useEffect(() => {
    setVisibleCount(20)
  }, [allFilteredPortes.length, selectedFloor, selectedStatuts]) // Add selectedFloor dependency as it affects the view

  // Observer pour charger plus
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + 20)
        }
      },
      { threshold: 0.1 }
    )

    if (loaderRef.current) {
      observer.observe(loaderRef.current)
    }

    return () => observer.disconnect()
  }, [allFilteredPortes.length]) // Re-run if list size changes significantly

  // Portes actuellement visibles
  const visiblePortes = useMemo(() => {
    // On respecte l'ordre fourni par le parent (API) pour être cohérent avec le mode Rapide
    // On ne retrie PAS ici, on prend juste les X premiers.
    return allFilteredPortes.slice(0, visibleCount)
  }, [allFilteredPortes, visibleCount])

  // Grouper les portes VISIBLES par étage en préservant l'ordre d'apparition
  const portesByEtage = useMemo(() => {
    const grouped = {}
    const floorOrder = []

    visiblePortes.forEach(p => {
      if (!grouped[p.etage]) {
        grouped[p.etage] = []
        floorOrder.push(p.etage)
      }
      grouped[p.etage].push(p)
    })

    // Retourne un tableau ordonné pour le rendu
    return floorOrder.map(etage => ({
      etage,
      portes: grouped[etage].sort((a, b) => a.numero.localeCompare(b.numero)),
    }))
  }, [visiblePortes])

  // Statistiques des portes (Backend ou calculé)
  const stats = useMemo(() => {
    if (statsData) {
      return {
        total: statsData.totalPortes,
        nonVisitees: statsData.nonVisitees,
        contratsSigne: statsData.contratsSigne,
        rdvPris: statsData.rdvPris,
        absent: statsData.absent,
        argumente: statsData.argumente,
        refus: statsData.refus,
        repassages: statsData.necessiteRepassage,
        tauxVisite: statsData.tauxConversion || '0',
      }
    }
    const total = portes.length
    const nonVisitees = portes.filter(p => p.statut === 'NON_VISITE').length
    const contratsSigne = portes
      .filter(p => p.statut === 'CONTRAT_SIGNE')
      .reduce((sum, p) => sum + (p.nbContrats || 1), 0)
    const rdvPris = portes.filter(p => p.statut === 'RENDEZ_VOUS_PRIS').length
    const absent = portes.filter(p => p.statut === 'ABSENT').length
    const argumente = portes.filter(p => p.statut === 'ARGUMENTE').length
    const refus = portes.filter(p => p.statut === 'REFUS').length
    const repassages = portes.filter(p => p.statut === 'NECESSITE_REPASSAGE').length
    const tauxVisite = total > 0 ? (((total - nonVisitees) / total) * 100).toFixed(1) : '0'
    return {
      total,
      nonVisitees,
      contratsSigne,
      rdvPris,
      absent,
      argumente,
      refus,
      repassages,
      tauxVisite,
    }
  }, [portes, statsData])

  // Compteurs par statut pour les filtres (sur TOUTES les portes, pas juste visible)
  const portesCountByStatus = useMemo(() => {
    const counts = {}
    if (statsData) {
      // S'assurer que les compteurs ne sont jamais négatifs
      counts['NON_VISITE'] = Math.max(0, statsData.nonVisitees || 0)
      counts['CONTRAT_SIGNE'] = Math.max(0, statsData.contratsSigne || 0)
      counts['RENDEZ_VOUS_PRIS'] = Math.max(0, statsData.rdvPris || 0)
      counts['ABSENT'] = Math.max(0, statsData.absent || 0)
      counts['ARGUMENTE'] = Math.max(0, statsData.argumente || 0)
      counts['REFUS'] = Math.max(0, statsData.refus || 0)
      counts['NECESSITE_REPASSAGE'] = Math.max(0, statsData.necessiteRepassage || 0)
      return counts
    }

    statutOptions.forEach(option => {
      counts[option.value] = portes.filter(p => p.statut === option.value).length
    })
    return counts
  }, [portes, statutOptions, statsData])

  // Stats des portes filtrées pour l'affichage (sur ALL FILTERED, pas visible)
  const filteredStats = useMemo(() => {
    const hasFilters = showStatusFilters && selectedStatuts.length > 0
    const totalFiltered = allFilteredPortes.length
    const totalOriginal = stats.total

    return {
      ...stats,
      totalFiltered,
      hasFilters,
      displayTotal: hasFilters ? totalFiltered : totalOriginal,
    }
  }, [allFilteredPortes, stats, selectedStatuts, showStatusFilters])

  // Calculate available floors based on ALL data (not just visible)
  const etagesDisponibles = useMemo(() => {
    if (statsData && statsData.portesParEtage) {
      return [...statsData.portesParEtage].sort((a, b) => b.etage - a.etage)
    }
    const counts = {}
    allFilteredPortes.forEach(p => {
      counts[p.etage] = (counts[p.etage] || 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([etage, count]) => ({ etage: Number(etage), count }))
  }, [statsData, allFilteredPortes])

  // Scroll or Filter
  const handleEtageClick = etage => {
    if (onFloorSelect) {
      onFloorSelect(etage)
    } else {
      // Si on clique sur un étage qui n'est pas encore affiché, on doit tout afficher
      // pour permettre le scroll.
      // On affiche tout d'un coup (peut causer un petit délai mais c'est une action utilisateur explicite)
      if (visibleCount < allFilteredPortes.length) {
        setVisibleCount(allFilteredPortes.length)
        // On laisse le temps au render de se faire avant de scroller
        setTimeout(() => {
          const target = etageRefs.current[etage]
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        }, 100)
      } else {
        const target = etageRefs.current[etage]
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    }
  }

  if (loading || immeubleLoading) {
    return (
      <div className={components.loading.container}>
        <div className="text-center">
          <div className={`${components.loading.spinner} mx-auto mb-4`}></div>
          <p className={components.loading.text}>Chargement des portes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 mb-40">
      {/* Header sticky (optionnel - peut être géré par le parent) */}
      {!hideHeader && (
        <div
          className={`top-0 z-100 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 bg-transparent border-b border-border/50`}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={defaultBackHandler}
            className={`flex items-center gap-2 ${getButtonClasses('primary')} w-full md:w-auto justify-center md:justify-start h-9`}
          >
            <ArrowLeft className="h-4 w-4" />
            {backButtonText}
          </Button>
        </div>
      )}

      <div className="mb-3 md:mb-4">
        {/* Accès rapides aux étages (masqué si customFilters gère l'en-tête) */}
        {!customFilters && etagesDisponibles.length > 0 && (
          <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs ${base.text.muted}`}>Accès rapide aux étages</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 sm:gap-2">
              {etagesDisponibles.map(item => {
                const etage = item.etage
                const isSelected = selectedFloor === etage
                return (
                  <Button
                    key={etage}
                    variant={isSelected ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleEtageClick(etage)}
                    className={`h-9 ${isSelected ? '' : `${base.bg.muted} ${base.text.primary} hover:${colors.primary.bgLight} border ${base.border.default}`} font-semibold`}
                  >
                    {etage}
                    <span
                      className={`ml-1 text-[10px] ${isSelected ? 'text-white/80' : base.text.muted}`}
                    >
                      ({item.count})
                    </span>
                  </Button>
                )
              })}
            </div>
          </div>
        )}

        {/* Filtres par statut (conditionnels) */}
        {showStatusFilters && (
          <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 mb-4">
            <StatusFilters
              statutOptions={statutOptions}
              selectedStatuts={selectedStatuts}
              onStatutToggle={onStatutToggle}
              onClearAll={onClearStatutFilters}
              portesCount={portesCountByStatus}
            />
          </div>
        )}

        {/* Filtres personnalisés additionnels */}
        {customFilters}

        {/* Stats Cards avec actions rapides - masquées si customFilters gère l'en-tête */}
        {!readOnly && !customFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5 md:gap-3 mb-4">
            <Card className={`${base.bg.card} ${base.border.card}`}>
              <CardContent className="p-2 sm:p-2.5 md:p-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] sm:text-xs ${base.text.muted} mb-0.5 truncate`}>
                      Couverture
                    </p>
                    <p className={`text-base sm:text-lg md:text-xl font-bold ${base.text.primary}`}>
                      {stats.tauxVisite}%
                    </p>
                  </div>
                  <div className="p-1 sm:p-1.5 md:p-2 rounded-lg border border-gray-200 bg-gray-50 shrink-0">
                    <Eye
                      className={`h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 ${base.icon.default}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`${base.bg.card} ${base.border.card}`}>
              <CardContent className="p-2 sm:p-2.5 md:p-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] sm:text-xs ${base.text.muted} mb-0.5 truncate`}>
                      Contrats signés
                    </p>
                    <p className={`text-base sm:text-lg md:text-xl font-bold ${base.text.primary}`}>
                      {stats.contratsSigne}
                    </p>
                  </div>
                  <div className="p-1 sm:p-1.5 md:p-2 rounded-lg border border-gray-200 bg-gray-50 shrink-0">
                    <CheckCircle2
                      className={`h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 ${base.icon.default}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`${base.bg.card} ${base.border.card}`}>
              <CardContent className="p-2 sm:p-2.5 md:p-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] sm:text-xs ${base.text.muted} mb-0.5 truncate`}>
                      RDV programmés
                    </p>
                    <p className={`text-base sm:text-lg md:text-xl font-bold ${base.text.primary}`}>
                      {stats.rdvPris}
                    </p>
                  </div>
                  <div className="p-1 sm:p-1.5 md:p-2 rounded-lg border border-gray-200 bg-gray-50 shrink-0">
                    <Building2
                      className={`h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 ${base.icon.default}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`${base.bg.card} ${base.border.card}`}>
              <CardContent className="p-2 sm:p-2.5 md:p-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] sm:text-xs ${base.text.muted} mb-0.5 truncate`}>
                      Repassages
                    </p>
                    <p className={`text-base sm:text-lg md:text-xl font-bold ${base.text.primary}`}>
                      {stats.repassages}
                    </p>
                  </div>
                  <div className="p-1 sm:p-1.5 md:p-2 rounded-lg border border-gray-200 bg-gray-50 shrink-0">
                    <RotateCcw
                      className={`h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 ${base.icon.default}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Informations de l'immeuble - masquées si customFilters gère l'en-tête */}
        {!customFilters && (
          <Card className={`${base.bg.card} ${base.border.card} shadow-md mb-3 md:mb-4`}>
            <CardContent className="p-3 sm:p-3.5 md:p-4">
              {/* Adresse principale */}
              <div className="flex items-start gap-2 sm:gap-2.5 mb-3">
                <div className={`p-1.5 rounded-lg ${colors.primary.bgLight} shrink-0`}>
                  <MapPin
                    className={`h-4 w-4 sm:h-4.5 sm:w-4.5 md:h-5 md:w-5 ${colors.primary.text}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[10px] sm:text-xs ${base.text.muted} mb-0.5 uppercase tracking-wide`}
                  >
                    Adresse
                  </p>
                  <h1
                    className={`text-sm sm:text-base md:text-lg font-bold ${base.text.primary} leading-tight wrap-break-word`}
                  >
                    {immeuble?.adresse || 'Chargement...'}
                  </h1>
                </div>
              </div>

              {immeuble?.createdAt && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className={`text-xs ${base.text.muted}`}>
                    Créé le{' '}
                    {new Date(immeuble.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions additionnelles */}
        {additionalActions}
      </div>

      {/* Liste des portes groupées par étage */}
      <div className="space-y-4 mb-20 sm:mb-4">
        {portesByEtage.map(({ etage, portes: portesEtage }) => (
          <div key={etage} className="space-y-3">
            {/* En-tête de l'étage */}
            <div
              ref={el => (etageRefs.current[etage] = el)}
              className="flex items-center space-x-2 sm:space-x-3 scroll-mt-32"
            >
              <div className={`h-px flex-1 ${base.border.default}`}></div>
              <div
                className={`px-3 sm:px-4 py-2 sm:py-2.5 ${colors.primary.bgLight} ${colors.primary.textLight} rounded-full border ${colors.primary.border} font-bold text-sm sm:text-base shadow-md`}
              >
                <h3>
                  Étage {etage} ({portesEtage.length} porte{portesEtage.length > 1 ? 's' : ''})
                </h3>
              </div>
              <div className={`h-px flex-1 ${base.border.default}`}></div>
            </div>

            {/* Grille des portes pour cet étage */}
            <div className="grid grid-cols-1 gap-3">
              {portesEtage.map(porte => (
                <PorteCardOriginal
                  key={porte.id}
                  porte={porte}
                  statutOptions={statutOptions}
                  onQuickStatusChange={onQuickStatusChange}
                  onEdit={onPorteEdit}
                  onRepassageChange={onRepassageChange}
                  readOnly={readOnly}
                />
              ))}

              {/* Boutons pour ajouter/supprimer une porte à cet étage (mode édition seulement) */}
              {!readOnly && (onAddPorteToEtage || onRemovePorteFromEtage) && (
                <div className="flex justify-center gap-2 mt-2">
                  {onAddPorteToEtage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAddPorteToEtage(parseInt(etage))}
                      disabled={addingPorteToEtage}
                      className={`h-12 px-6 text-sm font-medium ${colors.success.bgLight} ${colors.success.text} hover:${colors.success.bg} border-2 border-dashed ${colors.success.border} transition-all duration-200 hover:border-solid`}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {addingPorteToEtage ? 'Ajout...' : 'Ajouter porte'}
                    </Button>
                  )}
                  {onRemovePorteFromEtage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemovePorteFromEtage(parseInt(etage))}
                      className="h-12 px-6 text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 border-2 border-dashed border-red-300 transition-all duration-200 hover:border-solid"
                    >
                      <Minus className="h-4 w-4 mr-2" />
                      Supprimer porte
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Boutons pour ajouter/supprimer un étage complet (mode édition seulement) */}
        {!readOnly && (onAddEtage || onRemoveEtage) && portesByEtage.length > 0 && (
          <div className="flex justify-center gap-2 pt-6">
            {onAddEtage && (
              <Button
                variant="ghost"
                size="lg"
                onClick={onAddEtage}
                disabled={addingEtage}
                className={`h-14 px-8 text-base font-medium ${colors.primary.bgLight} ${colors.primary.text} hover:${colors.primary.bg} border-2 border-dashed ${colors.primary.border} transition-all duration-200 hover:border-solid`}
              >
                <Plus className="h-5 w-5 mr-3" />
                {addingEtage ? 'Ajout en cours...' : 'Ajouter un étage'}
              </Button>
            )}
            {onRemoveEtage && (
              <Button
                variant="ghost"
                size="lg"
                onClick={() => onRemoveEtage()}
                className="h-14 px-8 text-base font-medium bg-red-50 text-red-700 hover:bg-red-100 border-2 border-dashed border-red-300 transition-all duration-200 hover:border-solid"
              >
                <Minus className="h-5 w-5 mr-3" />
                Supprimer dernier étage
              </Button>
            )}
          </div>
        )}

        {/* SENTINEL FOR INFINITE SCROLL */}
        {visibleCount < allFilteredPortes.length && (
          <div ref={loaderRef} className="py-4 text-center opacity-50">
            Chargement de la suite...
          </div>
        )}
      </div>

      {/* Loader de pagination */}
      {isFetchingMore && (
        <div className="py-4 text-center">
          <div className={`${components.loading.spinner} mx-auto mb-2 h-6! w-6!`}></div>
          <p className="text-xs text-muted-foreground">Chargement de la suite...</p>
        </div>
      )}

      {/* Message quand aucune porte ne correspond aux filtres */}
      {portesByEtage.length === 0 && (
        <div className="text-center py-12">
          <Building2 className={`h-12 w-12 mx-auto ${base.icon.default} mb-4`} />
          <h3 className={`text-lg font-medium ${base.text.primary} mb-2`}>
            {filteredStats.hasFilters
              ? 'Aucune porte ne correspond aux filtres'
              : 'Aucune porte trouvée'}
          </h3>
          <p className={base.text.muted}>
            {filteredStats.hasFilters
              ? 'Essayez de modifier vos critères de filtrage'
              : "Aucune porte n'est disponible pour cet immeuble"}
          </p>
          {filteredStats.hasFilters && onClearStatutFilters && (
            <Button variant="outline" size="sm" onClick={onClearStatutFilters} className="mt-3">
              Effacer les filtres
            </Button>
          )}
        </div>
      )}

      {/* Bouton flottant "Remonter" */}
      <ScrollToTopButton targetElementRef={scrollTarget} buttonText={scrollTargetText} />
    </div>
  )
}
