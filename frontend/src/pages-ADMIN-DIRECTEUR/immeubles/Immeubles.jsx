import { lazy, Suspense, useState } from 'react'
import { AdvancedDataTable } from '@/components/tableau'
import { MapSkeleton, TableSkeleton } from '@/components/LoadingSkeletons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  LayoutList,
  Map as MapIcon,
  Building,
  FileText,
  Percent,
  SlidersHorizontal,
  Calendar,
  User,
  CalendarCheck,
  EyeOff,
  MapPin,
  Layers,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useImmeublesLogic, AUTONOMES_KEY } from './useImmeublesLogic'

const AssignedZoneCard = lazy(() => import('@/components/AssignedZoneCard'))

function QuartierGroupSection({ group, columns, description, permissions, onDelete }) {
  const [open, setOpen] = useState(true)
  const label = group.isAutonomes ? 'Autonomes' : group.label

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <Badge variant="secondary" className="text-xs tabular-nums">
          {group.data.length} bâtiment{group.data.length > 1 ? 's' : ''}
        </Badge>
      </button>
      {open && (
        <AdvancedDataTable
          showStatusColumn={false}
          title={label}
          description={description}
          data={group.data}
          columns={columns}
          searchKey="address"
          detailsPath="/immeubles"
          onDelete={permissions.canDelete ? onDelete : undefined}
        />
      )}
    </div>
  )
}

export default function Immeubles() {
  const {
    viewMode,
    setViewMode,
    immeublesLoading,
    description,
    tableData,
    immeublesColumns,
    permissions,
    handleDeleteImmeuble,
    filteredImmeubles,
    stats,
    filterCommercial,
    setFilterCommercial,
    filterQuartier,
    setFilterQuartier,
    groupByQuartier,
    setGroupByQuartier,
    groupedByQuartier,
    dateFilterMode,
    setDateFilterMode,
    createdDate,
    setCreatedDate,
    commercialsList,
    quartiersList,
  } = useImmeublesLogic()

  if (immeublesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Bâtiments</h1>
          <p className="text-muted-foreground text-base">
            Gestion du patrimoine immobilier et suivi des propriétés
          </p>
        </div>
        <TableSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        <Card className="transition-all duration-300 hover:shadow-lg hover:border-primary/20 dark:hover:border-primary/20 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Bâtiments
            </CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-full">
              <Building className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
              {stats.totalImmeubles}
            </div>
            <p className="text-xs text-muted-foreground mt-1 tabular-nums">
              {[
                stats.typeBreakdown.IMMEUBLE > 0 && `${stats.typeBreakdown.IMMEUBLE} immeubles`,
                stats.typeBreakdown.MAISON > 0 && `${stats.typeBreakdown.MAISON} maisons`,
                stats.typeBreakdown.PAVILLON > 0 && `${stats.typeBreakdown.PAVILLON} pavillons`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all duration-300 hover:shadow-lg hover:border-primary/20 dark:hover:border-primary/20 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Contrats Signés
            </CardTitle>
            <div className="p-2 bg-emerald-500/10 rounded-full">
              <FileText className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
              {stats.totalContrats}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total cumulé des signatures</p>
          </CardContent>
        </Card>

        <Card className="transition-all duration-300 hover:shadow-lg hover:border-primary/20 dark:hover:border-primary/20 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Couverture Moy.
            </CardTitle>
            <div className="p-2 bg-violet-500/10 rounded-full">
              <Percent className="h-4 w-4 text-violet-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
              {stats.avgCouverture}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Portes prospectées</p>
          </CardContent>
        </Card>

        <Card className="transition-all duration-300 hover:shadow-lg hover:border-primary/20 dark:hover:border-primary/20 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              RDV Programmés
            </CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-full">
              <CalendarCheck className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
              {stats.totalRdv}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Rendez-vous à venir</p>
          </CardContent>
        </Card>

        <Card className="transition-all duration-300 hover:shadow-lg hover:border-primary/20 dark:hover:border-primary/20 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Non Visités</CardTitle>
            <div className="p-2 bg-gray-500/10 rounded-full">
              <EyeOff className="h-4 w-4 text-gray-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
              {stats.totalNonVisites}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Portes non prospectées</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Filtres:</span>
          </div>

          <Select value={dateFilterMode} onValueChange={setDateFilterMode}>
            <SelectTrigger className="w-auto">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Date / tri" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt_desc">Modifiés récemment</SelectItem>
              <SelectItem value="updatedAt_asc">Modifiés anciennement</SelectItem>
              <SelectItem value="createdAt_desc">Créés récemment</SelectItem>
              <SelectItem value="createdAt_asc">Créés anciennement</SelectItem>
              <SelectItem value="created_yesterday">Créés hier</SelectItem>
              <SelectItem value="created_this_week">Créés cette semaine</SelectItem>
              <SelectItem value="created_specific_date">Créés à une date</SelectItem>
            </SelectContent>
          </Select>

          {dateFilterMode === 'created_specific_date' && (
            <Input
              type="date"
              value={createdDate}
              onChange={event => setCreatedDate(event.target.value)}
              className="w-[170px] border-2 border-primary"
            />
          )}

          <Select value={filterCommercial} onValueChange={setFilterCommercial}>
            <SelectTrigger className="w-auto">
              <User className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Commercial..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les commerciaux</SelectItem>
              {commercialsList?.map(commercial => (
                <SelectItem key={commercial.id} value={String(commercial.id)}>
                  {commercial.prenom} {commercial.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterQuartier} onValueChange={setFilterQuartier}>
            <SelectTrigger className="w-auto">
              <MapPin className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Quartier..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les quartiers</SelectItem>
              {quartiersList?.map(quartier => (
                <SelectItem key={quartier.id} value={String(quartier.id)}>
                  {quartier.nom}
                </SelectItem>
              ))}
              <SelectItem value={AUTONOMES_KEY}>Autonomes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs tabular-nums">
            {filteredImmeubles.length} immeuble{filteredImmeubles.length > 1 ? 's' : ''}
          </Badge>
          <div className="flex gap-1">
            {viewMode === 'list' && (
              <Button
                variant={groupByQuartier ? 'default' : 'outline'}
                size="sm"
                onClick={() => setGroupByQuartier(prev => !prev)}
                className="gap-2"
              >
                <Layers className="h-4 w-4" />
                Grouper par quartier
              </Button>
            )}
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="gap-2"
            >
              <LayoutList className="h-4 w-4" />
              Liste
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('map')}
              className="gap-2"
            >
              <MapIcon className="h-4 w-4" />
              Carte
            </Button>
          </div>
        </div>
      </div>

      {/* Affichage conditionnel basé sur viewMode */}
      {viewMode === 'list' ? (
        groupByQuartier ? (
          <div className="space-y-4">
            {groupedByQuartier.map(group => (
              <QuartierGroupSection
                key={group.key}
                group={group}
                columns={immeublesColumns}
                description={description}
                permissions={permissions}
                onDelete={handleDeleteImmeuble}
              />
            ))}
          </div>
        ) : (
          <AdvancedDataTable
            showStatusColumn={false}
            title="Liste des bâtiments"
            description={description}
            data={tableData}
            columns={immeublesColumns}
            searchKey="address"
            detailsPath="/immeubles"
            onDelete={permissions.canDelete ? handleDeleteImmeuble : undefined}
          />
        )
      ) : (
        <Suspense fallback={<MapSkeleton />}>
          <AssignedZoneCard
            showAllImmeubles={true}
            allImmeubles={filteredImmeubles}
            fullWidth={true}
          />
        </Suspense>
      )}
    </div>
  )
}
