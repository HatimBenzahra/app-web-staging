import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Filter, Calendar, Clock } from 'lucide-react'
import { useState } from 'react'

// Fonction utilitaire pour obtenir les dates selon les presets
const getDatePreset = preset => {
  const today = new Date()
  const endDate = new Date(today)
  endDate.setHours(23, 59, 59, 999)

  let startDate = new Date(today)
  startDate.setHours(0, 0, 0, 0)

  switch (preset) {
    case 'today':
      startDate.setDate(today.getDate() + 1)
      endDate.setDate(today.getDate())
      break
    case 'yesterday':
      startDate.setDate(today.getDate() - 1)
      endDate.setDate(today.getDate() - 1)
      break
    case 'last7days':
      startDate.setDate(today.getDate() - 6)
      break
    case 'last14days':
      startDate.setDate(today.getDate() - 13)
      break
    case 'last30days':
      startDate.setDate(today.getDate() - 29)
      break
    case 'thisWeek':
      const dayOfWeek = today.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      startDate.setDate(today.getDate() + mondayOffset)
      break
    case 'lastWeek':
      const lastWeekEnd = new Date(today)
      lastWeekEnd.setDate(today.getDate() - today.getDay())
      lastWeekEnd.setHours(23, 59, 59, 999)
      const lastWeekStart = new Date(lastWeekEnd)
      lastWeekStart.setDate(lastWeekEnd.getDate() - 6)
      lastWeekStart.setHours(0, 0, 0, 0)
      return {
        start: lastWeekStart.toISOString().split('T')[0],
        end: lastWeekEnd.toISOString().split('T')[0],
      }
    case 'thisMonth':
      startDate.setDate(1)
      break
    case 'lastMonth':
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      return {
        start: lastMonthStart.toISOString().split('T')[0],
        end: lastMonthEnd.toISOString().split('T')[0],
      }
    case 'all':
      return { start: '', end: '' }
    default:
      break
  }

  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  }
}

const DATE_PRESETS = [
  { id: 'today', label: "Aujourd'hui", icon: '📅' },
  { id: 'yesterday', label: 'Hier', icon: '📆' },
  { id: 'last7days', label: '7 derniers jours', icon: '📊' },
  { id: 'last14days', label: '14 derniers jours', icon: '📈' },
  { id: 'last30days', label: '30 derniers jours', icon: '📉' },
  { id: 'thisWeek', label: 'Cette semaine', icon: '🗓️' },
  { id: 'lastWeek', label: 'Semaine dernière', icon: '📋' },
  { id: 'thisMonth', label: 'Ce mois-ci', icon: '🗂️' },
  { id: 'lastMonth', label: 'Mois dernier', icon: '📁' },
  { id: 'all', label: 'Tout', icon: '🌐' },
]

export default function DateRangeFilter({
  startDate,
  endDate,
  appliedStartDate,
  appliedEndDate,
  onChangeStart,
  onChangeEnd,
  onApply,
  onReset,
  className = '',
  title = 'Filtres de période',
  showDateTypeSelector = false,
  dateType = 'created',
  onDateTypeChange,
}) {
  const [selectedPreset, setSelectedPreset] = useState(null)
  const [showCustomDates, setShowCustomDates] = useState(true)
  const hasAnyValue = Boolean(startDate || endDate || appliedStartDate || appliedEndDate)

  const handlePresetClick = preset => {
    const dates = getDatePreset(preset.id)
    setSelectedPreset(preset.id)
    onChangeStart?.(dates.start)
    onChangeEnd?.(dates.end)

    // Appliquer automatiquement le filtre
    setTimeout(() => {
      onApply?.()
    }, 100)
  }

  const handleCustomDateChange = () => {
    setSelectedPreset(null)
  }

  return (
    <Card className={`border-2 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Sélecteur de type de date */}
          {showDateTypeSelector && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Filtrer par</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onDateTypeChange?.('created')}
                  className={`
                    flex-1 px-4 py-2.5 rounded-lg text-sm font-medium
                    transition-all duration-200
                    ${dateType === 'created'
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-secondary/50 text-secondary-foreground hover:bg-secondary'
                    }
                  `}
                >
                  📅 Date de création
                </button>
                <button
                  onClick={() => onDateTypeChange?.('modified')}
                  className={`
                    flex-1 px-4 py-2.5 rounded-lg text-sm font-medium
                    transition-all duration-200
                    ${dateType === 'modified'
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-secondary/50 text-secondary-foreground hover:bg-secondary'
                    }
                  `}
                >
                  🔄 Date de modification
                </button>
              </div>
            </div>
          )}

          {/* Filtres par bulles */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Périodes rapides</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {DATE_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset)}
                  className={`
                    inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium
                    transition-all duration-200 transform hover:scale-105 hover:shadow-md
                    ${selectedPreset === preset.id
                      ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                      : 'bg-secondary/50 text-secondary-foreground hover:bg-secondary'
                    }
                  `}
                >
                  <span className="text-base">{preset.icon}</span>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Séparateur avec option pour dates personnalisées */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <button
                onClick={() => setShowCustomDates(!showCustomDates)}
                className="bg-background px-2 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Calendar className="h-3 w-3" />
                Dates personnalisées
              </button>
            </div>
          </div>

          {/* Dates personnalisées (affichées conditionnellement) */}
          {showCustomDates && (
            <div className="space-y-4 animate-in fade-in-50 slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="start-date" className="text-sm font-medium">
                    Date de début
                  </label>
                  <input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={e => {
                      onChangeStart?.(e.target.value)
                      handleCustomDateChange()
                    }}
                    max={endDate || new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="end-date" className="text-sm font-medium">
                    Date de fin
                  </label>
                  <input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={e => {
                      onChangeEnd?.(e.target.value)
                      handleCustomDateChange()
                    }}
                    min={startDate || undefined}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={onApply} disabled={!startDate && !endDate}>
                  Appliquer
                </Button>
              </div>
            </div>
          )}

          {/* Affichage de la période sélectionnée et bouton reset */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm">
              {appliedStartDate || appliedEndDate ? (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Période:</span>
                  <span className="font-medium text-primary">
                    {appliedStartDate
                      ? new Date(appliedStartDate).toLocaleDateString('fr-FR')
                      : 'Début'}{' '}
                    -{' '}
                    {appliedEndDate ? new Date(appliedEndDate).toLocaleDateString('fr-FR') : 'Fin'}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground">Toutes les périodes</span>
              )}
            </div>

            {hasAnyValue && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onReset()
                  setSelectedPreset(null)
                }}
              >
                Réinitialiser
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
