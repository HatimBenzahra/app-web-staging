import DetailsPage from '@/components/DetailsPage'
import { DetailsPageSkeleton } from '@/components/LoadingSkeletons'
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
  } = useImmeubleDetailsLogic()

  if (immeubleLoading || portesLoading) return <DetailsPageSkeleton />
  if (error) return <div className="text-red-500">Erreur: {error}</div>
  if (!immeubleData) return <div>Immeuble non trouvé</div>

  return (
    <DetailsPage
      title={immeubleData.name}
      subtitle={`Immeuble - ${immeubleData.zone}`}
      status={'Immeuble'}
      data={immeubleData}
      personalInfo={personalInfo}
      statsCards={statsCards}
      additionalSections={additionalSections}
    />
  )
}
