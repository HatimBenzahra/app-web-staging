import React from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useTerrainToday } from './useTerrainToday'
import TerrainMapCard from './TerrainMapCard'
import ActiveCommercialsCard from './ActiveCommercialsCard'

const GRID = 'grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6'

/**
 * Terrain du jour : la carte (dominante) et la liste des commerciaux actifs
 * aujourd'hui. Deux cards distinctes, une seule sélection partagée — d'où le hook
 * porté ici plutôt que dans chacune des cards.
 */
export default function TerrainToday() {
  const {
    commercials,
    located,
    selectedKey,
    selectedActor,
    selectActor,
    route,
    colorFor,
    isLoading,
  } = useTerrainToday()

  if (isLoading) {
    return (
      <div className={GRID}>
        <Card className="gap-0 overflow-hidden p-0">
          <Skeleton className="h-[320px] w-full rounded-none lg:h-[440px]" />
        </Card>
        <Card className="gap-0 overflow-hidden py-0 lg:h-[440px]">
          <div className="space-y-1.5 px-3 py-3">
            <Skeleton className="mb-2 h-5 w-28" />
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className={GRID}>
      <TerrainMapCard
        located={located}
        selectedKey={selectedKey}
        selectedActor={selectedActor}
        selectActor={selectActor}
        route={route}
        colorFor={colorFor}
      />
      <ActiveCommercialsCard
        commercials={commercials}
        selectedKey={selectedKey}
        selectActor={selectActor}
        colorFor={colorFor}
      />
    </div>
  )
}
