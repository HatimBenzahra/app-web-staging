import React from 'react'
import { Box, Globe, Map as MapIcon, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Reusable Map Control Button Component
 */
const MapControlButton = ({ onClick, active, icon: Icon, activeIcon: ActiveIcon, tooltip, activeTooltip, className, children }) => {
  const DisplayIcon = active && ActiveIcon ? ActiveIcon : Icon
  
  return (
    <div className={cn("absolute z-10 group", className)}>
      <button
        onClick={onClick}
        className={cn(
          "flex items-center justify-center w-12 h-12 rounded-2xl shadow-xl transition-all duration-300 backdrop-blur-md border",
          active 
            ? "bg-primary text-primary-foreground border-primary/50 shadow-primary/25" 
            : "bg-background/80 text-foreground border-white/20 hover:bg-white/90"
        )}
        title={active ? activeTooltip : tooltip}
      >
        <DisplayIcon className={cn("w-6 h-6 transition-transform duration-500", active && !ActiveIcon ? "rotate-12 scale-110" : "")} />
        {children}
      </button>
      <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-2 py-1 bg-black/75 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {active ? activeTooltip : tooltip}
      </div>
    </div>
  )
}

export const ThreeDButton = ({ onClick, show3D, className }) => (
  <MapControlButton
    onClick={onClick}
    active={show3D}
    icon={Box}
    tooltip="Activer la 3D"
    activeTooltip="Désactiver la 3D"
    className={cn("bottom-8 right-4", className)}
  />
)

export const MapStyleButton = ({ onClick, isSatellite, className }) => (
  <MapControlButton
    onClick={onClick}
    active={isSatellite}
    icon={MapIcon}
    activeIcon={Globe}
    tooltip="Vue Satellite"
    activeTooltip="Vue Plan"
    className={cn("bottom-24 right-4", className)}
  />
)

export const ZonesToggleButton = ({ onClick, showZones, className }) => (
  <MapControlButton
    onClick={onClick}
    active={showZones}
    icon={Layers}
    tooltip="Afficher les autres zones"
    activeTooltip="Masquer les autres zones"
    className={cn("bottom-40 right-4", className)}
  />
)
