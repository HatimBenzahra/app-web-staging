import { TableSkeleton } from '@/components/LoadingSkeletons'
import { useMemo, useState } from 'react'
import PeopleListToolbar from '@/components/people/PeopleListToolbar'
import PeopleCardsView from '@/components/people/PeopleCardsView'
import RankTiersCard from '@/components/people/RankTiersCard'
import { filterPeople } from '@/components/people/people-filters'
import { UserStatus } from '@/constants/domain/user-status'
import { useManagersLogic } from './useManagersLogic'

export default function Managers() {
  const {
    tableData,
    permissions,
    managersLoading,
    managersEditFields,
    handleEditManager,
    handleArchiveManager,
  } = useManagersLogic()

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
          largeur min-content du tableau, la grille déborde et la page scrolle.

          Deux colonnes à partir de 1536 px seulement — même raison que sur la page
          Commerciaux : en dessous, le panneau Paliers ne laissait pas la largeur
          nécessaire à une rangée `PersonListCard` d'un seul tenant. */}
      <div className="grid grid-cols-1 items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <PeopleCardsView
          people={cardsPeople}
          detailsPath="/managers"
          showRanking={true}
          canEdit={permissions.canEdit}
          canArchive={permissions.canEdit}
          onArchive={handleArchiveManager}
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
