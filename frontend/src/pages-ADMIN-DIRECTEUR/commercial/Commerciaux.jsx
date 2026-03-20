import { AdvancedDataTable } from '@/components/tableau'
import { TableSkeleton } from '@/components/LoadingSkeletons'
import { memo, useMemo } from 'react'
import { RANKS } from '@/utils/business/ranks'
import { Card } from '@/components/ui/card'
import { useCommerciauxLogic } from './useCommerciauxLogic'

export default memo(function Commerciaux() {
  const {
    tableData,
    columns,
    permissions,
    description,
    loading,
    error,
    updating,
    refetch,
    commerciauxEditFields,
    handleEditCommercial,
    statusOptions,
  } = useCommerciauxLogic()

  const statusFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'Tous' },
      ...statusOptions.map(option => ({
        value: option.value,
        label: option.label,
      })),
    ],
    [statusOptions]
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Commerciaux</h1>
          <p className="text-muted-foreground text-base">
            Gestion de l'équipe commerciale et suivi des performances
          </p>
        </div>
        <TableSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Commerciaux</h1>
          <p className="text-muted-foreground text-base">
            Gestion de l'équipe commerciale et suivi des performances
          </p>
        </div>
        <div className="p-6 border border-red-200 rounded-lg bg-red-50">
          <p className="text-red-800">Erreur lors du chargement des données : {error}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Section d'information sur le système de rangs */}
      <Card className="p-6 bg-linear-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">🏆 Système de Rangs</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Progression et paliers de performance basés sur les statistiques
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {RANKS.map(rank => (
              <div
                key={rank.name}
                className="bg-card rounded-lg p-4 border border-border hover:shadow-md transition-shadow"
              >
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${rank.bgColor} ${rank.textColor} ${rank.borderColor} border font-semibold text-sm`}
                >
                  {rank.name}
                </span>
                <p className="text-xs text-muted-foreground mt-2">
                  {rank.maxPoints === Infinity
                    ? `${rank.minPoints}+ points`
                    : `${rank.minPoints} - ${rank.maxPoints} points`}
                </p>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold">Calcul des points:</span> Contrat signé (+50 pts) •
              Rendez-vous pris (+10 pts) • Immeuble visité (+5 pts)
            </p>
          </div>
        </div>
      </Card>

      <AdvancedDataTable
        showStatusColumn
        title="Liste des Commerciaux"
        description={description}
        data={tableData}
        columns={columns}
        searchKey="nom"
        detailsPath="/commerciaux"
        editFields={commerciauxEditFields}
        onEdit={permissions.canEdit ? handleEditCommercial : undefined}
        customStatusFilter={statusFilterOptions}
        defaultStatusFilter="ACTIF"
        loading={updating}
      />
    </div>
  )
})
