import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useStatutOptions } from '../hooks/useStatutOptions'
import PortesTemplate from './PortesTemplate'
import PorteListFilters from './PorteListFilters'

/**
 * Page Vue Liste des portes
 * Gère le filtrage local et l'affichage sous forme de liste
 */
export default function PortesListe({
  portes = [],
  statsData,
  loading,
  immeuble,
  immeubleId,
  isFetchingMore,
  onEdit,
  onQuickChange,
  onRepassageChange,
  onBack,
  onAddEtage,
  onAddPorteToEtage,
  onRemoveEtage,
  onRemovePorteFromEtage,
  addingEtage,
  addingPorteToEtage,
  selectedFloor,
  onFloorSelect,
}) {
  const etageSelecteurRef = useRef(null)

  // Configuration des statuts
  const statutOptions = useStatutOptions()

  // Filtres (lecture/écriture localStorage sécurisée)
  const [activeFilters, setActiveFilters] = useState(() => {
    try {
      const saved = localStorage.getItem(`filters-${immeubleId}`)
      const parsed = saved ? JSON.parse(saved) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      if (immeubleId) {
        localStorage.setItem(`filters-${immeubleId}`, JSON.stringify(activeFilters))
      }
    } catch {
      /* ignore */
    }
  }, [activeFilters, immeubleId])

  // Handlers filtres
  const toggleFilter = useCallback(filterValue => {
    setActiveFilters(prev =>
      prev.includes(filterValue) ? prev.filter(f => f !== filterValue) : [...prev, filterValue]
    )
  }, [])

  const clearAllFilters = useCallback(() => {
    setActiveFilters([])
    // On ne clear pas selectedFloor ici car c'est géré par le parent, mais on pourrait demander au parent de le faire si on voulait "tout" resetter
    if (onFloorSelect) onFloorSelect(null)
  }, [onFloorSelect])

  // Comptes par statut mémoïsés
  const statusCounts = useMemo(() => {
    if (statsData) {
      const m = new Map()
      // S'assurer que les compteurs ne sont jamais négatifs
      m.set('NON_VISITE', Math.max(0, statsData.nonVisitees || 0))
      m.set('CONTRAT_SIGNE', Math.max(0, statsData.contratsSigne || 0))
      m.set('RENDEZ_VOUS_PRIS', Math.max(0, statsData.rdvPris || 0))
      m.set('ABSENT', Math.max(0, statsData.absent || 0))
      m.set('ARGUMENTE', Math.max(0, statsData.argumente || 0))
      m.set('REFUS', Math.max(0, statsData.refus || 0))
      // S'assurer que le total sans contrat n'est pas négatif
      const totalSansContrat = Math.max(
        0,
        (statsData.totalPortes || 0) - (statsData.contratsSigne || 0)
      )
      return { byStatus: m, totalSansContrat }
    }

    // Fallback local
    const m = new Map()
    let totalSansContrat = 0
    for (const p of portes) {
      m.set(p.statut, (m.get(p.statut) || 0) + 1)
      if (p.statut !== 'CONTRAT_SIGNE') totalSansContrat++
    }
    return { byStatus: m, totalSansContrat }
  }, [portes, statsData])

  // Filtrage des portes
  const filteredPortes = useMemo(() => {
    let result = portes
    // Filtrage local par statut
    if (activeFilters.length > 0) {
      result = result.filter(porte => activeFilters.includes(porte.statut))
    }
    return result
  }, [portes, activeFilters])

  // Composant de filtres
  const customFilters = useMemo(
    () => (
      <PorteListFilters
        ref={etageSelecteurRef}
        activeFilters={activeFilters}
        clearAllFilters={clearAllFilters}
        toggleFilter={toggleFilter}
        statusCounts={statusCounts}
        statutOptions={statutOptions}
        immeuble={immeuble}
        selectedFloor={selectedFloor}
        statsData={statsData}
        totalPortes={portes.length}
        onFloorSelect={onFloorSelect}
      />
    ),
    [
      activeFilters,
      clearAllFilters,
      toggleFilter,
      statusCounts,
      statutOptions,
      immeuble,
      selectedFloor,
      statsData,
      portes.length,
      onFloorSelect,
    ]
  )

  return (
    <PortesTemplate
      portes={filteredPortes}
      statsData={statsData}
      loading={loading}
      isFetchingMore={isFetchingMore}
      readOnly={false}
      showStatusFilters={false} // On utilise nos customFilters
      onPorteEdit={onEdit}
      onQuickStatusChange={onQuickChange}
      onRepassageChange={onRepassageChange}
      onBack={onBack}
      backButtonText="Retour"
      scrollTarget={etageSelecteurRef}
      scrollTargetText="Étages"
      customFilters={customFilters}
      onAddPorteToEtage={onAddPorteToEtage}
      onAddEtage={onAddEtage}
      onRemoveEtage={onRemoveEtage}
      onRemovePorteFromEtage={onRemovePorteFromEtage}
      addingPorteToEtage={addingPorteToEtage}
      addingEtage={addingEtage}
      onFloorSelect={onFloorSelect}
      selectedFloor={selectedFloor}
      hideHeader={true}
    />
  )
}
