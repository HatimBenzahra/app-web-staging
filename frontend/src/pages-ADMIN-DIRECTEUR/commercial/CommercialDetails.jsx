import DetailsPage from '@/components/DetailsPage'
import { DetailsPageSkeleton } from '@/components/LoadingSkeletons'
import DateRangeFilter from '@/components/DateRangeFilter'
import { useCommercialDetailsLogic } from './useCommercialDetailsLogic'

export default function CommercialDetails() {
  const {
    commercialData,
    loading,
    error,
    assignedZones,
    personalInfo,
    statsCards,
    additionalSections,
    dateFilter,
  } = useCommercialDetailsLogic()

  if (loading) return <DetailsPageSkeleton />

  if (error) {
    return (
      <div className="p-6 border border-red-200 rounded-lg bg-red-50">
        <p className="text-red-800">Erreur lors du chargement des données : {error}</p>
      </div>
    )
  }

  if (!commercialData) {
    return (
      <div className="p-6 border border-gray-200 rounded-lg bg-gray-50">
        <p className="text-gray-800">Commercial non trouvé</p>
      </div>
    )
  }

  return (
    <DetailsPage
      title={commercialData.name}
      subtitle={`Commercial - ID: ${commercialData.id}`}
      status={'Commercial'}
      data={commercialData}
      personalInfo={personalInfo}
      statsCards={statsCards}
      statsFilter={
        <DateRangeFilter
          className="h-fit"
          startDate={dateFilter.startDate}
          endDate={dateFilter.endDate}
          appliedStartDate={dateFilter.appliedStartDate}
          appliedEndDate={dateFilter.appliedEndDate}
          onChangeStart={dateFilter.setStartDate}
          onChangeEnd={dateFilter.setEndDate}
          onApply={dateFilter.handleApplyFilters}
          onReset={dateFilter.handleResetFilters}
          title="Filtres de période (stats & portes)"
        />
      }
      assignedZones={assignedZones}
      additionalSections={additionalSections}
      backUrl="/commerciaux"
    />
  )
}
