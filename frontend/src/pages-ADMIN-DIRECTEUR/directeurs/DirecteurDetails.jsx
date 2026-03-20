import DetailsPage from '@/components/DetailsPage'
import { DetailsPageSkeleton } from '@/components/LoadingSkeletons'
import { useDirecteurDetailsLogic } from './useDirecteurDetailsLogic'

export default function DirecteurDetails() {
  const {
    directeurData,
    loading,
    error,
    assignedZones,
    personalInfo,
    statsCards,
    additionalSections,
  } = useDirecteurDetailsLogic()

  if (loading) return <DetailsPageSkeleton />
  if (error) return <div className="text-red-500">Erreur: {error}</div>
  if (!directeurData) return <div>Directeur non trouvé</div>

  return (
    <DetailsPage
      title={directeurData.name}
      subtitle={`Directeur - ID: ${directeurData.id}`}
      status={'Directeur'}
      data={directeurData}
      personalInfo={personalInfo}
      statsCards={statsCards}
      assignedZones={assignedZones}
      additionalSections={additionalSections}
    />
  )
}
