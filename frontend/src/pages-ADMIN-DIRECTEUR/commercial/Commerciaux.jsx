import { TableSkeleton } from '@/components/LoadingSkeletons'
import { memo, useMemo, useState } from 'react'
import PeopleListToolbar from '@/components/people/PeopleListToolbar'
import PeopleCardsView from '@/components/people/PeopleCardsView'
import RankTiersCard from '@/components/people/RankTiersCard'
import { filterPeople } from '@/components/people/people-filters'
import { UserStatus } from '@/constants/domain/user-status'
import { useCommerciauxLogic } from './useCommerciauxLogic'

export default memo(function Commerciaux() {
  const {
    tableData,
    permissions,
    loading,
    error,
    refetch,
    commerciauxEditFields,
    handleEditCommercial,
    handleArchiveCommercial,
  } = useCommerciauxLogic()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(UserStatus.ACTIF)

  const cardsPeople = useMemo(
    () => filterPeople(tableData, { search, status }),
    [tableData, search, status]
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
      <PeopleListToolbar
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
      />

      {/* minmax(0,1fr) et non 1fr : sinon la colonne refuse de descendre sous la
          largeur min-content du tableau, la grille déborde et la page scrolle.

          Deux colonnes seulement à partir de 1536 px : en dessous, les 320 px du
          panneau Paliers laissaient 546 px à la liste à 1280 px, où une rangée de
          `PersonListCard` en coûte ~750 — et le conteneur applicatif est en
          `overflow-x-hidden`, donc la rangée était coupée, pas scrollée. Les paliers
          sont une légende de référence : ils passent sous la liste. */}
      <div className="grid grid-cols-1 items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <PeopleCardsView
          people={cardsPeople}
          detailsPath="/commerciaux"
          showRanking={true}
          canEdit={permissions.canEdit}
          canArchive={permissions.canEdit}
          onArchive={handleArchiveCommercial}
          editFields={commerciauxEditFields}
          onSave={handleEditCommercial}
          editTitle="Modifier le commercial"
          emptyLabel="Aucun commercial pour ces filtres"
        />

        <RankTiersCard />
      </div>
    </div>
  )
})
