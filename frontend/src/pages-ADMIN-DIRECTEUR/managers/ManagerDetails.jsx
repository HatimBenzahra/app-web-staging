import DetailsPage from '@/components/DetailsPage'
import { DetailsPageSkeleton } from '@/components/LoadingSkeletons'
import DateRangeFilter from '@/components/DateRangeFilter'
import { useManagerDetailsLogic } from './useManagerDetailsLogic'

export default function ManagerDetails() {
  const {
    managerData,
    managerLoading,
    error,
    managerZones,
    personalInfo,
    personalStatsCards,
    teamStatsCards,
    additionalSections,
    dateFilter,
    isAdmin,
  } = useManagerDetailsLogic()

  if (managerLoading) return <DetailsPageSkeleton />
  if (error) return <div className="text-red-500">Erreur: {error}</div>
  if (!managerData) return <div>Manager non trouvé</div>

  return (
    <DetailsPage
      title={managerData.name}
      subtitle={`Manager - ID: ${managerData.id}`}
      status={'Manager'}
      data={managerData}
      personalInfo={personalInfo}
      statsCards={personalStatsCards}
      teamStatsCards={teamStatsCards}
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
          title="Filtres de période"
        />
      }
      assignedZones={managerZones}
      additionalSections={additionalSections}
      backUrl="/managers"
    />
  )
}
