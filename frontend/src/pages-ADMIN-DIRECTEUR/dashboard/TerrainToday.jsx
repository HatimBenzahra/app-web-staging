import React, { useCallback, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useTerrainToday } from './useTerrainToday'
import { useAssignedZones } from './useAssignedZones'
import TerrainMapCard from './TerrainMapCard'
import ActiveCommercialsCard from './ActiveCommercialsCard'
import AssignedZonesCard from './AssignedZonesCard'

const GRID = 'grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6'
const SIDE_COLUMN = 'flex flex-col gap-6 lg:h-[440px]'

/**
 * Terrain du jour : la carte (dominante) et, dans la colonne de droite, les
 * commerciaux actifs puis les zones assignées. Trois cards pour une seule carte,
 * d'où les hooks portés ici et le focus arbitré à un seul endroit.
 */
export default function TerrainToday() {
  const {
    commercials,
    located,
    selectedKey,
    selectedActor,
    selectActor,
    clearActor,
    route,
    colorFor,
    isLoading,
  } = useTerrainToday()
  const { zones, loading: zonesLoading } = useAssignedZones()
  const [selectedZoneId, setSelectedZoneId] = useState(null)

  // Les deux focus s'excluent : une zone ou un commercial, jamais les deux.
  const handleSelectActor = useCallback(
    actor => {
      setSelectedZoneId(null)
      selectActor(actor)
    },
    [selectActor]
  )

  const handleSelectZone = useCallback(
    zone => {
      if (!zone?.canFocus) return
      clearActor()
      setSelectedZoneId(current => (current === zone.id ? null : zone.id))
    },
    [clearActor]
  )

  const focusedZone = useMemo(
    () => zones.find(z => z.id === selectedZoneId) ?? null,
    [zones, selectedZoneId]
  )

  if (isLoading) {
    return (
      <div className={GRID}>
        <Card className="gap-0 overflow-hidden p-0">
          <Skeleton className="h-[320px] w-full rounded-none lg:h-[440px]" />
        </Card>
        <div className={SIDE_COLUMN}>
          {[0, 1].map(card => (
            <Card key={card} className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
              <div className="space-y-1.5 px-3 py-3">
                <Skeleton className="mb-2 h-5 w-28" />
                {[0, 1].map(row => (
                  <Skeleton key={row} className="h-11 w-full rounded-lg" />
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={GRID}>
      <TerrainMapCard
        located={located}
        selectedKey={selectedKey}
        selectedActor={selectedActor}
        selectActor={handleSelectActor}
        route={route}
        colorFor={colorFor}
        focusedZone={focusedZone}
      />
      <div className={SIDE_COLUMN}>
        <ActiveCommercialsCard
          commercials={commercials}
          selectedKey={selectedKey}
          selectActor={handleSelectActor}
          colorFor={colorFor}
        />
        <AssignedZonesCard
          zones={zonesLoading ? [] : zones}
          selectedZoneId={selectedZoneId}
          selectZone={handleSelectZone}
        />
      </div>
    </div>
  )
}
