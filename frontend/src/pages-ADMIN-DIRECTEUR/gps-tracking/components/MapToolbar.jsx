import { Maximize, Minimize, Mountain, Building2, Layers, Crosshair } from 'lucide-react'

export default function MapToolbar({
  isFullscreen,
  onToggleFullscreen,
  is3DTerrain,
  onToggle3DTerrain,
  is3DBuildings,
  onToggle3DBuildings,
  mapStyleLabel,
  onStyleSwitch,
  onCenter,
}) {
  const btn = (active, onClick, title, children) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`h-9 w-9 flex items-center justify-center rounded-lg transition-all ${
        active
          ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )

  return (
    <div className="absolute top-3 left-3 z-10">
      <div className="flex flex-col gap-1 rounded-xl bg-background/90 backdrop-blur-sm border border-border/50 shadow-lg p-1.5">
        {btn(
          isFullscreen,
          onToggleFullscreen,
          isFullscreen ? 'Quitter le plein écran' : 'Plein écran',
          isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />
        )}
        <div className="h-px bg-border/50 mx-1" />
        {btn(is3DTerrain, onToggle3DTerrain, 'Terrain 3D', <Mountain className="h-4 w-4" />)}
        {btn(is3DBuildings, onToggle3DBuildings, 'Bâtiments 3D', <Building2 className="h-4 w-4" />)}
        <div className="h-px bg-border/50 mx-1" />
        <div className="relative group">
          {btn(false, onStyleSwitch, `Style: ${mapStyleLabel}`, <Layers className="h-4 w-4" />)}
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="whitespace-nowrap rounded-md bg-background/95 backdrop-blur-sm border border-border/50 shadow-md px-2 py-1 text-[11px] font-medium text-foreground">
              {mapStyleLabel}
            </span>
          </div>
        </div>
        <div className="h-px bg-border/50 mx-1" />
        {btn(false, onCenter, 'Centrer', <Crosshair className="h-4 w-4" />)}
      </div>
    </div>
  )
}
