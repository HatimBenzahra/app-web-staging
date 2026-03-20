import { useState, useMemo, useCallback } from 'react'
import {
  useRanking,
  useGamificationOffres,
  useBadgeDefinitions,
  useMappingSuggestions,
  useSyncOffres,
  useSyncContrats,
  useComputeRanking,
  useEvaluateBadges,
  useSeedBadges,
  useConfirmMapping,
  useRemoveMapping,
  useUpdateOffrePoints,
  useUpdateOffreBadgeProductKey,
} from '@/hooks/metier/api/gamification'

// Périodes disponibles pour le classement
export const RANK_PERIODS = [
  { value: 'DAILY', label: 'Journalier' },
  { value: 'WEEKLY', label: 'Hebdomadaire' },
  { value: 'MONTHLY', label: 'Mensuel' },
  { value: 'QUARTERLY', label: 'Trimestriel' },
  { value: 'YEARLY', label: 'Annuel' },
]

// Catégories de badges
export const BADGE_CATEGORIES = [
  { value: 'all', label: 'Toutes les catégories' },
  { value: 'PROGRESSION', label: 'Progression' },
  { value: 'PRODUIT', label: 'Produit' },
  { value: 'PERFORMANCE', label: 'Performance' },
  { value: 'TROPHEE', label: 'Trophée' },
]

// Clés produit pour les badges
export const BADGE_PRODUCT_KEYS = [
  { value: 'NONE', label: 'Aucune' },
  { value: 'MOBILE', label: 'Mobile' },
  { value: 'FIBRE', label: 'Fibre' },
  { value: 'DEPANSSUR', label: 'DépannSûr' },
  { value: 'ELEC_GAZ', label: 'Élec/Gaz' },
  { value: 'CONCIERGERIE', label: 'Conciergerie' },
  { value: 'MONDIAL_TV', label: 'Mondial TV' },
  { value: 'ASSURANCE', label: 'Assurance' },
]

/**
 * Calcule la clé de période en fonction du type de période
 */
function computePeriodKey(period) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  switch (period) {
    case 'DAILY':
      return `${year}-${month}-${day}`
    case 'WEEKLY': {
      // ISO week number
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
      return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
    }
    case 'MONTHLY':
      return `${year}-${month}`
    case 'QUARTERLY': {
      const quarter = Math.ceil((now.getMonth() + 1) / 3)
      return `${year}-Q${quarter}`
    }
    case 'YEARLY':
      return `${year}`
    default:
      return `${year}-${month}`
  }
}

