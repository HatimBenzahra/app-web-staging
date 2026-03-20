import { AdvancedDataTable } from '@/components/tableau'
import { TableSkeleton } from '@/components/LoadingSkeletons'
import { useMemo } from 'react'
import { useDirecteursLogic } from './useDirecteursLogic'

export default function Directeurs() {
  const {
    tableData,
    columns,
    permissions,
    description,
    directeursLoading,
    directeursEditFields,
    handleEditDirecteur,
    statusOptions,
  } = useDirecteursLogic()

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

  if (directeursLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Directeurs</h1>
          <p className="text-muted-foreground text-base">{description}</p>
        </div>
        <TableSkeleton />
      </div>
    )
  }

  return (
    <div>
      <AdvancedDataTable
        showStatusColumn
        title="Liste des Directeurs"
        data={tableData}
        columns={columns}
        searchKey="nom"
        detailsPath="/directeurs"
        editFields={directeursEditFields}
        onEdit={permissions.canEdit ? handleEditDirecteur : undefined}
        customStatusFilter={statusFilterOptions}
        defaultStatusFilter="ACTIF"
      />
    </div>
  )
}
