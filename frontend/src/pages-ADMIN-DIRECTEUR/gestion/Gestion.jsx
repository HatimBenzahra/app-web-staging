import { useGestionLogic } from './useGestionLogic'
import { TableSkeleton } from '@/components/LoadingSkeletons'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { Users, Info, Filter, Search, Plus, Crown, Briefcase, UserCircle } from 'lucide-react'
import OrganizationColumns from './components/OrganizationColumns'
import UserCard from './components/UserCard'
import UnassignedPanel from './components/UnassignedPanel'
import AddUserModal from './components/AddUserModal'
import ReassignModal from './components/ReassignModal'

/**
 * Page de gestion de l'organisation hiérarchique.
 * Layout master-détail (Directeurs → Managers → Commerciaux), colonnes scrollables.
 * Assignation par drag & drop OU via le menu « Réassigner ».
 */
export default function Gestion() {
  const {
    isAdmin,
    loading,
    error,
    organizationData,
    counts,
    sensors,
    activeId,
    findUser,
    handleDragStart,
    handleDragEnd,
    refetchAll,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    statusFilterOptions,
    showStatusFilter,
    // Sélection master-détail
    visibleTrees,
    selectedDirecteurId,
    selectedDirecteur,
    selectDirecteur,
    selectedManagerId,
    selectManager,
    columnManagers,
    columnHasDirect,
    columnCommercials,
    // Désassignation / réassignation
    unassignUser,
    reassignModal,
    openReassign,
    closeReassign,
    reassignCommercial,
    reassignManager,
    // Création
    directeurs,
    managers,
    addModal,
    openAddModal,
    closeAddModal,
    handleAddSuccess,
  } = useGestionLogic()

  const Header = () => (
    <div className="flex items-center gap-3">
      <Users className="h-7 w-7 text-primary" />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestion de l'Organisation</h1>
        <p className="text-sm text-muted-foreground">Structure hiérarchique et assignations</p>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <Header />
        <TableSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Header />
        <Card className="p-6 border-destructive/50 bg-destructive/10">
          <p className="text-destructive">Erreur lors du chargement des données : {error}</p>
          <Button onClick={refetchAll} className="mt-2" variant="destructive">
            Réessayer
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* En-tête + action Ajouter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Header />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2 self-start sm:self-auto">
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Nouvel utilisateur</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isAdmin && (
                <DropdownMenuItem onClick={() => openAddModal('directeur')}>
                  <Crown className="mr-2 h-4 w-4" />
                  Directeur
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => openAddModal('manager')}>
                <Briefcase className="mr-2 h-4 w-4" />
                Manager
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openAddModal('commercial')}>
                <UserCircle className="mr-2 h-4 w-4" />
                Commercial
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Compteurs récapitulatifs */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <Crown className="h-3.5 w-3.5" /> {counts.directeurs} directeurs
          </Badge>
          <Badge variant="secondary" className="gap-1.5">
            <Briefcase className="h-3.5 w-3.5" /> {counts.managers} managers
          </Badge>
          <Badge variant="secondary" className="gap-1.5">
            <UserCircle className="h-3.5 w-3.5" /> {counts.commercials} commerciaux
          </Badge>
          {counts.unassigned > 0 && (
            <Badge variant="outline" className="gap-1.5">
              {counts.unassigned} non assigné{counts.unassigned > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Carte d'information (neutre) */}
        <Card className="p-4 bg-muted/40">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-background rounded-lg shrink-0">
              <Info className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold mb-1">Assignation</h3>
              <p className="text-xs text-muted-foreground">
                Sélectionnez un directeur puis un manager pour naviguer. Glissez une carte (via la
                poignée) sur une cible pour l'assigner, ou utilisez le menu ⋮ « Réassigner ».
                Déposez sur « Non assignés » pour désassigner.
              </p>
            </div>
          </div>
        </Card>

        {/* Barre d'actions : recherche + filtre statut */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-muted/30 p-3">
          <div className="relative flex-1 min-w-0 sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Rechercher un nom, prénom ou email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-9 bg-background text-sm"
            />
          </div>

          {showStatusFilter && (
            <div className="flex items-center gap-2 shrink-0">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[200px]">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  {statusFilterOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Colonnes master-détail + Non assignés (rangée scrollable horizontale) */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-2 select-none">
            <OrganizationColumns
              visibleTrees={visibleTrees}
              selectedDirecteurId={selectedDirecteurId}
              onSelectDirecteur={selectDirecteur}
              selectedDirecteur={selectedDirecteur}
              columnManagers={columnManagers}
              columnHasDirect={columnHasDirect}
              selectedManagerId={selectedManagerId}
              onSelectManager={selectManager}
              columnCommercials={columnCommercials}
              onAddManager={directeurId => openAddModal('manager', directeurId, 'directeur')}
              onAddCommercial={managerId => openAddModal('commercial', managerId, 'manager')}
              onAddDirectCommercial={directeurId =>
                openAddModal('commercial', directeurId, 'directeur')
              }
              onReassign={openReassign}
              onUnassign={unassignUser}
            />

            <UnassignedPanel
              managers={organizationData.unassigned.managers}
              commercials={organizationData.unassigned.commercials}
            />
          </div>

          {/* Overlay de l'élément en cours de drag */}
          <DragOverlay>
            {activeId ? (
              <UserCard
                user={findUser(activeId.split('-')[1], activeId.split('-')[0])}
                type={activeId.split('-')[0]}
                isDragging
              />
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Modales */}
        <AddUserModal
          isOpen={addModal.isOpen}
          onClose={closeAddModal}
          onSuccess={handleAddSuccess}
          userType={addModal.userType}
          parentId={addModal.parentId}
          parentType={addModal.parentType}
          directeurs={directeurs}
          managers={managers}
        />

        <ReassignModal
          isOpen={reassignModal.isOpen}
          onClose={closeReassign}
          user={reassignModal.user}
          userType={reassignModal.userType}
          directeurs={directeurs}
          managers={managers}
          onReassignCommercial={reassignCommercial}
          onReassignManager={reassignManager}
        />
      </div>
    </TooltipProvider>
  )
}
