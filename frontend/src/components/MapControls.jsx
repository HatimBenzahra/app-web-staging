import React from 'react'
import { Box, Globe, Map as MapIcon, Layers, Pencil, Undo2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Reusable Map Control Button Component
 */
const MapControlButton = ({
  onClick,
  active,
  disabled,
  icon: Icon,
  activeIcon: ActiveIcon,
  tooltip,
  activeTooltip,
  tooltipSide = 'left',
  className,
  children,
}) => {
  const DisplayIcon = active && ActiveIcon ? ActiveIcon : Icon
  const label = active ? activeTooltip : tooltip

  return (
    <div className={cn('absolute z-10 group', className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'flex items-center justify-center w-12 h-12 rounded-2xl shadow-xl transition-all duration-300 backdrop-blur-md border',
          disabled
            ? 'bg-background/60 text-muted-foreground/50 border-white/10 cursor-not-allowed'
            : active
              ? 'bg-primary text-primary-foreground border-primary/50 shadow-primary/25'
              : 'bg-background/80 text-foreground border-white/20 hover:bg-white/90'
        )}
        title={label}
      >
        <DisplayIcon
          className={cn(
            'w-6 h-6 transition-transform duration-500',
            active && !ActiveIcon ? 'rotate-12 scale-110' : ''
          )}
        />
        {children}
      </button>
      {!disabled && (
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 px-2 py-1 bg-black/75 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none',
            tooltipSide === 'right' ? 'left-full ml-3' : 'right-full mr-3'
          )}
        >
          {label}
        </div>
      )}
    </div>
  )
}

/* --- Outils de dessin (colonne haut-gauche, sous le geocoder) --- */

export const DrawButton = ({ onClick, hasPolygon, className }) => (
  <MapControlButton
    onClick={onClick}
    icon={Pencil}
    tooltip={hasPolygon ? 'Redessiner la zone' : 'Dessiner la zone'}
    tooltipSide="right"
    className={cn('top-20 left-4', className)}
  />
)

export const UndoPointButton = ({ onClick, disabled, className }) => (
  <MapControlButton
    onClick={onClick}
    disabled={disabled}
    icon={Undo2}
    tooltip="Annuler le dernier point"
    tooltipSide="right"
    className={cn('top-36 left-4', className)}
  />
)

export const ClearDrawButton = ({ onClick, disabled, className }) => (
  <MapControlButton
    onClick={onClick}
    disabled={disabled}
    icon={Trash2}
    tooltip="Effacer le tracé"
    tooltipSide="right"
    className={cn('top-52 left-4', className)}
  />
)

/* --- Options de carte (colonne bas-gauche) --- */

export const ThreeDButton = ({ onClick, show3D, className }) => (
  <MapControlButton
    onClick={onClick}
    active={show3D}
    icon={Box}
    tooltip="Activer la 3D"
    activeTooltip="Désactiver la 3D"
    tooltipSide="right"
    className={cn('bottom-8 left-4', className)}
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
    tooltipSide="right"
    className={cn('bottom-24 left-4', className)}
  />
)

export const ZonesToggleButton = ({ onClick, showZones, className }) => (
  <MapControlButton
    onClick={onClick}
    active={showZones}
    icon={Layers}
    tooltip="Afficher les autres zones"
    activeTooltip="Masquer les autres zones"
    tooltipSide="right"
    className={cn('bottom-40 left-4', className)}
  />
)
