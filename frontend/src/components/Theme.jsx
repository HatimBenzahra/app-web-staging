import { useState, useEffect } from 'react'
import { Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useTheme } from '@/hooks/ui/use-theme'
import { applyPreset, getSavedPreset } from '@/config/theme/presets'

export default function ThemeSelector() {
  const { theme: mode } = useTheme()
  // Charge le preset sauvegardé au démarrage
  const [selectedTheme, setSelectedTheme] = useState(() => getSavedPreset())

  // Met à jour le thème sélectionné si le localStorage change
  useEffect(() => {
    const savedPreset = getSavedPreset()
    setSelectedTheme(savedPreset)
  }, [])

  const presets = {
    default: { name: 'Défaut', color: '#333' },
    ocean: { name: 'Océan', color: '#3b82f6' },
    nature: { name: 'Nature', color: '#10b981' },
    royal: { name: 'Royal', color: '#8b5cf6' },
    energy: { name: 'Énergie', color: '#f97316' },
    modern: { name: 'Moderne', color: '#ec4899' },
    tech: { name: 'Tech', color: '#06b6d4' },
    passion: { name: 'Passion', color: '#ef4444' },
    professional: { name: 'Professionnel', color: '#6366f1' },
    solar: { name: 'Solaire', color: '#eab308' },
  }

  const handleThemeSelect = presetName => {
    // Lire directement le mode depuis le DOM pour être sûr d'avoir la valeur actuelle
    const currentMode = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    applyPreset(presetName, currentMode)
    setSelectedTheme(presetName)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Palette className="h-4 w-4" />
          <span className="sr-only">Changer le thème</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="flex items-center justify-between">
          Thèmes prédéfinis
          {selectedTheme !== 'default' && (
            <Badge variant="outline" className="text-xs">
              {presets[selectedTheme]?.name}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {Object.entries(presets).map(([key, { name, color }]) => (
          <DropdownMenuItem
            key={key}
            onClick={() => handleThemeSelect(key)}
            className="cursor-pointer"
          >
            <div className="flex items-center gap-2 w-full">
              <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: color }} />
              <span className="flex-1">{name}</span>
              {selectedTheme === key && <span className="text-xs text-muted-foreground">✓</span>}
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          Mode: {mode === 'dark' ? 'Sombre' : 'Clair'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
