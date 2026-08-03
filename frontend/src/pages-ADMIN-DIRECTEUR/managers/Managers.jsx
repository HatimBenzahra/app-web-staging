import { TableSkeleton } from '@/components/LoadingSkeletons'
import { useMemo, useState } from 'react'
import PeopleListToolbar from '@/components/people/PeopleListToolbar'
import PeopleCardsView from '@/components/people/PeopleCardsView'
import RankTiersCard from '@/components/people/RankTiersCard'
import { filterPeople } from '@/components/people/people-filters'
import { UserStatus } from '@/constants/domain/user-status'
import { useManagersLogic } from './useManagersLogic'

export default function Managers() {
  const { tableData, permissions, managersLoading, managersEditFields, handleEditManager } =
    useManagersLogic()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(UserStatus.ACTIF)

  const cardsPeople = useMemo(
    () => filterPeople(tableData, { search, status }),
    [tableData, search, status]
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
      <PeopleListToolbar
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
      />

      {/* minmax(0,1fr) et non 1fr : sinon la colonne refuse de descendre sous la
          largeur min-content du tableau, la grille déborde et la page scrolle. */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PeopleCardsView
          people={cardsPeople}
          detailsPath="/managers"
          factsOf={person => [
            { label: 'Directeur', value: person.directeur },
            { label: 'Email', value: person.email },
          ]}
          showRanking={true}
          canEdit={permissions.canEdit}
          editFields={managersEditFields}
          onSave={handleEditManager}
          editTitle="Modifier le manager"
          emptyLabel="Aucun manager pour ces filtres"
        />

        <RankTiersCard />
      </div>
    </div>
  )
}
