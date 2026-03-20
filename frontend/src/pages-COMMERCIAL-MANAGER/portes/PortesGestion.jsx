import { useOutletContext } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { List, LogOut, AlertTriangle, Zap } from 'lucide-react'

import { useRecording } from '@/hooks/audio/useRecording'
import { useRole } from '@/contexts/userole'
import { usePortesLogic } from './hooks/usePortesLogic'

import EditPorteModal from './components/EditPorteModal'
import PortesListe from './components/PortesListe'
import PortesRapide from './components/PortesRapide'

/**
 * Page de gestion des portes d'un immeuble
 * Agit comme un conteneur principal qui gère les données et le basculement entre les vues.
 */
export default function PortesGestion() {
  const { currentUserId, isManager } = useRole()

  // Custom Hook englobant toute la logique
  const { state, actions } = usePortesLogic()

  const {
    portes,
    statsData,
    loading,
    loadingImmeuble,
    immeuble,
    immeubleId,
    isFetchingMore,
    selectedFloor,
    viewMode,
    showEditModal,
    selectedPorte,
    editForm,
    isSaving,
    showQuitConfirm,
    addingEtage,
    addingPorteToEtage,
    statutOptions,
    loadMore,
    hasMore,
  } = state

  const {
    setViewMode,
    setEditForm,
    setShowEditModal,
    setShowQuitConfirm,
    handleFloorSelect,
    handleEditPorte,
    handleSavePorte,
    handleQuickStatusChange,
    handleRepassageChange,
    handleAddEtage,
    handleAddPorteToEtage,
    handleRemoveEtage,
    handleRemovePorteFromEtage,
    handleBackToImmeubles,
    handleOpenEditModalFromRapide,
  } = actions

  // Récupère contexte audio (layout) pour le hook d'enregistrement
  const { audioStatus } = useOutletContext() || {}

  // Déterminer le type d'utilisateur
  const userType = isManager ? 'manager' : 'commercial'

  // Hook d'enregistrement automatique (attend la connexion audio)
  const {
    isRecording: _isRecording,
    isStarting: _isStarting,
    error: _recordingError,
  } = useRecording(
    parseInt(currentUserId),
    userType,
    true,
    audioStatus?.audioConnected,
    parseInt(immeubleId, 10)
  )

  return (
    <div className="space-y-4">
      {/* Header Principal - Design Premium */}
      <div className="relative overflow-hidden bg-transparent">
        {/* Fond avec gradient subtil */}
        <div className="absolute inset-0 bg-linear-to-r bg-transparent" />

        <div className="relative bg-transparent rounded-2xl p-2 ">
          <div className="flex items-center justify-between gap-4">
            {/* Bouton Quitter - Design épuré */}
            <button
              onClick={() => setShowQuitConfirm(true)}
              className="group relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 bg-linear-to-r from-red-500 to-rose-600 text-white hover:shadow-red-500/30 hover:scale-105 active:scale-95"
            >
              <LogOut className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
              <span>Quitter</span>
            </button>

            {/* Toggle Mode - Design premium */}
            <button
              onClick={() => setViewMode(viewMode === 'rapide' ? 'liste' : 'rapide')}
              className={`group relative flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 hover:scale-105 active:scale-95 ${
                viewMode === 'rapide'
                  ? 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-2 border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                  : 'bg-linear-to-r from-amber-500 via-orange-500 to-amber-600 text-white hover:shadow-amber-500/30'
              }`}
            >
              {viewMode === 'rapide' ? (
                <>
                  <List className="h-5 w-5 transition-transform group-hover:scale-110" />
                  <span>Mode Liste</span>
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5 transition-transform group-hover:rotate-12 group-hover:scale-110" />
                  <span>Mode Rapide</span>
                </>
              )}

              {/* Badge indicateur */}
              <span
                className={`absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full ${
                  viewMode === 'rapide'
                    ? 'bg-blue-500'
                    : 'bg-linear-to-r from-amber-400 to-orange-500 animate-pulse'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Rendu conditionnel selon le mode */}
      {viewMode === 'rapide' ? (
        <PortesRapide
          portes={portes}
          statsData={statsData}
          onQuickStatusChange={handleQuickStatusChange}
          onSwitchToListMode={() => setViewMode('liste')}
          immeuble={immeuble}
          onOpenEditModal={handleOpenEditModalFromRapide}
          onRepassageChange={handleRepassageChange}
          loadMore={loadMore}
          hasMore={hasMore}
          isFetchingMore={isFetchingMore}
          onAddEtage={handleAddEtage}
          onAddPorteToEtage={handleAddPorteToEtage}
          onRemoveEtage={handleRemoveEtage}
          onRemovePorteFromEtage={handleRemovePorteFromEtage}
          addingEtage={addingEtage}
          addingPorteToEtage={addingPorteToEtage}
        />
      ) : (
        <PortesListe
          portes={portes}
          statsData={statsData}
          loading={(loading && portes.length === 0) || loadingImmeuble}
          isFetchingMore={isFetchingMore}
          immeuble={immeuble}
          immeubleId={immeubleId}
          onEdit={handleEditPorte}
          onQuickChange={handleQuickStatusChange}
          onRepassageChange={handleRepassageChange}
          onBack={handleBackToImmeubles}
          onAddEtage={handleAddEtage}
          onAddPorteToEtage={handleAddPorteToEtage}
          onRemoveEtage={handleRemoveEtage}
          onRemovePorteFromEtage={handleRemovePorteFromEtage}
          addingEtage={addingEtage}
          addingPorteToEtage={addingPorteToEtage}
          selectedFloor={selectedFloor}
          onFloorSelect={handleFloorSelect}
        />
      )}

      {/* Dialogue de confirmation pour quitter */}
      <Dialog open={showQuitConfirm} onOpenChange={setShowQuitConfirm}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <DialogTitle className="text-xl text-slate-900 dark:text-slate-900">
                Voulez-vous quitter cet immeuble ?
              </DialogTitle>
            </div>
            <DialogDescription className="text-base"></DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 sm:gap-3">
            <Button
              variant="default"
              onClick={() => setShowQuitConfirm(false)}
              className="flex-1 bg-white text-gray-700 border-2 border-gray-200"
            >
              Annuler
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setShowQuitConfirm(false)
                handleBackToImmeubles()
              }}
              className="flex-1 bg-red-500"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Oui, quitter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal d'édition (partagé) */}
      <EditPorteModal
        open={showEditModal}
        onOpenChange={open => {
          setShowEditModal(open)
        }}
        selectedPorte={selectedPorte}
        immeubleAdresse={immeuble?.adresse}
        editForm={editForm}
        setEditForm={setEditForm}
        statutOptions={statutOptions}
        isSaving={isSaving}
        onSave={handleSavePorte}
        onRepassageChange={handleRepassageChange}
      />
    </div>
  )
}
