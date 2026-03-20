import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Filter, X } from 'lucide-react'
import { useCommercialTheme } from '@/hooks/ui/use-commercial-theme'

export default function StatusFilters({
  statutOptions,
  selectedStatuts = [],
  onStatutToggle,
  onClearAll,
  portesCount = {},
  className = '',
}) {
  const { base } = useCommercialTheme()

  const hasActiveFilters = selectedStatuts.length > 0

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header des filtres */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className={`h-4 w-4 ${base.text.primary}`} />
          <span className={`text-sm font-medium ${base.text.primary}`}>Filtrer par statut</span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-xs">
              {selectedStatuts.length} actif{selectedStatuts.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className={`h-7 px-2 text-xs ${base.text.muted} hover:${base.text.primary}`}
          >
            <X className="h-3 w-3 mr-1" />
            Effacer
          </Button>
        )}
      </div>

      {/* Filtres par statut */}
      <div className="flex flex-wrap gap-2">
        {statutOptions.map(option => {
          const isSelected = selectedStatuts.includes(option.value)
          const count = portesCount[option.value] || 0
          const IconComponent = option.icon

          return (
            <Button
              key={option.value}
              variant="ghost"
              size="sm"
              onClick={() => onStatutToggle(option.value)}
              className={`h-auto px-3 py-2 text-xs font-medium border transition-all duration-200 ${
                isSelected
                  ? `${option.color} border-current shadow-md scale-105`
                  : `${base.bg.muted} ${base.text.muted} border-transparent hover:${option.color.split(' ')[0]} hover:${option.color.split(' ')[1]} hover:border-current`
              }`}
              disabled={count === 0}
            >
              <div className="flex items-center gap-1.5">
                <IconComponent className="h-3.5 w-3.5" />
                <span className="truncate">{option.label}</span>
                <Badge
                  variant="secondary"
                  className={`ml-1 h-5 px-1.5 text-[10px] ${
                    isSelected ? 'bg-white/20 text-current' : ''
                  }`}
                >
                  {count}
                </Badge>
              </div>
            </Button>
          )
        })}
      </div>

      {/* Résumé des filtres actifs */}
      {hasActiveFilters && (
        <div className={`text-xs ${base.text.muted} flex items-center gap-1`}>
          <span>Affichage :</span>
          {selectedStatuts.map((statut, index) => {
            const option = statutOptions.find(opt => opt.value === statut)
            if (!option) return null

            return (
              <React.Fragment key={statut}>
                <span className="font-medium">{option.label}</span>
                {index < selectedStatuts.length - 1 && <span>•</span>}
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
