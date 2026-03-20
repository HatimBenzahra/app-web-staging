import React, { forwardRef } from 'react'
import { Layers, DoorOpen, Filter, CheckCircle, Clock, X } from 'lucide-react'
import { useCommercialTheme } from '@/hooks/ui/use-commercial-theme'

const PorteListFilters = forwardRef(
  (
    {
      activeFilters,
      clearAllFilters,
      toggleFilter,
      statusCounts,
      statutOptions,
      immeuble,
      selectedFloor,
      statsData,
      totalPortes,
      onFloorSelect,
    },
    ref
  ) => {
    const { colors, base } = useCommercialTheme()

    // Statistiques clés (vraies données uniquement)
    const totalDoorsCount = statsData ? statsData.totalPortes : totalPortes
    const activeFilterCount = activeFilters.length
    const contratsSigne = statsData ? statsData.contratsSigne || 0 : 0
    const portesNonVisitees = statsData ? statsData.nonVisitees || 0 : 0

    // Calculer les étages disponibles avec leurs comptages
    const etagesDisponibles = statsData?.portesParEtage
      ? [...statsData.portesParEtage].sort((a, b) => b.etage - a.etage)
      : []

    return (
      <div ref={ref} className="space-y-4">
        {/* Carte combinée Stats + Navigation Étages */}
        <div
          className={`${base.bg.card} border ${base.border.default} rounded-2xl shadow-md overflow-hidden`}
        >
          {/* Section Stats en haut - Design compact horizontal */}
          <div className="px-4 py-3 bg-gray-50">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Info structure */}
              {immeuble && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Layers className={`h-4 w-4 ${colors.primary.text}`} />
                    <span className={`${base.text.muted} font-medium`}>
                      {immeuble.nbEtages} étages
                    </span>
                  </div>
                  <span className={`${base.text.muted}`}>•</span>
                  <div className="flex items-center gap-1.5">
                    <DoorOpen className={`h-4 w-4 ${colors.primary.text}`} />
                    <span className={`${base.text.muted} font-medium`}>
                      {immeuble.nbPortesParEtage} p/étage
                    </span>
                  </div>
                </div>
              )}

              {/* Badges stats compacts */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 border border-blue-200">
                  <DoorOpen className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-bold text-blue-700">{totalDoorsCount}</span>
                  <span className="text-xs text-blue-600">total</span>
                </div>

                {statsData && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 border border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-bold text-green-700">{contratsSigne}</span>
                    <span className="text-xs text-green-600">contrats</span>
                  </div>
                )}

                {statsData && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-100 border border-orange-200">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-bold text-orange-700 dark:text-orange-300">
                      {portesNonVisitees}
                    </span>
                    <span className="text-xs text-orange-600/70 dark:text-orange-400/70">
                      restantes
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navigation par Étages */}
          {etagesDisponibles.length > 0 && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3
                  className={`text-xs font-bold uppercase tracking-wider ${base.text.muted} flex items-center gap-1.5`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Étages
                </h3>
                {selectedFloor && (
                  <button
                    onClick={() => onFloorSelect && onFloorSelect(null)}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Réinitialiser
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {etagesDisponibles.map(item => {
                  const etage = item.etage
                  const count = item.count
                  const isSelected = selectedFloor === etage

                  return (
                    <button
                      key={etage}
                      onClick={() => onFloorSelect && onFloorSelect(isSelected ? null : etage)}
                      className={`group relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all duration-200 min-w-max ${
                        isSelected
                          ? 'bg-linear-to-r from-blue-500 to-indigo-600 text-white shadow-md hover:shadow-lg scale-[1.02] border border-blue-600'
                          : `${base.bg.muted} ${base.text.primary} hover:bg-blue-50 dark:hover:bg-blue-900/20 border ${base.border.default} hover:border-blue-400 dark:hover:border-blue-500`
                      }`}
                    >
                      <span>Étage {etage}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md ${
                          isSelected ? 'bg-white/20' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {count} portes
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Filtres par Statut - Design compact */}
        <div className={`${base.bg.card} border ${base.border.default} rounded-2xl p-4 shadow-md`}>
          <div className="flex items-center justify-between mb-3">
            <h3
              className={`text-xs font-bold uppercase tracking-wider ${base.text.muted} flex items-center gap-1.5`}
            >
              <Filter className="h-3.5 w-3.5" />
              Filtrer par statut
            </h3>
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white text-xs font-bold">
                  {activeFilterCount}
                </span>
                <button
                  onClick={clearAllFilters}
                  className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                >
                  Effacer
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Bouton "Tout voir" */}
            <button
              onClick={clearAllFilters}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeFilters.length === 0
                  ? 'bg-linear-to-r from-blue-500 to-indigo-600 text-white shadow-md scale-[1.02] border border-blue-600'
                  : `${base.bg.muted} ${base.text.muted} border ${base.border.default} hover:border-blue-400 hover:bg-blue-50`
              }`}
            >
              <span>Tous</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-xs ${
                  activeFilters.length === 0 ? 'bg-white/20' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {statsData ? statsData.totalPortes : totalPortes}
              </span>
            </button>

            {/* Boutons de statut */}
            {statutOptions
              .filter(
                option => option.value !== 'CONTRAT_SIGNE' && option.value !== 'NECESSITE_REPASSAGE'
              )
              .map(option => {
                const count = statusCounts.byStatus.get(option.value) || 0
                const isActive = activeFilters.includes(option.value)
                const IconComponent = option.icon

                return (
                  <button
                    key={option.value}
                    onClick={() => toggleFilter(option.value)}
                    className={`group flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? `${option.color} shadow-md scale-[1.02] border ${option.borderColor || 'border-transparent'}`
                        : `${base.bg.muted} ${base.text.muted} border ${base.border.default} hover:border-gray-400 opacity-80 hover:opacity-100`
                    }`}
                  >
                    <IconComponent className={`h-4 w-4 ${isActive ? '' : 'opacity-70'}`} />
                    <span>{option.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-xs ${
                        isActive ? 'bg-white/20' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
          </div>
        </div>
      </div>
    )
  }
)

PorteListFilters.displayName = 'PorteListFilters'
export default PorteListFilters
