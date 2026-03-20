import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, RotateCcw, Minus, Plus, FileSignature } from 'lucide-react'

export default function EditPorteModal({
  open,
  onOpenChange,
  selectedPorte,
  immeubleAdresse,
  editForm,
  setEditForm,
  isSaving,
  onSave,
  onRepassageChange,
}) {
  const [viewportState, setViewportState] = useState(null)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const initialHeight = viewport.height
    const maxDiff = initialHeight * 0.4

    const updateViewportState = () => {
      const heightDiff = Math.max(0, initialHeight - viewport.height)
      const progress = Math.min(heightDiff / maxDiff, 1)

      setViewportState({
        height: viewport.height,
        offsetTop: viewport.offsetTop,
        progress,
      })
    }

    updateViewportState()
    viewport.addEventListener('resize', updateViewportState)
    viewport.addEventListener('scroll', updateViewportState)

    return () => {
      viewport.removeEventListener('resize', updateViewportState)
      viewport.removeEventListener('scroll', updateViewportState)
    }
  }, [])

  const dialogStyle = viewportState
    ? {
        top: `${viewportState.offsetTop + (1 - viewportState.progress) * (viewportState.height / 2) + viewportState.progress * 12}px`,
        '--tw-translate-y': `${-50 + 50 * viewportState.progress}%`,
      }
    : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={event => event.preventDefault()}
        style={dialogStyle}
        className={`
          flex flex-col p-0 overflow-hidden bg-white border border-gray-200 shadow-xl rounded-xl transition-[top,transform] duration-200 ease-out will-change-transform
          w-[98%] sm:w-[95%] md:w-[95%] lg:w-[92%] max-w-7xl max-h-[96dvh]
        `}
      >
        <DialogHeader className="px-4 py-3 border-b border-gray-100 shrink-0 bg-white sm:px-5 sm:py-4">
          <DialogTitle className="text-lg md:text-xl font-bold text-gray-900 line-clamp-1">
            {selectedPorte?.nomPersonnalise || `Porte ${selectedPorte?.numero}`}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500 mt-1 line-clamp-1">
            Étage {selectedPorte?.etage} • {immeubleAdresse}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 px-4 py-3 sm:p-5 overflow-y-auto overscroll-contain">
          <div className="w-[95%] max-w-4xl mx-auto space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-900 block">
                  Nom personnalisé
                </label>
                <div className="relative">
                  <Input
                    placeholder={selectedPorte ? `Porte ${selectedPorte.numero}` : 'Porte'}
                    value={editForm.nomPersonnalise}
                    onChange={e =>
                      setEditForm(prev => ({ ...prev, nomPersonnalise: e.target.value }))
                    }
                    className="h-12 text-base bg-white border-gray-300 text-gray-900 pr-24 focus:ring-2 focus:ring-blue-100"
                  />
                  {editForm.nomPersonnalise && (
                    <Button
                      variant="ghost"
                      onClick={() => setEditForm(prev => ({ ...prev, nomPersonnalise: '' }))}
                      className="absolute right-2 top-2 h-8"
                    >
                      <RotateCcw className="h-8 w-8" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {editForm.statut === 'RENDEZ_VOUS_PRIS' && (
              <div className="p-3 sm:p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
                <p className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Rendez-vous
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-700 block">Date *</label>
                    <input
                      type="date"
                      value={editForm.rdvDate}
                      onChange={e => setEditForm(prev => ({ ...prev, rdvDate: e.target.value }))}
                      className="w-auto h-10 p-2 text-black bg-white border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all border-2"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      Heure
                    </label>
                    <input
                      type="time"
                      value={editForm.rdvTime}
                      onChange={e => setEditForm(prev => ({ ...prev, rdvTime: e.target.value }))}
                      className="w-auto border-2 h-12 px-3 text-black bg-white border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {editForm.statut === 'CONTRAT_SIGNE' && (
              <div className="p-3 sm:p-4 bg-green-50/50 rounded-xl border border-green-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-green-100/80">
                      <FileSignature className="h-5 w-5 text-green-700" />
                    </div>
                    <span className="font-bold text-base text-green-700">Contrats</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-6 bg-white/60 p-3 rounded-xl border border-green-100">
                  <button
                    onClick={e => {
                      e.preventDefault()
                      setEditForm(prev => ({
                        ...prev,
                        nbContrats: Math.max(1, (prev.nbContrats || 1) - 1),
                      }))
                    }}
                    disabled={(editForm.nbContrats || 1) <= 1}
                    className="h-10 w-10 flex items-center justify-center rounded-lg bg-white border border-green-200 text-green-600 shadow-sm disabled:opacity-40 disabled:shadow-none hover:bg-green-50 transition-all"
                  >
                    <Minus className="h-6 w-6" />
                  </button>

                  <span className="text-4xl font-bold text-green-700 min-w-[3ch] text-center">
                    {editForm.nbContrats || 1}
                  </span>

                  <button
                    onClick={e => {
                      e.preventDefault()
                      setEditForm(prev => ({ ...prev, nbContrats: (prev.nbContrats || 1) + 1 }))
                    }}
                    className="h-10 w-10 flex items-center justify-center rounded-lg bg-green-600 text-white shadow-md hover:bg-green-700 active:scale-95 transition-all"
                  >
                    <Plus className="h-6 w-6" />
                  </button>
                </div>
              </div>
            )}

            {(editForm.statut === 'NECESSITE_REPASSAGE' || editForm.statut === 'ABSENT') && (
              <div className="p-3 sm:p-4 bg-orange-50/50 rounded-xl border border-orange-200 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <RotateCcw className="h-5 w-5 text-orange-600" />
                  <span className="font-bold text-base text-orange-700">Suivi de passage</span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-white/60 p-1 rounded-lg border border-orange-100">
                  <button
                    onClick={e => {
                      e.preventDefault()
                      const diff = 1 - (selectedPorte?.nbRepassages || 0)
                      if (diff !== 0) onRepassageChange(selectedPorte, diff)
                    }}
                    className={`py-3 text-sm font-bold rounded-md transition-all ${
                      (selectedPorte?.nbRepassages || 0) <= 1
                        ? 'bg-orange-100 text-orange-700 shadow-sm'
                        : 'text-gray-500 hover:bg-orange-50'
                    }`}
                  >
                    1er Passage
                  </button>

                  <button
                    onClick={e => {
                      e.preventDefault()
                      const diff = 2 - (selectedPorte?.nbRepassages || 0)
                      if (diff !== 0) onRepassageChange(selectedPorte, diff)
                    }}
                    className={`py-3 text-sm font-bold rounded-md transition-all ${
                      (selectedPorte?.nbRepassages || 0) >= 2
                        ? 'bg-orange-100 text-orange-700 shadow-sm'
                        : 'text-gray-500 hover:bg-orange-50'
                    }`}
                  >
                    2ème Passage
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-900 block">Commentaire</label>
              <Textarea
                placeholder="Ajouter un commentaire..."
                value={editForm.commentaire}
                onChange={e => setEditForm(prev => ({ ...prev, commentaire: e.target.value }))}
                className="min-h-[100px] text-base bg-white border-gray-300 text-gray-900 resize-none rounded-lg focus:border-gray-400 focus:ring-0"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="p-3 sm:p-4 border-t border-gray-1">
          <div className="grid grid-cols-2 gap-3 w-full">
            <Button
              variant="default"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="h-12 text-base font-medium bg-red-500 text-white"
            >
              Annuler
            </Button>
            <Button
              onClick={onSave}
              disabled={isSaving}
              className="h-12 text-base font-medium bg-blue-600 text-white hover:bg-blue-700"
            >
              {isSaving ? '...' : 'Enregistrer'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
