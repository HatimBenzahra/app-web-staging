import DetailsPage from '@/components/DetailsPage'
import { DetailsPageSkeleton } from '@/components/LoadingSkeletons'
import { Badge } from '@/components/ui/badge'
import { useImmeubleDetailsLogic } from './useImmeubleDetailsLogic'

export default function ImmeubleDetails() {
  const {
    immeubleData,
    immeubleLoading,
    portesLoading,
    error,
    personalInfo,
    statsCards,
    additionalSections,
    habitatMeta,
  } = useImmeubleDetailsLogic()

  if (immeubleLoading || portesLoading) return <DetailsPageSkeleton />
  if (error) return <div className="text-red-500">Erreur: {error}</div>
  if (!immeubleData) return <div>Bâtiment non trouvé</div>

  const TypeIcon = habitatMeta.Icon

  return (
    <DetailsPage
      title={immeubleData.name}
      subtitle={`${habitatMeta.label} · ${immeubleData.zone}`}
      headerBadge={
        <Badge className={`${habitatMeta.badgeClasses} gap-1`}>
          <TypeIcon className="h-3.5 w-3.5" />
          {habitatMeta.label}
        </Badge>
      }
      headerAccent={`border-l-4 ${habitatMeta.accentBorderLeft}`}
      data={immeubleData}
      personalInfo={personalInfo}
      statsCards={statsCards}
      additionalSections={additionalSections}
    />
  )
}
