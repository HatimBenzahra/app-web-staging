import DetailsPage from '@/components/DetailsPage'
import { DetailsPageSkeleton } from '@/components/LoadingSkeletons'
import { useZoneDetailsLogic } from './useZoneDetailsLogic'

export default function ZoneDetails() {
  const {
    zoneData,
    zoneLoading,
    statsLoading,
    zoneStatsLoading,
    error,
    permissions,
    personalInfo,
    customStatsCards,
    customSections,
  } = useZoneDetailsLogic()

  if (zoneLoading || statsLoading || zoneStatsLoading) return <DetailsPageSkeleton />
  if (error) return <div className="text-red-500">Erreur: {error}</div>
  if (!zoneData) return <div>Zone non trouvée</div>

  // Vérification des permissions d'accès
  if (!permissions.canView) {
    return <div className="text-red-500">Vous n'avez pas l'autorisation de voir cette zone</div>
  }

  return (
    <DetailsPage
      title={zoneData.name}
      subtitle={`Zone - ${zoneData.region}`}
      status={'Zone'}
      data={zoneData}
      personalInfo={personalInfo}
      statsCards={customStatsCards}
      additionalSections={customSections}
    />
  )
}
