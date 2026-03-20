import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Edit3, Minus, Plus, Calendar, User, MessageSquare } from 'lucide-react'
import { useCommercialTheme } from '@/hooks/ui/use-commercial-theme'

export default function PorteCard({
  porte,
  statutOptions,
  onQuickStatusChange,
  onEdit,
  onRepassageChange,
  readOnly = false,
}) {
  const { base, colors, getButtonClasses } = useCommercialTheme()

  // Obtenir les informations du statut
  const getStatutInfo = statut => {
    const option = statutOptions.find(opt => opt.value === statut)
    return option || statutOptions[0] // Fallback sur le premier statut
  }

  const statutInfo = getStatutInfo(porte.statut)
  const IconComponent = statutInfo.icon

  // Formatage de la date de derni�re visite
  const formatDerniereVisite = date => {
    if (!date) return 'Jamais'
    const d = new Date(date)
    const now = new Date()
    const diffTime = Math.abs(now - d)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) return "Aujourd'hui"
    if (diffDays === 2) return 'Hier'
    if (diffDays <= 7) return `Il y a ${diffDays - 1} jours`

    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    })
  }

  // Formatage du RDV
  const formatRdv = () => {
    if (!porte.rdvDate) return null

    const rdvDate = new Date(porte.rdvDate)
    const dateStr = rdvDate.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    })

    return porte.rdvTime ? `${dateStr} � ${porte.rdvTime}` : dateStr
  }

  return (
    <Card
      className={`${base.bg.card} ${base.border.card} shadow-sm hover:shadow-md transition-all duration-200`}
    >
      <CardContent className="p-3 sm:p-4">
        {/* En-t�te de la porte */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`text-lg sm:text-xl font-bold ${base.text.primary} truncate`}>
                {porte.nomPersonnalise || `Porte ${porte.numero}`}
              </h3>
              {porte.nomPersonnalise && (
                <span
                  className={`text-xs ${base.text.muted} bg-gray-100 px-2 py-0.5 rounded shrink-0`}
                >
                  {porte.numero}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
              <span>�tage {porte.etage}</span>
              <span>"</span>
              <span>Visit� {formatDerniereVisite(porte.derniereVisite)}</span>
            </div>
          </div>

          {/* Bouton d'�dition */}
          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(porte)}
              className={`${getButtonClasses('secondary')} h-8 w-8 p-0 shrink-0`}
            >
              <Edit3 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Statut */}
        <div className="mb-3">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${statutInfo.color}`}
          >
            <IconComponent className="h-4 w-4" />
            <span>{statutInfo.label}</span>
          </div>
        </div>

        {/* Informations sp�ciales selon le statut */}
        <div className="space-y-2 mb-3">
          {/* RDV programm� */}
          {porte.statut === 'RENDEZ_VOUS_PRIS' && porte.rdvDate && (
            <div
              className={`flex items-center gap-2 p-2 rounded-lg ${colors.primary.bgLight} border ${colors.primary.border}`}
            >
              <Calendar className={`h-4 w-4 ${colors.primary.textLight}`} />
              <span className={`text-sm font-medium ${colors.primary.textLight}`}>
                RDV: {formatRdv()}
              </span>
            </div>
          )}

          {/* Commentaire */}
          {porte.commentaire && (
            <div
              className={`flex items-start gap-2 p-2 rounded-lg ${base.bg.muted} border ${base.border.default}`}
            >
              <MessageSquare className={`h-4 w-4 ${base.text.muted} mt-0.5 shrink-0`} />
              <span className={`text-sm ${base.text.secondary} wrap-break-word`}>
                {porte.commentaire}
              </span>
            </div>
          )}

          {/* Nom personnalis� affich� comme contact */}
          {porte.nomPersonnalise && (
            <div
              className={`flex items-center gap-2 p-2 rounded-lg ${colors.info.bgLight} border ${colors.info.border}`}
            >
              <User className={`h-4 w-4 ${colors.info.text}`} />
              <span className={`text-sm font-medium ${colors.info.text}`}>
                {porte.nomPersonnalise}
              </span>
            </div>
          )}
        </div>

        {/* Actions rapides et repassages */}
        {!readOnly && (
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
            {/* Boutons de statut rapide */}
            <div className="flex gap-1.5 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onQuickStatusChange(porte, 'CONTRAT_SIGNE')}
                className={`h-8 px-2 text-xs ${colors.success.bgLight} ${colors.success.text} border ${colors.success.border} hover:bg-green-200 flex-1`}
                disabled={porte.statut === 'CONTRAT_SIGNE'}
              >
                Signé
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onQuickStatusChange(porte, 'RENDEZ_VOUS_PRIS')}
                className={`h-8 px-2 text-xs ${colors.primary.bgLight} ${colors.primary.textLight} border ${colors.primary.border} hover:bg-blue-200 flex-1`}
                disabled={porte.statut === 'RENDEZ_VOUS_PRIS'}
              >
                RDV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onQuickStatusChange(porte, 'REFUS')}
                className={`h-8 px-2 text-xs ${colors.danger.bgLight} ${colors.danger.text} border ${colors.danger.border} hover:bg-red-200 flex-1`}
                disabled={porte.statut === 'REFUS'}
              >
                Refus
              </Button>
            </div>

            {/* Gestion des repassages */}
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRepassageChange(porte, -1)}
                className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                disabled={porte.nbRepassages <= 0}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-sm font-medium px-2 min-w text-center">
                {porte.nbRepassages || 0}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRepassageChange(porte, 1)}
                className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Mode lecture seule - juste afficher les repassages */}
        {readOnly && porte.nbRepassages > 0 && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
            <span className={`text-sm ${base.text.muted}`}>Repassages:</span>
            <span className="text-sm font-medium px-2 py-1 bg-gray-100 rounded">
              {porte.nbRepassages}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
