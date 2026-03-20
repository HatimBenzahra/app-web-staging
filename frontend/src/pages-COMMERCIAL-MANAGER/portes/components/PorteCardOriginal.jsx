import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, RotateCcw, Calendar, FileSignature } from 'lucide-react'
import { useCommercialTheme } from '@/hooks/ui/use-commercial-theme'
import { StatutPorte } from '@/constants/domain/porte-status'

export default function PorteCardOriginal({
  porte,
  statutOptions,
  onQuickStatusChange,
  onEdit,
  onRepassageChange,
  readOnly = false,
}) {
  const { colors, base, getButtonClasses } = useCommercialTheme()

  const getStatutInfo = statut => {
    return statutOptions.find(option => option.value === statut) || statutOptions[0]
  }

  const statutInfo = getStatutInfo(porte.statut)
  const IconComponent = statutInfo.icon

  const needsRepassage = porte.statut === 'ABSENT'

  if (readOnly) {
    // Version simple pour le mode lecture
    return (
      <Card
        className={`${base.bg.card} border-2 ${
          porte.statut === 'NON_VISITE'
            ? base.border.default
            : `${statutInfo.color.split(' ')[0].replace('bg-', 'border-')}`
        } shadow-md hover:shadow-xl transition-all duration-200`}
      >
        <CardContent className="p-3 sm:p-3.5 md:p-4">
          <div className="space-y-3">
            {/* En-tête avec numéro de porte */}
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-bold text-lg sm:text-xl ${base.text.primary}`}>
                  {porte.nomPersonnalise || `Porte ${porte.numero}`}
                </p>
                {porte.nomPersonnalise && (
                  <p className={`text-xs sm:text-sm ${base.text.muted}`}>N° {porte.numero}</p>
                )}
              </div>
              <Badge
                className={`${statutInfo.color} text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1`}
              >
                <IconComponent className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                <span className="hidden sm:inline">{statutInfo.label}</span>
              </Badge>
            </div>

            {/* RDV info - Afficher uniquement si le statut est RENDEZ_VOUS_PRIS */}
            {porte.statut === StatutPorte.RENDEZ_VOUS_PRIS && porte.rdvDate && (
              <div
                className={`${colors.primary.bgLight} border ${colors.primary.border} rounded-lg p-2 sm:p-2.5`}
              >
                <div
                  className={`flex items-center gap-1.5 sm:gap-2 ${colors.primary.textLight} font-semibold text-xs sm:text-sm`}
                >
                  <Calendar className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                  <span>{new Date(porte.rdvDate).toLocaleDateString('fr-FR')}</span>
                  {porte.rdvTime && <span>à {porte.rdvTime}</span>}
                </div>
              </div>
            )}

            {/* Commentaire */}
            {porte.commentaire && (
              <div
                className={`${base.bg.muted} border ${base.border.default} rounded-lg p-2 sm:p-2.5`}
              >
                <p className={`text-xs sm:text-sm ${base.text.secondary}`}>{porte.commentaire}</p>
              </div>
            )}

            {/* Repassages en mode lecture */}
            {porte.nbRepassages > 0 && (
              <div
                className={`${colors.warning.bgLight} border ${colors.warning.border} rounded-lg p-2 sm:p-2.5`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <RotateCcw className={`h-4 w-4 sm:h-4.5 sm:w-4.5 ${colors.warning.text}`} />
                  <span className={`font-bold text-xs sm:text-sm ${colors.warning.text}`}>
                    Repassages : {porte.nbRepassages}
                  </span>
                </div>
              </div>
            )}

            {/* Nombre de contrats en mode lecture */}
            {porte.statut === 'CONTRAT_SIGNE' && porte.nbContrats > 1 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-2.5 ">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <FileSignature className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-green-600" />
                  <span className="font-bold text-xs sm:text-sm text-green-600">
                    {porte.nbContrats} contrats signés
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Version complète pour le mode gestion
  return (
    <Card
      className={`${base.bg.card} border-2 ${
        porte.statut === 'NON_VISITE'
          ? base.border.default
          : `${statutInfo.color.split(' ')[0].replace('bg-', 'border-')}`
      } shadow-md hover:shadow-xl transition-all duration-200 `}
    >
      <CardContent className="p-3 sm:p-3.5 md:p-4">
        <div className="space-y-3">
          {/* En-tête avec numéro de porte */}
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-bold text-lg sm:text-xl ${base.text.primary}`}>
                {porte.nomPersonnalise || `Porte ${porte.numero}`}
              </p>
              {porte.nomPersonnalise && (
                <p className={`text-xs sm:text-sm ${base.text.muted}`}>N° {porte.numero}</p>
              )}
            </div>
            <Badge
              className={`${statutInfo.color} text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1`}
            >
              <IconComponent className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
              <span className="hidden sm:inline">{statutInfo.label}</span>
            </Badge>
          </div>

          {/* BOUTONS D'ACTION RAPIDE - GROS ET VISIBLES */}
          <div className="space-y-1.5 sm:space-y-2">
            <p className={`text-[10px] sm:text-xs font-semibold ${base.text.muted} uppercase`}>
              Action rapide :
            </p>
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {/* Génération dynamique des boutons basée sur statutOptions (centralisé) */}
              {statutOptions
                .filter(
                  option =>
                    option.value !== StatutPorte.NON_VISITE &&
                    option.value !== StatutPorte.NECESSITE_REPASSAGE
                )
                .map(option => {
                  const Icon = option.icon
                  const isActive = porte.statut === option.value

                  return (
                    <Button
                      key={option.value}
                      variant="ghost"
                      size="lg"
                      onClick={() => onQuickStatusChange(porte, option.value)}
                      className={`h-14 sm:h-16 flex flex-col items-center justify-center gap-1 sm:gap-1.5 ${
                        isActive
                          ? `${option.color} border-2 shadow-lg`
                          : `${base.bg.muted} ${base.text.primary} hover:${option.color.split(' ')[0]} border ${base.border.default}`
                      } font-bold transition-all duration-200`}
                    >
                      <Icon className="h-5 w-5 sm:h-5.5 sm:w-5.5" />
                      <span className="text-[10px] sm:text-xs">{option.label}</span>
                    </Button>
                  )
                })}
            </div>
          </div>

          {/* GESTION DES REPASSAGES */}
          {needsRepassage && (
            <div
              className={`mt-2 ${colors.warning.bgLight} border ${colors.warning.border} rounded-xl p-3 overflow-hidden relative`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3 relative z-10">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${colors.warning.bg} bg-opacity-20`}>
                    <RotateCcw className={`h-4 w-4 ${colors.warning.text}`} />
                  </div>
                  <span className={`font-bold text-sm ${colors.warning.text}`}>
                    Suivi de passage
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`${colors.warning.border} ${colors.warning.text} bg-white/50`}
                >
                  {porte.nbRepassages || 0} visite{(porte.nbRepassages || 0) > 1 ? 's' : ''}
                </Badge>
              </div>

              {/* Segmented Control / Switch */}
              <div className="bg-gray-100 p-1 rounded-lg flex relative border border-gray-200/50">
                <button
                  onClick={e => {
                    e.stopPropagation()
                    const diff = 1 - (porte.nbRepassages || 0)
                    if (diff !== 0) onRepassageChange(porte, diff)
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-bold rounded-md transition-all duration-300 ${
                    (porte.nbRepassages || 0) <= 1
                      ? `bg-white ${colors.warning.text} shadow-sm scale-100`
                      : 'text-gray-500 hover:bg-white/60'
                  }`}
                >
                  <span className={(porte.nbRepassages || 0) <= 1 ? 'opacity-100' : 'opacity-70'}>
                    1er Passage
                  </span>
                </button>

                <button
                  onClick={e => {
                    e.stopPropagation()
                    const diff = 2 - (porte.nbRepassages || 0)
                    if (diff !== 0) onRepassageChange(porte, diff)
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-bold rounded-md transition-all duration-300 ${
                    (porte.nbRepassages || 0) >= 2
                      ? `bg-white ${colors.warning.text} shadow-sm scale-100`
                      : 'text-gray-500 hover:bg-white/60'
                  }`}
                >
                  <span className={(porte.nbRepassages || 0) >= 2 ? 'opacity-100' : 'opacity-70'}>
                    2ème Passage
                  </span>
                </button>
              </div>

              <p
                className={`text-[10px] text-center mt-2 ${colors.warning.text} opacity-70 font-medium`}
              >
                {(porte.nbRepassages || 0) <= 1
                  ? ' Passage initial (Matin)'
                  : ' Repassage effectué (Soir)'}
              </p>
            </div>
          )}

          {/* RDV info - Afficher uniquement si le statut est RENDEZ_VOUS_PRIS */}
          {porte.statut === StatutPorte.RENDEZ_VOUS_PRIS && porte.rdvDate && (
            <div
              className={`${colors.primary.bgLight} border ${colors.primary.border} rounded-lg p-2 sm:p-2.5`}
            >
              <div
                className={`flex items-center gap-1.5 sm:gap-2 ${colors.primary.textLight} font-semibold text-xs sm:text-sm`}
              >
                <Calendar className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                <span>{new Date(porte.rdvDate).toLocaleDateString('fr-FR')}</span>
                {porte.rdvTime && <span>à {porte.rdvTime}</span>}
              </div>
            </div>
          )}

          {/* Commentaire */}
          {porte.commentaire && (
            <div
              className={`${base.bg.muted} border ${base.border.default} rounded-lg p-2 sm:p-2.5`}
            >
              <p className={`text-xs sm:text-sm ${base.text.secondary}`}>{porte.commentaire}</p>
            </div>
          )}

          {/* Nombre de contrats - Mode gestion */}
          {porte.statut === 'CONTRAT_SIGNE' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 sm:p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-green-100">
                    <FileSignature className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-green-600" />
                  </div>
                  <span className="font-bold text-sm sm:text-base text-green-600">
                    Contrats signés
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="border-green-300 text-green-700 bg-white/50 backdrop-blur-sm shadow-sm font-bold"
                >
                  {porte.nbContrats || 1} contrat{(porte.nbContrats || 1) > 1 ? 's' : ''}
                </Badge>
              </div>
              {porte.nbContrats > 1 && (
                <p className="text-[10px] sm:text-xs text-center mt-2 text-green-600 opacity-70 font-medium">
                  Le client a signé plusieurs contrats
                </p>
              )}
            </div>
          )}

          {/* Bouton pour ajouter/modifier détails */}
          <Button
            variant="ghost"
            size="lg"
            onClick={() => onEdit(porte)}
            className={`w-full h-10 sm:h-11 ${getButtonClasses('outline')} text-sm sm:text-base font-semibold`}
          >
            <MessageSquare className="h-4 w-4 sm:h-4.5 sm:w-4.5 mr-2" />
            {porte.commentaire || porte.nomPersonnalise
              ? 'Modifier les détails'
              : 'Ajouter des détails'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