export function useGamificationLogic() {
  // --- État UI ---
  const [activeTab, setActiveTab] = useState('classement')
  const [rankPeriod, setRankPeriod] = useState('MONTHLY')
  const [badgeCategoryFilter, setBadgeCategoryFilter] = useState('all')
  const [syncResults, setSyncResults] = useState({})
  const [editingOffre, setEditingOffre] = useState(null)
  const [includeContratFinie, setIncludeContratFinie] = useState(false)

  // --- Clé de période calculée ---
  const periodKey = useMemo(() => computePeriodKey(rankPeriod), [rankPeriod])

  // --- Données (queries) ---
  const {
    data: ranking,
    loading: rankingLoading,
    error: rankingError,
    refetch: refetchRanking,
  } = useRanking(rankPeriod, periodKey, includeContratFinie)

  const {
    data: offres,
    loading: offresLoading,
    error: offresError,
    refetch: refetchOffres,
  } = useGamificationOffres(true)

  const {
    data: allBadges,
    loading: badgesLoading,
    error: badgesError,
    refetch: refetchBadges,
  } = useBadgeDefinitions(undefined, true)

  const {
    data: mappingSuggestions,
    loading: mappingLoading,
    error: mappingError,
    refetch: refetchMapping,
  } = useMappingSuggestions()

  // --- Mutations ---
  const { mutate: computeRanking, loading: computeRankingLoading } = useComputeRanking()
  const { mutate: syncOffresMut, loading: syncOffresLoading } = useSyncOffres()
  const { mutate: syncContratsMut, loading: syncContratsLoading } = useSyncContrats()
  const { mutate: evaluateBadgesMut, loading: evaluateBadgesLoading } = useEvaluateBadges()
  const { mutate: seedBadgesMut, loading: seedBadgesLoading } = useSeedBadges()
  const { mutate: confirmMappingMut, loading: confirmMappingLoading } = useConfirmMapping()
  const { mutate: updatePointsMut, loading: updatePointsLoading } = useUpdateOffrePoints()
  const { mutate: updateBadgeKeyMut, loading: updateBadgeKeyLoading } =
    useUpdateOffreBadgeProductKey()
  const { mutate: removeMappingMut, loading: removeMappingLoading } = useRemoveMapping()

  // --- Badges filtrés ---
  const filteredBadges = useMemo(() => {
    if (!allBadges) return []
    if (badgeCategoryFilter === 'all') return allBadges
    return allBadges.filter(b => b.category === badgeCategoryFilter)
  }, [allBadges, badgeCategoryFilter])

  // --- Badge stats ---
  const badgeStats = useMemo(() => {
    if (!allBadges) return { total: 0, progression: 0, produit: 0, performance: 0, trophee: 0 }
    return {
      total: allBadges.length,
      progression: allBadges.filter(b => b.category === 'PROGRESSION').length,
      produit: allBadges.filter(b => b.category === 'PRODUIT').length,
      performance: allBadges.filter(b => b.category === 'PERFORMANCE').length,
      trophee: allBadges.filter(b => b.category === 'TROPHEE').length,
    }
  }, [allBadges])

  // --- Mapping stats ---
  const mappingStats = useMemo(() => {
    if (!mappingSuggestions) return { total: 0, mapped: 0, pending: 0 }
    return {
      total: mappingSuggestions.length,
      mapped: mappingSuggestions.filter(m => m.alreadyMapped).length,
      pending: mappingSuggestions.filter(m => !m.alreadyMapped).length,
    }
  }, [mappingSuggestions])

  // --- Actions ---
  const handleComputeRanking = useCallback(async () => {
    try {
      const result = await computeRanking({ period: rankPeriod, periodKey })
      setSyncResults(prev => ({
        ...prev,
        ranking: { success: true, message: result.message || 'Classement recalculé' },
      }))
      refetchRanking()
    } catch (err) {
      setSyncResults(prev => ({
        ...prev,
        ranking: { success: false, message: err.message || 'Erreur' },
      }))
    }
  }, [computeRanking, rankPeriod, periodKey, refetchRanking])

  const handleSyncOffres = useCallback(async () => {
    try {
      const result = await syncOffresMut()
      setSyncResults(prev => ({
        ...prev,
        offres: {
          success: true,
          message: `${result.created} créées, ${result.updated} mises à jour`,
        },
      }))
      refetchOffres()
    } catch (err) {
      setSyncResults(prev => ({
        ...prev,
        offres: { success: false, message: err.message || 'Erreur' },
      }))
    }
  }, [syncOffresMut, refetchOffres])

  const handleSyncContrats = useCallback(async () => {
    try {
      const result = await syncContratsMut()
      setSyncResults(prev => ({
        ...prev,
        contrats: {
          success: true,
          message: `${result.created} créés, ${result.updated} mis à jour, ${result.skipped} ignorés`,
        },
      }))
    } catch (err) {
      setSyncResults(prev => ({
        ...prev,
        contrats: { success: false, message: err.message || 'Erreur' },
      }))
    }
  }, [syncContratsMut])

  const handleEvaluateBadges = useCallback(async () => {
    try {
      const result = await evaluateBadgesMut()
      setSyncResults(prev => ({
        ...prev,
        badges: { success: true, message: `${result.awarded} badges attribués` },
      }))
      refetchBadges()
    } catch (err) {
      setSyncResults(prev => ({
        ...prev,
        badges: { success: false, message: err.message || 'Erreur' },
      }))
    }
  }, [evaluateBadgesMut, refetchBadges])

  const handleSeedBadges = useCallback(async () => {
    try {
      const result = await seedBadgesMut()
      setSyncResults(prev => ({
        ...prev,
        seed: { success: true, message: `${result.created} créés, ${result.skipped} existants` },
      }))
      refetchBadges()
    } catch (err) {
      setSyncResults(prev => ({
        ...prev,
        seed: { success: false, message: err.message || 'Erreur' },
      }))
    }
  }, [seedBadgesMut, refetchBadges])

  const handleConfirmMapping = useCallback(
    async suggestion => {
      try {
        await confirmMappingMut([
          {
            prowinId: suggestion.prowinId,
            winleadPlusId: suggestion.winleadPlusId,
            type: suggestion.prowinType,
          },
        ])
        refetchMapping()
      } catch (err) {
        console.error('Erreur lors de la confirmation du mapping:', err)
      }
    },
    [confirmMappingMut, refetchMapping]
  )

  const handleRemoveMapping = useCallback(
    async suggestion => {
      try {
        await removeMappingMut({
          prowinId: suggestion.prowinId,
          type: suggestion.prowinType,
        })
        refetchMapping()
      } catch (err) {
        console.error('Erreur lors de la suppression du mapping:', err)
      }
    },
    [removeMappingMut, refetchMapping]
  )

  const handleUpdateOffrePoints = useCallback(
    async (offreId, points) => {
      try {
        const normalizedPoints = parseInt(points, 10)
        if (!Number.isFinite(normalizedPoints)) {
          return
        }

        await updatePointsMut({ offreId, points: Math.max(0, normalizedPoints) })
        setEditingOffre(null)
        refetchOffres()
      } catch (err) {
        console.error('Erreur lors de la mise à jour des points:', err)
      }
    },
    [updatePointsMut, refetchOffres]
  )

  const handleUpdateBadgeProductKey = useCallback(
    async (offreId, badgeProductKey) => {
      try {
        const normalizedValue = badgeProductKey === 'NONE' ? undefined : badgeProductKey
        await updateBadgeKeyMut({ offreId, badgeProductKey: normalizedValue })
        refetchOffres()
      } catch (err) {
        console.error('Erreur lors de la mise à jour de la clé badge:', err)
      }
    },
    [updateBadgeKeyMut, refetchOffres]
  )

  // --- États combinés ---
  const loading = rankingLoading || offresLoading || badgesLoading || mappingLoading
  const error = rankingError || offresError || badgesError || mappingError

  return {
    // UI state
    activeTab,
    setActiveTab,
    rankPeriod,
    setRankPeriod,
    periodKey,
    badgeCategoryFilter,
    setBadgeCategoryFilter,
    editingOffre,
    setEditingOffre,
    includeContratFinie,
    setIncludeContratFinie,
    syncResults,

    // Data
    ranking,
    offres,
    filteredBadges,
    badgeStats,
    mappingSuggestions,
    mappingStats,

    // Loading states
    loading,
    error,
    rankingLoading,
    offresLoading,
    badgesLoading,
    mappingLoading,
    computeRankingLoading,
    syncOffresLoading,
    syncContratsLoading,
    evaluateBadgesLoading,
    seedBadgesLoading,
    confirmMappingLoading,
    removeMappingLoading,
    updatePointsLoading,
    updateBadgeKeyLoading,

    // Actions
    handleComputeRanking,
    handleSyncOffres,
    handleSyncContrats,
    handleEvaluateBadges,
    handleSeedBadges,
    handleConfirmMapping,
    handleRemoveMapping,
    handleUpdateOffrePoints,
    handleUpdateBadgeProductKey,

    // Refetchers
    refetchRanking,
    refetchOffres,
    refetchBadges,
    refetchMapping,
  }
}
