import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  UserX,
  X,
  Calendar,
  MessageSquare,
  FileSignature,
  Zap,
  Building2,
  Filter,
  Save,
  CheckCircle2,
  Sun,
  Moon,
  AlertTriangle,
  Pencil,
  FastForward,
  History,
  Plus,
  Minus,
  DoorOpen,
  Layers,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useCommercialTheme } from '@/hooks/ui/use-commercial-theme'
import { StatutPorte } from '@/constants/domain/porte-status'
import { useErrorToast } from '@/hooks/utils/ui/use-error-toast'

const getEtageValue = etage => (typeof etage === 'number' ? etage : Number(etage) || 0)

const comparePortesDesc = (a, b) => {
  const etageDiff = getEtageValue(b.etage) - getEtageValue(a.etage)
  if (etageDiff !== 0) return etageDiff
  return String(b.numero ?? '').localeCompare(String(a.numero ?? ''), 'fr', {
    numeric: true,
    sensitivity: 'base',
  })
}

/**
 * Mode Prospection Rapide - Affiche une porte à la fois pour une mise à jour ultra-rapide
 */
export default function ProspectionRapideMode({
  portes = [],
  statsData,
  onQuickStatusChange,
  statutOptions,
  immeuble,
  onOpenEditModal,
  onRepassageChange,
  loadMore,
  hasMore,
  isFetchingMore,
  onAddEtage,
  onAddPorteToEtage,
  onRemoveEtage,
  onRemovePorteFromEtage,
  addingEtage = false,
  addingPorteToEtage = false,
}) {
  // ----------------------------------------------------------------------
  // 1. HOOKS & CONSTANTES
  // ----------------------------------------------------------------------
  const { colors, base } = useCommercialTheme()
  const { showSuccess } = useErrorToast()

  // Index de la porte courante
  const [currentIndex, setCurrentIndex] = useState(0)

  // Commentaire rapide (inline)
  const [quickComment, setQuickComment] = useState('')
  const [showCommentInput, setShowCommentInput] = useState(false)

  // Auto-avancer après mise à jour
  const [autoAdvance, setAutoAdvance] = useState(() => {
    try {
      const saved = localStorage.getItem('rapidModeAutoAdvance')
      return saved !== null ? JSON.parse(saved) : true
    } catch {
      return true
    }
  })
  const pendingAutoAdvanceRef = useRef(null)

  const toggleAutoAdvance = () => {
    setAutoAdvance(prev => {
      const newVal = !prev
      localStorage.setItem('rapidModeAutoAdvance', JSON.stringify(newVal))
      return newVal
    })
  }

  // Filtre : type de portes à afficher
  const [filterMode, setFilterMode] = useState('all')

  // Pour le mode repassage
  const [showRepassageChoice, setShowRepassageChoice] = useState(false)
  const [previousStatut, setPreviousStatut] = useState(null) // Pour annuler le changement de statut

  // Confirmation state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    statut: null,
  })

  // Confirmation de suppression (UX sécurisée)
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    type: null, // 'porte' | 'etage'
    etage: null,
  })

  // Affichage de la carte de visualisation
  const [showVisualization, setShowVisualization] = useState(() => {
    try {
      const saved = localStorage.getItem('rapidModeShowVisualization')
      return saved !== null ? JSON.parse(saved) : true
    } catch {
      return true
    }
  })

  const toggleVisualization = () => {
    setShowVisualization(prev => {
      const newVal = !prev
      localStorage.setItem('rapidModeShowVisualization', JSON.stringify(newVal))
      return newVal
    })
  }

  // État pour la carte pliable du header
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem('rapidModeHeaderExpanded')
      return saved !== null ? JSON.parse(saved) : true
    } catch {
      return true
    }
  })

  const toggleHeaderExpanded = () => {
    setIsHeaderExpanded(prev => {
      const newVal = !prev
      localStorage.setItem('rapidModeHeaderExpanded', JSON.stringify(newVal))
      return newVal
    })
  }

  // ----------------------------------------------------------------------
  // 2. MEMOS & FILTRES
  // ----------------------------------------------------------------------
  // Calculer les portes filtrées selon le mode
  const filteredPortes = useMemo(() => {
    let result = portes
    switch (filterMode) {
      case 'non_visitees':
        result = portes.filter(p => p.statut === StatutPorte.NON_VISITE)
        break
      case 'absents':
        result = portes.filter(p => p.statut === StatutPorte.ABSENT)
        break
      case 'absents_matin':
        result = portes.filter(
          p => p.statut === StatutPorte.ABSENT && (p.nbRepassages || 0) === 1
        )
        break
      case 'absents_soir':
        result = portes.filter(
          p => p.statut === StatutPorte.ABSENT && (p.nbRepassages || 0) >= 2
        )
        break
      case 'rdv':
        result = portes.filter(p => p.statut === StatutPorte.RENDEZ_VOUS_PRIS)
        break
    }
    return [...result].sort(comparePortesDesc)
  }, [portes, filterMode])

  // Porte courante
  const currentPorte = filteredPortes[currentIndex]

  // Stats de progression
  const progressStats = useMemo(() => {
    const total = statsData?.totalPortes || portes.length
    const visited =
      total -
      (statsData?.nonVisitees || portes.filter(p => p.statut === StatutPorte.NON_VISITE).length)
    const percentage = total > 0 ? Math.round((visited / total) * 100) : 0
    return { total, visited, percentage, remaining: total - visited }
  }, [portes, statsData])

  // Calculer les étages cibles pour l'affichage
  const previousFloorTarget = useMemo(() => {
    if (!currentPorte) return null
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (filteredPortes[i].etage !== currentPorte.etage) {
        return filteredPortes[i].etage
      }
    }
    return null
  }, [currentPorte, currentIndex, filteredPortes])

  const nextFloorTarget = useMemo(() => {
    if (!currentPorte) return null
    for (let i = currentIndex + 1; i < filteredPortes.length; i++) {
      if (filteredPortes[i].etage !== currentPorte.etage) {
        return filteredPortes[i].etage
      }
    }
    return null
  }, [currentPorte, currentIndex, filteredPortes])

  // ----------------------------------------------------------------------
  // 3. NAVIGATION HANDLERS
  // ----------------------------------------------------------------------
  // Navigation
  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1))
    setShowCommentInput(false)
    setShowRepassageChoice(false)
    setPreviousStatut(null)
  }, [])

  const goToNext = useCallback(() => {
    // 1. Prefetch si on approche de la fin (ex: reste 3 portes)
    if (hasMore && !isFetchingMore && currentIndex >= filteredPortes.length - 3) {
      if (typeof loadMore === 'function') {
        loadMore()
      }
    }

    if (currentIndex < filteredPortes.length - 1) {
      // Cas normal : on avance
      setCurrentIndex(prev => prev + 1)
      setShowCommentInput(false)
      setShowRepassageChoice(false)
      setPreviousStatut(null)
    } else if (hasMore) {
      // Cas fin de liste mais il y en a d'autres au backend : on charge
      if (!isFetchingMore && typeof loadMore === 'function') {
        loadMore()
        // Note: Une fois chargé, le useEffect qui surveille filteredPortes.length pourrait ajuster currentIndex si nécessaire,
        // ou l'utilisateur devra cliquer à nouveau sur Suivant.
        // Pour une meilleure UX, on peut ne rien faire ici et laisser le chargement se faire via le prefetch,
        // mais si le prefetch a échoué ou n'a pas eu le temps, ce bloc assure le chargement explicite.
      }
    }
  }, [currentIndex, filteredPortes, hasMore, loadMore, isFetchingMore])

  // Navigation par étage
  const goToPreviousFloor = useCallback(() => {
    if (!currentPorte) return
    const currentFloor = currentPorte.etage

    // Chercher la première porte de l'étage précédent dans la liste filtrée
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (filteredPortes[i].etage !== currentFloor) {
        const targetFloor = filteredPortes[i].etage
        let targetIndex = i
        while (targetIndex > 0 && filteredPortes[targetIndex - 1].etage === targetFloor) {
          targetIndex--
        }
        setCurrentIndex(targetIndex)
        setQuickComment('')
        setShowCommentInput(false)
        setShowRepassageChoice(false)
        setPreviousStatut(null)
        return
      }
    }
  }, [currentIndex, filteredPortes, currentPorte])

  const goToNextFloor = useCallback(() => {
    if (!currentPorte) return
    const currentFloor = currentPorte.etage

    // Chercher la première porte de l'étage suivant
    for (let i = currentIndex + 1; i < filteredPortes.length; i++) {
      if (filteredPortes[i].etage !== currentFloor) {
        setCurrentIndex(i)
        setQuickComment('')
        setShowCommentInput(false)
        setShowRepassageChoice(false)
        setPreviousStatut(null)
        return
      }
    }
  }, [currentPorte, currentIndex, filteredPortes])

  // Vérifier si navigation étage possible
  const canGoPreviousFloor = useMemo(() => {
    if (!currentPorte || currentIndex === 0) return false
    return filteredPortes.some((p, i) => i < currentIndex && p.etage !== currentPorte.etage)
  }, [currentPorte, currentIndex, filteredPortes])

  const canGoNextFloor = useMemo(() => {
    if (!currentPorte || currentIndex >= filteredPortes.length - 1) return false
    return filteredPortes.some((p, i) => i > currentIndex && p.etage !== currentPorte.etage)
  }, [currentPorte, currentIndex, filteredPortes])

  // Trouver la prochaine porte non visitée
  const findNextUnvisited = useCallback(() => {
    for (let i = currentIndex + 1; i < filteredPortes.length; i++) {
      if (filteredPortes[i].statut === StatutPorte.NON_VISITE) {
        return i
      }
    }
    for (let i = 0; i < currentIndex; i++) {
      if (filteredPortes[i].statut === StatutPorte.NON_VISITE) {
        return i
      }
    }
    return -1
  }, [currentIndex, filteredPortes])

  const runAutoAdvance = useCallback(
    (delay = 300) => {
      if (!autoAdvance) return
      setTimeout(() => {
        const nextIndex = findNextUnvisited()
        if (nextIndex >= 0) {
          setCurrentIndex(nextIndex)
        } else if (currentIndex < filteredPortes.length - 1) {
          goToNext()
        }
        setQuickComment('')
        setShowCommentInput(false)
        setShowRepassageChoice(false)
        setPreviousStatut(null)
      }, delay)
    },
    [autoAdvance, findNextUnvisited, currentIndex, filteredPortes.length, goToNext]
  )

  // ----------------------------------------------------------------------
  // 4. ACTIONS & STATUTS
  // ----------------------------------------------------------------------
  // Gestion du clic sur un bouton statut
  const handleStatusClick = useCallback(
    newStatut => {
      if (!currentPorte) return
      pendingAutoAdvanceRef.current = null

      // Si RDV ou Contrat, on ouvre directement le modal
      if (newStatut === StatutPorte.RENDEZ_VOUS_PRIS || newStatut === StatutPorte.CONTRAT_SIGNE) {
        if (autoAdvance && currentPorte.id != null) {
          pendingAutoAdvanceRef.current = { id: currentPorte.id, statut: newStatut }
        }
        if (onOpenEditModal) {
          onOpenEditModal(currentPorte, newStatut, quickComment)
        }
        return
      }

      // Si Absent, on affiche DIRECTEMENT le choix de repassage (le choix agit comme confirmation)
      if (newStatut === StatutPorte.ABSENT) {
        // Sauvegarder le statut précédent pour permettre l'annulation
        setPreviousStatut(currentPorte.statut)
        setShowRepassageChoice(true)
        // On applique le changement de statut immédiatement (statut ABSENT par défaut en attendant choix repassage)
        onQuickStatusChange(currentPorte, newStatut, quickComment)
        return
      }

      // Pour les autres statuts (Refus, Argumenté...), on demande confirmation
      setConfirmDialog({
        isOpen: true,
        statut: newStatut,
      })
    },
    [currentPorte, onOpenEditModal, quickComment, onQuickStatusChange, autoAdvance]
  )

  // Confirmation et application du statut (Uniquement pour Refus/Argumenté maintenant)
  const handleConfirmStatusChange = useCallback(async () => {
    const { statut: newStatut } = confirmDialog
    if (!currentPorte || !newStatut) return

    setConfirmDialog({ isOpen: false, statut: null })

    // Application du statut
    await onQuickStatusChange(currentPorte, newStatut, quickComment)

    // Auto-avancer
    runAutoAdvance(1000)
  }, [currentPorte, confirmDialog, onQuickStatusChange, quickComment, runAutoAdvance])

  // Gestion du repassage
  const handleRepassageSelect = useCallback(
    async nbRepassages => {
      if (!currentPorte || !onRepassageChange) return

      const diff = nbRepassages - (currentPorte.nbRepassages || 0)
      if (diff !== 0) {
        await onRepassageChange(currentPorte, diff)
      }

      setShowRepassageChoice(false)
      setPreviousStatut(null) // Réinitialiser le statut précédent

      // Auto-avancer
      runAutoAdvance(300)
    },
    [currentPorte, onRepassageChange, runAutoAdvance]
  )

  // Annuler le changement de statut et restaurer l'état précédent
  const handleCancelAbsent = useCallback(async () => {
    if (!currentPorte || previousStatut === null) return

    // Restaurer le statut précédent
    await onQuickStatusChange(currentPorte, previousStatut, quickComment)
    setShowRepassageChoice(false)
    setPreviousStatut(null)
  }, [currentPorte, previousStatut, onQuickStatusChange, quickComment])

  useEffect(() => {
    const pending = pendingAutoAdvanceRef.current
    if (!pending) return

    if (!currentPorte || currentPorte.id !== pending.id) {
      pendingAutoAdvanceRef.current = null
      return
    }

    if (currentPorte.statut !== pending.statut) return

    pendingAutoAdvanceRef.current = null
    runAutoAdvance(300)
  }, [currentPorte?.id, currentPorte?.statut, runAutoAdvance, currentPorte])

  // Reset l'index si les portes filtrées changent
  useEffect(() => {
    if (currentIndex >= filteredPortes.length) {
      setCurrentIndex(Math.max(0, filteredPortes.length - 1))
    }
  }, [filteredPortes.length, currentIndex])

  // Reset quand on change de filtre
  useEffect(() => {
    setCurrentIndex(0)
    setShowRepassageChoice(false)
    setShowCommentInput(false)
    setQuickComment('')
    setPreviousStatut(null)
  }, [filterMode])

  // Sauvegarder uniquement le commentaire
  const handleSaveComment = useCallback(async () => {
    if (!currentPorte) return
    const currentStatus = currentPorte.statut
    await onQuickStatusChange(currentPorte, currentStatus, quickComment)
    setShowCommentInput(false)
    setQuickComment('')
  }, [currentPorte, quickComment, onQuickStatusChange])

  // Filters options
  const filterOptions = [
    {
      value: 'non_visitees',
      label: 'Non visitées',
      count: portes.filter(p => p.statut === StatutPorte.NON_VISITE).length,
    },
    {
      value: 'argumentes',
      label: 'Argumentés',
      count: portes.filter(p => p.statut === StatutPorte.ARGUMENTE).length,
    },
    {
      value: 'contrat_signe',
      label: 'Contrat signé',
      count: portes.filter(p => p.statut === StatutPorte.CONTRAT_SIGNE).length,
    },
    {
      value: 'refus',
      label: 'Refus',
      count: portes.filter(p => p.statut === StatutPorte.REFUS).length,
    },
    {
      value: 'absents',
      label: 'Absents',
      count: portes.filter(p => p.statut === StatutPorte.ABSENT).length,
    },
    {
      value: 'absents_matin',
      label: 'Absents matin',
      count: portes.filter(
        p => p.statut === StatutPorte.ABSENT && (p.nbRepassages || 0) === 1
      ).length,
    },
    {
      value: 'absents_soir',
      label: 'Absents soir',
      count: portes.filter(
        p => p.statut === StatutPorte.ABSENT && (p.nbRepassages || 0) >= 2
      ).length,
    },

    {
      value: 'rendez_vous_pris',
      label: 'Rendez-vous pris',
      count: portes.filter(p => p.statut === StatutPorte.RENDEZ_VOUS_PRIS).length,
    },
    { value: 'all', label: 'Toutes', count: portes.length },
  ]

  // Fonction pour retourner à la dernière porte traitée ou à la première non visitée (Reprendre)
  const handleResume = useCallback(() => {
    // 1. Chercher la première porte NON VISITÉE dans la liste filtrée
    const firstUnvisitedIndex = filteredPortes.findIndex(p => p.statut === StatutPorte.NON_VISITE)

    if (firstUnvisitedIndex !== -1) {
      setCurrentIndex(firstUnvisitedIndex)
      showSuccess ? showSuccess('Reprise à la première porte non visitée') : null
      return
    }

    // 2. Si toutes sont visitées, on cherche la toute dernière porte de la liste (ou on charge la suite)
    // On suppose que l'utilisateur veut aller à la fin de ce qu'il a fait
    if (filteredPortes.length > 0) {
      if (hasMore && !isFetchingMore) {
        // Si on a d'autres portes sur le serveur, on les charge
        loadMore()
        // On se met à la fin en attendant
        setCurrentIndex(filteredPortes.length - 1)
      } else {
        setCurrentIndex(filteredPortes.length - 1)
      }
    }
  }, [filteredPortes, hasMore, isFetchingMore, loadMore, showSuccess])

  // Organiser les portes par étage pour la visualisation
  const portesParEtage = useMemo(() => {
    const grouped = {}
    filteredPortes.forEach(porte => {
      if (!grouped[porte.etage]) {
        grouped[porte.etage] = []
      }
      grouped[porte.etage].push(porte)
    })
    return Object.entries(grouped).sort(([a], [b]) => Number(b) - Number(a))
  }, [filteredPortes])

  // Fonction pour obtenir la couleur selon le statut
  const getStatusColor = useCallback(statut => {
    switch (statut) {
      case StatutPorte.NON_VISITE:
        return 'bg-gray-300'
      case StatutPorte.ABSENT:
        return 'bg-orange-500'
      case StatutPorte.REFUS:
        return 'bg-red-500'
      case StatutPorte.RENDEZ_VOUS_PRIS:
        return 'bg-blue-500'
      case StatutPorte.ARGUMENTE:
        return 'bg-purple-500'
      case StatutPorte.CONTRAT_SIGNE:
        return 'bg-green-500'
      default:
        return 'bg-gray-400'
    }
  }, [])

  // Navigation vers une porte spécifique
  const goToPorte = useCallback(
    porteId => {
      const index = filteredPortes.findIndex(p => p.id === porteId)
      if (index !== -1) {
        setCurrentIndex(index)
        setShowCommentInput(false)
        setShowRepassageChoice(false)
        setPreviousStatut(null)
      }
    },
    [filteredPortes]
  )

  // ----------------------------------------------------------------------
  // 5. RENDER: EMPTY STATE
  // ----------------------------------------------------------------------
  // Si aucune porte à afficher
  if (filteredPortes.length === 0) {
    return (
      <div className="flex flex-col min-h-[60vh]">
        {/* Header */}
        <div className={`${base.bg.card} border-b ${base.border.default} p-4 rounded-t-xl`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${colors.primary.bgLight}`}>
                <Zap className={`h-5 w-5 ${colors.primary.text}`} />
              </div>
              <div>
                <h2 className={`font-bold text-lg ${base.text.primary}`}>Mode Rapide</h2>
                <p className={`text-xs ${base.text.muted}`}>{immeuble?.adresse}</p>
              </div>
            </div>
          </div>

          {/* Filtres */}
          <div className="flex flex-wrap gap-2">
            {filterOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilterMode(opt.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filterMode === opt.value
                    ? `${colors.primary.bg} text-white`
                    : `${base.bg.muted} ${base.text.muted} hover:${base.bg.card}`
                }`}
              >
                {opt.label} ({opt.count})
              </button>
            ))}
          </div>
        </div>

        {/* Message vide */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className={`p-6 rounded-full ${colors.success.bgLight} mb-6`}>
            <FileSignature className={`h-16 w-16 ${colors.success.text}`} />
          </div>
          <h2 className={`text-2xl font-bold ${base.text.primary} mb-3 text-center`}>
            🎉 Aucune porte dans ce filtre !
          </h2>
          <p className={`${base.text.muted} text-center mb-6`}>
            {filterMode === 'non_visitees' && 'Toutes les portes ont été visitées.'}
            {filterMode === 'absents' && 'Aucun absent à repasser.'}
            {filterMode === 'rdv' && 'Aucun RDV en attente.'}
            {filterMode === 'a_traiter' && 'Toutes les portes ont été traitées !'}
            {filterMode === 'all' && 'Aucune porte disponible.'}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setFilterMode('all')} className="h-12">
              Voir toutes les portes
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const statutInfo = statutOptions.find(o => o.value === currentPorte?.statut) || statutOptions[0]
  const StatutIcon = statutInfo?.icon

  // Boutons d'action avec leurs configs
  const actionButtons = [
    {
      statut: StatutPorte.ABSENT,
      label: 'Absent',
      icon: UserX,
      color: 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700',
    },
    {
      statut: StatutPorte.REFUS,
      label: 'Refus',
      icon: X,
      color: 'bg-red-500 hover:bg-red-600 active:bg-red-700',
    },
    {
      statut: StatutPorte.RENDEZ_VOUS_PRIS,
      label: 'RDV',
      icon: Calendar,
      color: 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700',
    },
    {
      statut: StatutPorte.ARGUMENTE,
      label: 'Argumenté',
      icon: MessageSquare,
      color: 'bg-purple-500 hover:bg-purple-600 active:bg-purple-700',
    },
    {
      statut: StatutPorte.CONTRAT_SIGNE,
      label: 'Contrat',
      icon: FileSignature,
      color: 'bg-green-500 hover:bg-green-600 active:bg-green-700',
    },
  ]

  // Config pour l'affichage du dialogue
  const pendingStatutInfo = confirmDialog.statut
    ? statutOptions.find(o => o.value === confirmDialog.statut)
    : null

  // Trouver la couleur "Action" (forte) correspondante pour le bouton
  const pendingActionBtn = actionButtons.find(b => b.statut === confirmDialog.statut)
  const confirmBtnColor = pendingActionBtn
    ? pendingActionBtn.color
    : pendingStatutInfo?.color?.split(' ')[0] || 'bg-primary'

  // ----------------------------------------------------------------------
  // 6. RENDER: MAIN UI
  // ----------------------------------------------------------------------
  return (
    <>
      <div className="flex flex-col min-h-[80vh]">
        {/* ---------------------------------------------------------------------- */}
        {/* HEADER SECTION - CARTE PLIABLE */}
        {/* ---------------------------------------------------------------------- */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-4 overflow-hidden">
          {/* Header cliquable - toujours visible */}
          <button
            onClick={toggleHeaderExpanded}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${colors.primary.bgLight}`}>
                <Zap className={`h-5 w-5 ${colors.primary.text}`} />
              </div>
              <div className="text-left">
                <h2 className={`font-bold text-lg ${base.text.primary}`}>Mode Rapide</h2>
                <p className={`text-xs ${base.text.muted}`}>{immeuble?.adresse}</p>
              </div>
            </div>
            {isHeaderExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </button>

          {/* Contenu pliable */}
          {isHeaderExpanded && (
            <div className="border-t border-gray-100 p-4 space-y-4 bg-blue-50">
              {/* Boutons d'action */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button
                  onClick={handleResume}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200`}
                  title="Aller à la première porte non visitée"
                >
                  <History className="h-5 w-5" />
                  Reprendre
                </button>
                <button
                  onClick={toggleAutoAdvance}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${autoAdvance ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}
                >
                  <FastForward
                    className={`h-5 w-5 ${autoAdvance ? 'text-green-600' : 'text-gray-400'}`}
                  />
                  {autoAdvance ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
                </button>
                <button
                  onClick={toggleVisualization}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${showVisualization ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}
                  title={
                    showVisualization ? 'Masquer la visualisation' : 'Afficher la visualisation'
                  }
                >
                  {showVisualization ? (
                    <Eye className="h-5 w-5 text-purple-600" />
                  ) : (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  )}
                  Vue
                </button>
              </div>

              {/* Filtres rapides */}
              <div className="flex flex-wrap gap-2 justify-center">
                <Filter className={`h-5 w-5 ${base.text.muted} self-center`} />
                {filterOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterMode(opt.value)}
                    className={`px-3 py-2 rounded-full text-xs font-medium transition-all ${
                      filterMode === opt.value
                        ? `${colors.primary.bg} text-white shadow-md`
                        : `${base.bg.muted} ${base.text.muted} hover:opacity-80`
                    }`}
                  >
                    {opt.label} ({opt.count})
                  </button>
                ))}
              </div>

              {/* Barre de progression */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className={base.text.muted}>Progression globale</span>
                  <span className={`font-bold ${colors.primary.text}`}>
                    {progressStats.visited}/{progressStats.total} ({progressStats.percentage}%)
                  </span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${colors.primary.bg} transition-all duration-500 ease-out`}
                    style={{ width: `${progressStats.percentage}%` }}
                  />
                </div>
              </div>

              {/* ---------------------------------------------------------------------- */}
              {/* VISUALISATION GRID */}
              {/* ---------------------------------------------------------------------- */}
              {/* Carte de visualisation des portes par étage */}
              {showVisualization && (
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-500" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Vue d'ensemble
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {filteredPortes.length} porte{filteredPortes.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Zone scrollable */}
                  <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 custom-scrollbar p-2">
                    {portesParEtage.map(([etageNum, portesEtage]) => (
                      <div key={etageNum} className="space-y-2">
                        {/* Séparateur d'étage */}
                        <div className="flex items-center gap-2">
                          <div className="shrink-0 w-16 px-2 py-1 bg-gray-100 rounded-lg">
                            <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wide">
                              Étage {etageNum}
                            </span>
                          </div>
                          <div className="flex-1 h-px bg-gray-200" />
                        </div>

                        {/* Portes de l'étage */}
                        <div className="flex flex-wrap gap-2">
                          {portesEtage.map(porte => {
                            const isCurrent = currentPorte?.id === porte.id
                            const statusColor = getStatusColor(porte.statut)

                            return (
                              <button
                                key={porte.id}
                                onClick={() => goToPorte(porte.id)}
                                className={`
                            relative group flex items-center justify-center min-w-[44px] h-10 px-2 rounded-lg
                            transition-all duration-200
                            ${
                              isCurrent
                                ? `${statusColor} ring-2 ring-offset-2 ring-blue-400 shadow-lg scale-110`
                                : `${statusColor} hover:scale-105 hover:shadow-md opacity-80 hover:opacity-100`
                            }
                          `}
                                title={`Porte ${porte.numero} - ${statutOptions.find(s => s.value === porte.statut)?.label || porte.statut}`}
                              >
                                <span className="text-[11px] font-bold text-white drop-shadow-sm">
                                  {porte.nomPersonnalise || porte.numero}
                                </span>

                                {/* Indicateur de porte courante */}
                                {isCurrent && (
                                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 rounded-full border-2 border-white" />
                                )}

                                {/* Tooltip au hover */}
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                  {porte.nomPersonnalise && `${porte.nomPersonnalise} - `}Porte{' '}
                                  {porte.numero}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Légende des couleurs */}
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-gray-300" />
                        <span className="text-[9px] text-gray-600">Non visité</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-orange-500" />
                        <span className="text-[9px] text-gray-600">Absent</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-red-500" />
                        <span className="text-[9px] text-gray-600">Refus</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-blue-500" />
                        <span className="text-[9px] text-gray-600">RDV</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-purple-500" />
                        <span className="text-[9px] text-gray-600">Argumenté</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-green-500" />
                        <span className="text-[9px] text-gray-600">Contrat</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------------------------------------------------------------- */}
              {/* MANAGEMENT SECTION */}
              {/* ---------------------------------------------------------------------- */}
              {/* Section Gestion Portes/Étages */}
              {(onAddEtage || onAddPorteToEtage) && currentPorte && (
                <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Gestion
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Gestion Portes */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <DoorOpen className="h-3.5 w-3.5 text-gray-500" />
                        <span className="text-[10px] font-bold text-gray-600 uppercase">
                          Portes (Étage {currentPorte?.etage})
                        </span>
                      </div>
                      {onAddPorteToEtage && (
                        <button
                          onClick={() => onAddPorteToEtage(currentPorte?.etage)}
                          disabled={addingPorteToEtage}
                          className={`
                      w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold
                      transition-all duration-200 border-2 border-dashed
                      ${
                        addingPorteToEtage
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100 hover:border-solid active:scale-95'
                      }
                    `}
                        >
                          <Plus className="h-4 w-4" />
                          {addingPorteToEtage ? 'Ajout...' : 'Ajouter porte'}
                        </button>
                      )}
                      {onRemovePorteFromEtage && (
                        <button
                          onClick={() =>
                            setDeleteConfirm({
                              isOpen: true,
                              type: 'porte',
                              etage: currentPorte?.etage,
                            })
                          }
                          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-black text-xs font-bold
                      transition-all duration-200 border-2 border-dashed bg-red-100 border-red-500"
                        >
                          <Minus className="h-3 w-3" />
                          Supprimer dernière porte
                        </button>
                      )}
                    </div>

                    {/* Gestion Étages */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Layers className="h-3.5 w-3.5 text-gray-500" />
                        <span className="text-[10px] font-bold text-gray-600 uppercase">
                          Étages
                        </span>
                      </div>
                      {onAddEtage && (
                        <button
                          onClick={onAddEtage}
                          disabled={addingEtage}
                          className={`
                      w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold
                      transition-all duration-200 border-2 border-dashed
                      ${
                        addingEtage
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100 hover:border-solid active:scale-95'
                      }
                    `}
                        >
                          <Plus className="h-4 w-4" />
                          {addingEtage ? 'Ajout...' : 'Ajouter étage'}
                        </button>
                      )}
                      {onRemoveEtage && (
                        <button
                          onClick={() =>
                            setDeleteConfirm({
                              isOpen: true,
                              type: 'etage',
                              etage: currentPorte?.etage,
                            })
                          }
                          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs text-black font-bold
                      transition-all duration-200 border-2 border-dashed bg-red-100 border-red-500"
                        >
                          <Minus className="h-3 w-3" />
                          Supprimer dernier étage
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Navigation et porte courante */}
        {/* ---------------------------------------------------------------------- */}
        {/* NAVIGATION PRINCIPALE - CENTRÉE */}
        {/* ---------------------------------------------------------------------- */}
        <div className="flex-1 p-2 space-y-2 max-w-4xl mx-auto w-full">
          {/* Contrôles de navigation PREMIUM */}

          {/* Navigation Porte (Premium Design) - Uniformized */}
          <div className="relative flex items-center justify-between bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
            {/* Label Central */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                  Porte
                </span>
                <span className="text-sm font-bold text-gray-800">
                  {currentIndex + 1} / {filteredPortes.length}
                </span>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100 rounded-b-2xl overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out"
                style={{ width: `${((currentIndex + 1) / filteredPortes.length) * 100}%` }}
              />
            </div>

            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className={`
              relative z-10 flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
              ${
                currentIndex > 0
                  ? 'bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md active:scale-95'
                  : 'opacity-40 cursor-not-allowed grayscale'
              }
            `}
            >
              <div
                className={`
              p-2 rounded-full transition-colors
              ${currentIndex > 0 ? 'bg-white shadow-sm text-blue-600' : 'bg-gray-100 text-gray-400'}
            `}
              >
                <ChevronsLeft className="h-5 w-5" />
              </div>
              <div className="flex flex-col items-start min-w-[60px]">
                <span className="text-[10px] font-bold opacity-60 uppercase">Précédent</span>
                <span className="text-sm font-bold">
                  {currentIndex > 0
                    ? `Porte ${filteredPortes[currentIndex - 1]?.numero || currentIndex}`
                    : '-'}
                </span>
              </div>
            </button>

            {/* Bouton Suivant */}
            <button
              onClick={goToNext}
              disabled={
                (currentIndex >= filteredPortes.length - 1 && !hasMore) ||
                isFetchingMore ||
                currentPorte?.statut === StatutPorte.NON_VISITE
              }
              title={
                currentPorte?.statut === StatutPorte.NON_VISITE
                  ? 'Veuillez définir un statut avant de continuer'
                  : ''
              }
              className={`
              relative z-10 flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-right
              ${
                !(
                  (currentIndex >= filteredPortes.length - 1 && !hasMore) ||
                  isFetchingMore ||
                  currentPorte?.statut === StatutPorte.NON_VISITE
                )
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl hover:-translate-y-0.5 active:scale-95'
                  : 'bg-gray-50 text-gray-400 opacity-60 cursor-not-allowed'
              }
            `}
            >
              <div className="flex flex-col items-end min-w-[60px]">
                <span
                  className={`text-[10px] font-bold uppercase ${currentIndex < filteredPortes.length - 1 || hasMore ? 'opacity-80' : 'opacity-60'}`}
                >
                  Suivant
                </span>
                <span className="text-sm font-bold">
                  {isFetchingMore
                    ? '...'
                    : currentIndex < filteredPortes.length - 1
                      ? `Porte ${filteredPortes[currentIndex + 1]?.numero || currentIndex + 2}`
                      : hasMore
                        ? 'Charger...'
                        : '-'}
                </span>
              </div>
              <div
                className={`
              p-2 rounded-full transition-colors
              ${currentIndex < filteredPortes.length - 1 || hasMore ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-400'}
            `}
              >
                <ChevronsRight className="h-5 w-5" />
              </div>
            </button>
          </div>

          {/* ---------------------------------------------------------------------- */}
          {/* CARTE PORTE COURANTE */}
          {/* ---------------------------------------------------------------------- */}
          {/* Carte de la porte courante */}
          {currentPorte && (
            <Card
              className={`${base.bg.card} border-2 ${base.border.default} shadow-lg bg-blue-50`}
            >
              <CardContent className="p-0">
                {/* Header: Compact Horizontal Layout */}
                <div className="relative overflow-hidden rounded-t-xl bg-linear-to-r bg-blue-50 px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center justify-between gap-3">
                    {/* Left: Étage */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full  backdrop-blur-sm shrink-0">
                      <Building2 className="h-3 w-3 text-gray-500" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                        Étage {currentPorte.etage}
                      </span>
                    </div>

                    {/* Center: Porte Number/Name */}
                    <div className="text-center flex-1 min-w-0 flex flex-col items-center justify-center">
                      <div className="flex items-center justify-center gap-2">
                        <h3 className="text-2xl font-black text-gray-900 tracking-tight truncate">
                          {currentPorte.nomPersonnalise || currentPorte.numero}
                        </h3>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 shrink-0"
                          onClick={e => {
                            e.stopPropagation()
                            onOpenEditModal(currentPorte, currentPorte.statut, quickComment)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {currentPorte.nomPersonnalise && (
                        <p className="text-[10px] font-medium text-gray-400">
                          Porte {currentPorte.numero}
                        </p>
                      )}
                    </div>

                    {/* Right: Status Badge */}
                    <Badge
                      className={`${statutInfo?.color || 'bg-gray-100 text-gray-700'} border-0 px-2.5 py-1 text-[10px] font-bold shadow-sm ring-1 ring-inset ring-black/5 shrink-0`}
                    >
                      {StatutIcon && <StatutIcon className="h-3 w-3 mr-1" />}
                      {statutInfo?.label}
                    </Badge>
                  </div>
                </div>

                {/* Info Section: Compact Horizontal */}
                <div className="px-4 py-2 bg-blue-50">
                  {/* Repassage Info - Horizontal Pills for ABSENT */}
                  {currentPorte.statut === StatutPorte.ABSENT && (
                    <div className="flex items-center gap-2 mb-2 bg-">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide shrink-0">
                        Passages:
                      </span>
                      <div className="flex gap-2 flex-1">
                        {/* 1er Passage */}
                        <div
                          className={`
                        flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border flex-1
                        ${
                          currentPorte.nbRepassages >= 1
                            ? 'bg-orange-50 border-orange-200'
                            : 'bg-gray-50 border-gray-200 opacity-50'
                        }
                      `}
                        >
                          <div
                            className={`p-1 rounded-full ${currentPorte.nbRepassages >= 1 ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-400'}`}
                          >
                            <Sun className="h-3 w-3" />
                          </div>
                          <span
                            className={`text-[10px] font-bold ${currentPorte.nbRepassages >= 1 ? 'text-gray-900' : 'text-gray-500'}`}
                          >
                            Matin
                          </span>
                          {currentPorte.nbRepassages >= 1 && (
                            <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />
                          )}
                        </div>

                        {/* 2ème Passage */}
                        <div
                          className={`
                        flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border flex-1
                        ${
                          currentPorte.nbRepassages >= 2
                            ? 'bg-indigo-50 border-indigo-200'
                            : 'bg-gray-50 border-gray-200 opacity-50'
                        }
                      `}
                        >
                          <div
                            className={`p-1 rounded-full ${currentPorte.nbRepassages >= 2 ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-400'}`}
                          >
                            <Moon className="h-3 w-3" />
                          </div>
                          <span
                            className={`text-[10px] font-bold ${currentPorte.nbRepassages >= 2 ? 'text-gray-900' : 'text-gray-500'}`}
                          >
                            Soir
                          </span>
                          {currentPorte.nbRepassages >= 2 && (
                            <CheckCircle2 className="h-3 w-3 text-indigo-500 ml-auto" />
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* RDV Info - Inline */}
                  {currentPorte.statut === StatutPorte.RENDEZ_VOUS_PRIS && currentPorte.rdvDate && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide shrink-0">
                        RDV:
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-700 border-blue-200 px-2.5 py-0.5 text-[10px]"
                      >
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(currentPorte.rdvDate).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                        })}
                        {currentPorte.rdvTime && ` • ${currentPorte.rdvTime}`}
                      </Badge>
                    </div>
                  )}

                  {/* Contracts Info - Inline */}
                  {currentPorte.statut === StatutPorte.CONTRAT_SIGNE && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide shrink-0">
                        Contrats:
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-green-50 text-green-700 border-green-200 px-2.5 py-0.5 text-[10px]"
                      >
                        <FileSignature className="h-3 w-3 mr-1" />
                        {currentPorte.nbContrats || 1}{' '}
                        {(currentPorte.nbContrats || 1) > 1 ? 'Contrats' : 'Contrat'}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Commentaire existant */}
                {currentPorte.commentaire && (
                  <div className="px-4 pb-3">
                    <div className="bg-yellow-50/50 border border-yellow-100 rounded-lg p-2.5 flex gap-2 shadow-sm">
                      <span className="text-sm select-none">📝</span>
                      <p className="text-[11px] font-medium text-gray-700 leading-relaxed italic">
                        "{currentPorte.commentaire}"
                      </p>
                    </div>
                  </div>
                )}

                {/* Section Sélection Repassage (affichée si absent sélectionné) */}
                {showRepassageChoice && (
                  <div className="mb-6 animate-in zoom-in-95 duration-200 px-4">
                    <div className="text-center mb-3">
                      <span className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                        Noter un passage
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => handleRepassageSelect(1)}
                        className={`
                        group relative overflow-hidden h-32 rounded-2xl transition-all duration-300 border-2 shadow-sm hover:shadow-lg hover:-translate-y-1 block w-full
                        ${
                          (currentPorte.nbRepassages || 0) === 1
                            ? 'border-orange-500 ring-2 ring-orange-200 ring-offset-2'
                            : 'border-transparent hover:border-orange-300'
                        }
                      `}
                      >
                        {/* Background Matin */}
                        <div className="absolute inset-0 bg-linear-to-br from-orange-100 via-amber-50 to-blue-50 opacity-100 transition-opacity" />
                        <div className="absolute -right-4 -top-4 opacity-20 group-hover:opacity-30 transition-opacity">
                          <Sun className="h-24 w-24 text-orange-500" />
                        </div>

                        <div className="relative z-10 flex flex-col items-center justify-center h-full">
                          <div className="p-2 rounded-full bg-orange-100 text-orange-600 mb-2 group-hover:scale-110 transition-transform shadow-sm">
                            <Sun className="h-6 w-6" />
                          </div>
                          <span className="font-bold text-gray-800 text-lg">Matin</span>
                          <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full mt-1 border border-orange-100">
                            1er passage
                          </span>
                        </div>
                      </button>

                      <button
                        onClick={() => handleRepassageSelect(2)}
                        className={`
                        group relative overflow-hidden h-32 rounded-2xl transition-all duration-300 border-2 shadow-sm hover:shadow-lg hover:-translate-y-1 block w-full
                        ${
                          (currentPorte.nbRepassages || 0) >= 2
                            ? 'border-indigo-500 ring-2 ring-indigo-200 ring-offset-2'
                            : 'border-transparent hover:border-indigo-300'
                        }
                      `}
                      >
                        {/* Background Soir */}
                        <div className="absolute inset-0 bg-linear-to-br from-indigo-100 via-blue-50 to-purple-50 opacity-100 transition-opacity" />
                        <div className="absolute -right-4 -top-4 opacity-20 group-hover:opacity-30 transition-opacity">
                          <Moon className="h-24 w-24 text-indigo-600" />
                        </div>

                        <div className="relative z-10 flex flex-col items-center justify-center h-full">
                          <div className="p-2 rounded-full bg-indigo-100 text-indigo-600 mb-2 group-hover:scale-110 transition-transform shadow-sm">
                            <Moon className="h-6 w-6" />
                          </div>
                          <span className="font-bold text-gray-800 text-lg">Soir</span>
                          <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full mt-1 border border-indigo-100">
                            2ème passage
                          </span>
                        </div>
                      </button>
                    </div>
                    <button
                      onClick={handleCancelAbsent}
                      className="w-full mt-3 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm active:scale-95"
                    >
                      Annuler
                    </button>
                  </div>
                )}

                {/* Boutons d'action GÉANTS */}
                {!showRepassageChoice && (
                  <>
                    <div className="grid grid-cols-3 gap-3 px-4 py-2">
                      {actionButtons.slice(0, 3).map(btn => {
                        const isActive = currentPorte.statut === btn.statut

                        // Special styling for ABSENT if Repassage exists
                        let buttonStyle = isActive
                          ? btn.color + ' text-white ring-4 ring-offset-2'
                          : 'bg-gray-100 text-gray-700 border-2 border-gray-200'
                        let Icon = btn.icon
                        let label = btn.label

                        if (
                          btn.statut === StatutPorte.ABSENT &&
                          (currentPorte.nbRepassages || 0) > 0
                        ) {
                          if (currentPorte.nbRepassages === 1) {
                            // Matin Style
                            buttonStyle = isActive
                              ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white ring-4 ring-offset-2 ring-orange-200'
                              : 'bg-orange-50 text-orange-700 border-2 border-orange-200'
                            Icon = Sun
                            label = 'Abs. (Matin)'
                          } else if (currentPorte.nbRepassages >= 2) {
                            // Soir Style
                            buttonStyle = isActive
                              ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white ring-4 ring-offset-2 ring-indigo-200'
                              : 'bg-indigo-50 text-indigo-700 border-2 border-indigo-200'
                            Icon = Moon
                            label = 'Abs. (Soir)'
                          }
                        }

                        return (
                          <button
                            key={btn.statut}
                            onClick={() => handleStatusClick(btn.statut)}
                            className={`
                            relative overflow-hidden flex flex-col items-center justify-center p-4 rounded-xl
                            ${buttonStyle}
                            transition-all duration-200 active:scale-80
                            min-h-[80px]
                          `}
                          >
                            <Icon
                              className={`h-7 w-7 mb-2 ${isActive ? 'text-white' : btn.statut === StatutPorte.ABSENT && currentPorte.nbRepassages ? '' : 'text-current'}`}
                            />
                            <span className="font-bold text-xs">{label}</span>

                            {/* Indicator for Absent/Repassage rendering */}
                            {btn.statut === StatutPorte.ABSENT &&
                              (currentPorte.nbRepassages || 0) > 0 && (
                                <div className="absolute top-1 right-1">
                                  {currentPorte.nbRepassages === 1 && (
                                    <Sun className="h-3 w-3 opacity-50" />
                                  )}
                                  {currentPorte.nbRepassages >= 2 && (
                                    <Moon className="h-3 w-3 opacity-50" />
                                  )}
                                </div>
                              )}
                          </button>
                        )
                      })}
                    </div>

                    <div className="grid grid-cols-3 gap-3 px-4 py-2">
                      {actionButtons.slice(3).map(btn => {
                        const Icon = btn.icon
                        const isActive = currentPorte.statut === btn.statut
                        return (
                          <button
                            key={btn.statut}
                            onClick={() => handleStatusClick(btn.statut)}
                            className={`
                            flex flex-col items-center justify-center p-4 rounded-xl
                            ${isActive ? btn.color + ' text-white ring-4 ring-offset-2' : 'bg-gray-100 text-gray-700 border-2 border-gray-200'}
                            transition-all duration-200 active:scale-95
                            min-h-[85px]
                          `}
                          >
                            <Icon className="h-7 w-7 mb-2" />
                            <span className="font-bold text-xs">{btn.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}

                {/* Zone commentaire */}
                <div className="mt-2 py-2 px-4">
                  {!showCommentInput && (
                    <button
                      onClick={() => setShowCommentInput(true)}
                      className={`w-full py-3 rounded-lg border-2 border-dashed ${base.border.default} ${base.text.muted} hover:border-gray-400 transition-all flex items-center justify-center gap-2`}
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span className="text-sm">Ajouter un commentaire rapide</span>
                    </button>
                  )}

                  {showCommentInput && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Commentaire rapide..."
                        value={quickComment}
                        onChange={e => setQuickComment(e.target.value)}
                        className="min-h-[80px] bg-white text-black text-xl"
                        autoFocus
                      />

                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowCommentInput(false)
                          }}
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                        >
                          Masquer
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveComment}
                          disabled={!quickComment.trim()}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Enregistrer note
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ---------------------------------------------------------------------- */}
          {/* NAVIGATION ETAGES */}
          {/* ---------------------------------------------------------------------- */}
          {/* Navigation Étage (Premium Design) - Moved below card */}
          <div className="flex flex-col gap-2 p-1 mb-40">
            <div className="relative flex items-center justify-between bg-white rounded-2xl p-2 shadow-sm border border-gray-100">
              {/* Label Central (Absolu pour ne pas gêner le flex) */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                    Étage
                  </span>
                  <span className="text-sm font-bold text-gray-800">
                    {currentPorte ? currentPorte.etage : '--'}
                  </span>
                </div>
              </div>

              {/* Bouton Précédent */}
              <button
                onClick={goToPreviousFloor}
                disabled={!canGoPreviousFloor}
                className={`
                    relative z-10 flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
                    ${
                      canGoPreviousFloor
                        ? 'bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md translate-y-0 active:scale-95'
                        : 'opacity-40 cursor-not-allowed grayscale'
                    }
                  `}
              >
                <div
                  className={`
                    p-2 rounded-full transition-colors
                    ${canGoPreviousFloor ? 'bg-white shadow-sm text-blue-600' : 'bg-gray-100 text-gray-400'}
                  `}
                >
                  <ChevronsLeft className="h-5 w-5" />
                </div>
                <div className="flex flex-col items-start min-w-[60px]">
                  <span className="text-[10px] font-bold opacity-60 uppercase">Précédent</span>
                  <span className="text-sm font-bold">
                    {previousFloorTarget !== null ? `Étage ${previousFloorTarget}` : '-'}
                  </span>
                </div>
              </button>

              {/* Bouton Suivant */}
              <button
                onClick={goToNextFloor}
                disabled={!canGoNextFloor}
                className={`
                    relative z-10 flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-right
                    ${
                      canGoNextFloor
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl hover:-translate-y-0.5 active:scale-95'
                        : 'bg-gray-50 text-gray-400 opacity-60 cursor-not-allowed'
                    }
                  `}
              >
                <div className="flex flex-col items-end min-w-[60px]">
                  <span
                    className={`text-[10px] font-bold uppercase ${canGoNextFloor ? 'opacity-80' : 'opacity-60'}`}
                  >
                    Suivant
                  </span>
                  <span className="text-sm font-bold">
                    {nextFloorTarget !== null ? `Étage ${nextFloorTarget}` : '-'}
                  </span>
                </div>
                <div
                  className={`
                    p-2 rounded-full transition-colors
                    ${canGoNextFloor ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-400'}
                  `}
                >
                  <ChevronsRight className="h-5 w-5" />
                </div>
              </button>
            </div>
          </div>

          {/* ---------------------------------------------------------------------- */}
          {/* MODALS & DIALOGS */}
          {/* ---------------------------------------------------------------------- */}
          {/* DIALOG DE CONFIRMATION STATUT */}
          <Dialog
            open={confirmDialog.isOpen}
            onOpenChange={open => !open && setConfirmDialog(p => ({ ...p, isOpen: false }))}
          >
            <DialogContent className="sm:max-w-md bg-white text-gray-800">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`p-3 rounded-full ${pendingStatutInfo?.color?.replace('bg-', 'bg-').replace(' ', '/20 ') || 'bg-gray-100'}`}
                  >
                    {pendingStatutInfo?.icon &&
                      (() => {
                        const Icon = pendingStatutInfo.icon
                        return (
                          <Icon
                            className={`h-6 w-6 ${pendingStatutInfo?.color?.split(' ')[1] || 'text-gray-600'}`}
                          />
                        )
                      })()}
                  </div>
                  <DialogTitle className="text-xl">Confirmer le changement</DialogTitle>
                </div>
                <DialogDescription className="text-base text-gray-600">
                  Vous allez passer la porte{' '}
                  <span className="font-bold text-gray-900">{currentPorte?.numero}</span> en statut
                  :
                  <br />
                  <span
                    className={`inline-block mt-2 px-2 py-1 rounded text-sm font-bold ${pendingStatutInfo?.color || 'bg-gray-100'}`}
                  >
                    {pendingStatutInfo?.label}
                  </span>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex gap-2 sm:gap-0 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleConfirmStatusChange}
                  className={`flex-1 ${confirmBtnColor} text-white hover:opacity-90 shadow-md transition-all`}
                >
                  Confirmer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* DIALOG DE CONFIRMATION SUPPRESSION */}
          <Dialog
            open={deleteConfirm.isOpen}
            onOpenChange={open => !open && setDeleteConfirm(p => ({ ...p, isOpen: false }))}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 rounded-full bg-red-100">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <DialogTitle className="text-xl text-red-900">
                    {deleteConfirm.type === 'porte'
                      ? 'Supprimer une porte ?'
                      : 'Supprimer un étage ?'}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-base text-gray-600">
                  {deleteConfirm.type === 'porte' ? (
                    <>
                      Êtes-vous sûr de vouloir{' '}
                      <span className="font-bold text-red-700">supprimer la dernière porte</span> de
                      l'étage {deleteConfirm.etage} ?
                      <br />
                      <br />
                      <span className="text-red-600 font-semibold">
                        ⚠️ Cette action est irréversible.
                      </span>
                    </>
                  ) : (
                    <>
                      Êtes-vous sûr de vouloir{' '}
                      <span className="font-bold text-red-700">supprimer le dernier étage</span> de
                      l'immeuble ?
                      <br />
                      <br />
                      <span className="text-red-600 font-semibold">
                        ⚠️ Toutes les portes de cet étage seront supprimées. Cette action est
                        irréversible.
                      </span>
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex gap-2 sm:gap-0 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm({ isOpen: false, type: null, etage: null })}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (deleteConfirm.type === 'porte' && onRemovePorteFromEtage) {
                      onRemovePorteFromEtage(deleteConfirm.etage)
                    } else if (deleteConfirm.type === 'etage' && onRemoveEtage) {
                      onRemoveEtage(deleteConfirm.etage)
                    }
                    setDeleteConfirm({ isOpen: false, type: null, etage: null })
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Supprimer définitivement
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  )
}
