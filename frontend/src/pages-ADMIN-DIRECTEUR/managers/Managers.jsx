import { AdvancedDataTable } from '@/components/tableau'
import { TableSkeleton } from '@/components/LoadingSkeletons'
import { RANKS } from '@/utils/business/ranks'
import { Card } from '@/components/ui/card'
import { useMemo } from 'react'
import { useManagersLogic } from './useManagersLogic'

export default function Managers() {
  const {
    tableData,
    columns,
    permissions,
    description,
    managersLoading,
    managersEditFields,
    handleEditManager,
    isAdmin,
    statusOptions,
  } = useManagersLogic()

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

  if (managersLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Managers</h1>
          <p className="text-muted-foreground text-base">
            Gestion des managers régionaux et suivi de leurs équipes
          </p>
        </div>
        <TableSkeleton />
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
        title="Liste des Managers"
        description={description}
        data={tableData}
        columns={columns}
        searchKey="nom"
        detailsPath="/managers"
        editFields={managersEditFields}
        onEdit={permissions.canEdit ? handleEditManager : undefined}
        customStatusFilter={statusFilterOptions}
        defaultStatusFilter="ACTIF"
      />
    </div>
  )
}
