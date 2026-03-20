import React, { lazy, Suspense, useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  TrendingUp,
  Users,
  Building2,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useDetailsSections } from '@/contexts/DetailsSectionsContext'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { MapSkeleton } from '@/components/LoadingSkeletons'
import { AdvancedDataTable } from './tableau'
import { useEntityPermissions } from '@/hooks/metier/permissions/useRoleBasedData'
import PortesProspectionChart from './charts/PortesProspectionChart'
import PortesWeeklyChart from './charts/PortesWeeklyChart'
import PortesStatusChart from './charts/PortesStatusChart'
import PorteHistoriqueTimeline from '@/pages-ADMIN-DIRECTEUR/immeubles/components/PorteHistoriqueTimeline'

const AssignedZoneCard = lazy(() => import('./AssignedZoneCard'))

/**
 * Composant de tableau sans Card wrapper pour éviter les doubles cards
 */
function DoorsTableContent({
  data,
  columns,
  customStatusFilter = null,
  searchPlaceholder = 'Rechercher...',
  searchKey = 'number',
  nestedTableColumns = null,
  nestedDataKey = null,
  showFilters = true,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [floorFilter, setFloorFilter] = useState('all')
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedRows, setExpandedRows] = useState(new Set())
  const itemsPerPage = 20

  const availableFloors = useMemo(() => {
    const floors = data
      .map(item => Number(item.floor))
      .filter(floor => Number.isFinite(floor))
    return Array.from(new Set(floors)).sort((a, b) => a - b)
  }, [data])

  const baseFilteredData = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return data.filter(item => {
      const floorMatch =
        floorFilter === 'all' ||
        (Number.isFinite(Number(item.floor)) && Number(item.floor) === Number(floorFilter))

      if (!floorMatch) return false
      if (!normalizedSearch) return true

      const searchableValues = [item[searchKey], item.number, item.etage, item.comment]
      return searchableValues.some(value =>
        value != null && String(value).toLowerCase().includes(normalizedSearch)
      )
    })
  }, [data, floorFilter, searchKey, searchTerm])

  const statusCounts = useMemo(() => {
    return baseFilteredData.reduce((acc, item) => {
      const status = item.status
      if (status) {
        acc.set(status, (acc.get(status) || 0) + 1)
      }
      return acc
    }, new Map())
  }, [baseFilteredData])

  // Filtrage et tri des données
  const filteredAndSortedData = useMemo(() => {
    const filtered = baseFilteredData.filter(
      item => statusFilter === 'all' || item.status === statusFilter
    )

    if (!sortConfig.key) return filtered

    const sorted = [...filtered]
    sorted.sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]
      const aIsNull = aValue == null || aValue === ''
      const bIsNull = bValue == null || bValue === ''

      if (aIsNull && bIsNull) return 0
      if (aIsNull) return sortConfig.direction === 'asc' ? 1 : -1
      if (bIsNull) return sortConfig.direction === 'asc' ? -1 : 1

      const aNumber = Number(aValue)
      const bNumber = Number(bValue)
      const isNumeric = Number.isFinite(aNumber) && Number.isFinite(bNumber)

      if (isNumeric) {
        return sortConfig.direction === 'asc' ? aNumber - bNumber : bNumber - aNumber
      }

      const comparison = String(aValue).localeCompare(String(bValue), 'fr', {
        numeric: true,
        sensitivity: 'base',
      })
      return sortConfig.direction === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [baseFilteredData, sortConfig, statusFilter])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage)
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredAndSortedData.slice(startIndex, endIndex)
  }, [filteredAndSortedData, currentPage])

  const filtersSignature = `${searchTerm}|${statusFilter}|${floorFilter}`

  // Réinitialise la page quand on change de filtre/recherche
  useEffect(() => {
    if (filtersSignature) {
      setCurrentPage(1)
    }
  }, [filtersSignature])

  const handleSort = key => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const toggleRow = (rowId) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(rowId)) {
        newSet.delete(rowId)
      } else {
        newSet.add(rowId)
      }
      return newSet
    })
  }

  return (
    <div className="space-y-4">
      {/* Barre de filtres */}
      {showFilters && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 rounded-lg"
              />
            </div>

            {availableFloors.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="justify-between min-w-[150px] rounded-lg">
                    <span className="inline-flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      {floorFilter === 'all' ? 'Tous les étages' : `Étage ${floorFilter}`}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Filtrer par étage</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setFloorFilter('all')}>
                    Tous les étages
                  </DropdownMenuItem>
                  {availableFloors.map(floor => (
                    <DropdownMenuItem key={floor} onClick={() => setFloorFilter(String(floor))}>
                      Étage {floor}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {(searchTerm || statusFilter !== 'all' || floorFilter !== 'all') && (
              <Button
                variant="ghost"
                className="rounded-lg"
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('all')
                  setFloorFilter('all')
                }}
              >
                Réinitialiser les filtres
              </Button>
            )}
          </div>

          {customStatusFilter && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {customStatusFilter.map(filter => {
                const isActive = statusFilter === filter.value
                const count = filter.value === 'all' ? baseFilteredData.length : (statusCounts.get(filter.value) || 0)

                return (
                  <Button
                    key={filter.value}
                    variant="ghost"
                    size="sm"
                    onClick={() => setStatusFilter(filter.value)}
                    className={`h-8 rounded-full border px-3 text-xs font-medium whitespace-nowrap ${
                      isActive
                        ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15'
                        : 'bg-background text-muted-foreground border-border/60 hover:bg-muted/40'
                    }`}
                  >
                    <span>{filter.label}</span>
                    <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-none text-foreground/80">
                      {count}
                    </span>
                  </Button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tableau */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                {columns.map((column, index) => (
                  <TableHead
                    key={index}
                      className={`${column.className || ''} ${column.sortable ? 'cursor-pointer hover:bg-muted' : ''}`}
                      onClick={() => column.sortable && handleSort(column.sortKey || column.accessor)}
                    >
                      <div className="flex items-center">
                        {column.header}
                        {column.sortable && sortConfig.key === (column.sortKey || column.accessor) && (
                          <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                    Aucun résultat trouvé
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row, rowIndex) => {
                  const rowKey = row.tableId || row.id
                  const porteId = row.porteId || row.id
                  const isExpanded = expandedRows.has(rowKey)

                  // Vérifier si c'est une ligne 'Immeuble' avec des portes imbriquées (via nestedDataKey)
                  // OU fallback sur le comportement par défaut (PorteHistoriqueTimeline)
                  const hasNestedData = nestedDataKey && row[nestedDataKey] && row[nestedDataKey].length > 0;

                  return (
                    <React.Fragment key={rowKey}>
                      <TableRow className="hover:bg-muted/50">
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRow(rowKey)}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronRight
                              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            />
                          </Button>
                        </TableCell>
                        {columns.map((column, colIndex) => (
                          <TableCell key={colIndex} className={column.className}>
                            {column.cell ? column.cell(row) : row[column.accessor]}
                          </TableCell>
                        ))}
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={columns.length + 1} className="p-0 bg-muted/20">
                            <div className="p-2 sm:p-4">
                              {hasNestedData ? (
                                <DoorsTableContent
                                  data={row[nestedDataKey]}
                                  columns={nestedTableColumns}
                                  customStatusFilter={[
                                    { value: 'all', label: 'Tous les statuts' },
                                    { value: 'contrat_signe', label: 'Contrats signés' },
                                    { value: 'rendez_vous_pris', label: 'RDV programmés' },
                                    { value: 'absent', label: 'Absents' },
                                    { value: 'argumente', label: 'Argumentés' },
                                    { value: 'refus', label: 'Refus' },
                                    { value: 'necessite_repassage', label: 'Repassages nécessaires' },
                                    { value: 'non_visite', label: 'Non visités' },
                                  ]} // Filtres par défaut pour les portes
                                  searchPlaceholder="Rechercher porte..."
                                  searchKey="number"
                                />
                              ) : (
                                <PorteHistoriqueTimeline porteId={porteId} porteNumero={row.number} />
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      {/* Footer avec pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {filteredAndSortedData.length === data.length
            ? `${filteredAndSortedData.length} résultats`
            : `${filteredAndSortedData.length} sur ${data.length} résultats`}
        </div>

        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className={
                    currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                  }
                />
              </PaginationItem>

              {[...Array(totalPages)].map((_, index) => {
                const pageNumber = index + 1
                if (
                  pageNumber === 1 ||
                  pageNumber === totalPages ||
                  (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                ) {
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNumber)}
                        isActive={currentPage === pageNumber}
                        className="cursor-pointer"
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  )
                } else if (pageNumber === currentPage - 2 || pageNumber === currentPage + 2) {
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )
                }
                return null
              })}

              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className={
                    currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  )
}

/**
 * Composant de page de détails réutilisable
 * @param {Object} props
 * @param {string} props.title - Titre principal de la page
 * @param {string} props.subtitle - Sous-titre ou description
 * @param {Object} props.data - Données de l'entité à afficher
 * @param {Object} props.personalInfo - Section d'informations personnelles
 * @param {Array} props.statsCards - Cartes de statistiques
 * @param {Array} props.additionalSections - Sections supplémentaires personnalisées
 * @param {Array} props.assignedZones - Zones assignées à afficher (optionnel)
 * @param {string} props.status - Status de l'entité (actif, inactif, etc.)
 * @param {ReactNode} props.statsFilter - Composant de filtre à afficher au-dessus des statistiques (optionnel)
 */
export default function DetailsPage({
  title,
  subtitle,
  data,
  personalInfo = [],
  statsCards = [],
  additionalSections = [],
  assignedZones = null,
  status,
  statsFilter = null,
}) {
  const navigate = useNavigate()
  const zonePermissions = useEntityPermissions('zones')
  const { setSections, focusedSection } = useDetailsSections()
  const [showAssignedZoneMaps, setShowAssignedZoneMaps] = useState(false)

  // Créer un ID unique pour chaque section basé sur son titre
  const createSectionId = title => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Enlever l es accents
      .replace(/[^a-z0-9]+/g, '-') // Remplacer les caractères spéciaux par des tirets
      .replace(/^-+|-+$/g, '') // Enlever les tirets au début et à la fin
  }

  // Enregistrer les sections dans le contexte quand le composant est monté
  useEffect(() => {
    const sections = []
    // Ajouter la section des informations personnelles
    if (personalInfo.length > 0) {
      sections.push({
        id: 'informations-personnelles',
        title: 'Informations personnelles',
      })
    }

    // Ajouter la section des statistiques
    if (statsCards.length > 0) {
      sections.push({
        id: 'statistiques',
        title: 'Statistiques',
      })
    }

    // Ajouter la section des zones assignées
    if (assignedZones && zonePermissions.canView) {
      sections.push({
        id: 'zones-assignees',
        title: 'Zones assignées',
      })
    }

    // Ajouter les sections additionnelles
    additionalSections.forEach(section => {
      sections.push({
        id: createSectionId(section.title),
        title: section.title,
      })
    })

    setSections(sections)

    // Nettoyer les sections quand on quitte la page
    return () => setSections([])
  }, [
    personalInfo,
    statsCards,
    assignedZones,
    additionalSections,
    zonePermissions.canView,
    setSections,
  ])

  const getStatusBadge = status => {
    const variants = {
      actif: 'default',
      inactif: 'secondary',
      suspendu: 'destructive',
      en_conge: 'outline',
      en_renovation: 'outline',
      en_maintenance: 'outline',
      complet: 'default',
      en_developpement: 'secondary',
      saisonnier: 'outline',
    }

    const labels = {
      actif: 'Actif',
      inactif: 'Inactif',
      suspendu: 'Suspendu',
      en_conge: 'En congé',
      en_renovation: 'En rénovation',
      en_maintenance: 'En maintenance',
      complet: 'Complet',
      en_developpement: 'En développement',
      saisonnier: 'Saisonnier',
    }

    return <Badge variant={variants[status] || 'default'}>{labels[status] || status}</Badge>
  }

  const getIcon = (iconName, iconColor = 'text-primary', className = '') => {
    const icons = {
      mail: Mail,
      phone: Phone,
      mapPin: MapPin,
      calendar: Calendar,
      trendingUp: TrendingUp,
      users: Users,
      building: Building2,
    }
    const Icon = icons[iconName] || Mail
    return <Icon className={`h-4 w-4 ${iconColor} ${className}`} />
  }

  // Fonction pour obtenir les classes CSS d'une section focusée
  const getSectionClasses = sectionId => {
    return focusedSection === sectionId
      ? 'transition-all duration-400 scale-[1.03] text-primary/80 ring-primary/30 border-1 border-primary/30 rounded-lg'
      : 'transition-all duration-400'
  }

  return (
    <div className="space-y-8 mb-50">
      {/* Header avec bouton retour */}
      <div className="flex items-center gap-4 pb-6 border-b">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            {status && getStatusBadge(status)}
          </div>
          {subtitle && <p className="text-muted-foreground text-base">{subtitle}</p>}
        </div>
      </div>
      {/* Informations personnelles */}
      {personalInfo.length > 0 && (
        <div
          id="informations-personnelles"
          className={getSectionClasses('informations-personnelles')}
        >
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-1">Informations personnelles</h2>
            <Separator className="border-t-2 border-primary mb-2" />
            <p className="text-sm text-muted-foreground">Détails et coordonnées</p>
          </div>
          <Separator className="mb-6" />
          <Card className="border-2">
            <CardContent className="pt-6">
              <div className="grid gap-6 md:grid-cols-2">
                {personalInfo.map((info, index) => (
                  <div key={index} className="flex items-start gap-3">
                    {info.icon && <div className="mt-1">{getIcon(info.icon, info.iconColor)}</div>}
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${info.iconColor || 'text-primary'} uppercase tracking-wide`}
                      >
                        {info.label}
                      </p>
                      <p className="text-base font-semibold mt-1.5">{info.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Statistiques */}
      {statsCards.length > 0 && (
        <div id="statistiques" className={getSectionClasses('statistiques')}>
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-1 ">Statistiques</h2>
            <Separator className="border-t-2 border-primary mb-2" />
            <p className="text-sm text-muted-foreground">Indicateurs de performance clés</p>
          </div>
          <Separator className="mb-6" />
          {statsFilter && <div className="mb-6">{statsFilter}</div>}

          {/* Cards en pleine largeur en premier */}
          {statsCards.filter(stat => stat.fullWidth).length > 0 && (
            <div className="grid gap-6 mb-6">
              {statsCards
                .filter(stat => stat.fullWidth)
                .map((stat, index) => (
                  <Card key={index} className="border-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                      <CardTitle className="text-lg font-bold">{stat.title}</CardTitle>
                      {stat.icon && (
                        <div className="h-8 w-8">
                          {getIcon(stat.icon, stat.iconColor, stat.iconClassName || 'h-8 w-8')}
                        </div>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold tracking-tight mb-2">{stat.value}</div>

                      {stat.description && (
                        <div className="mt-2">
                          <p className="text-sm text-muted-foreground">{stat.description}</p>
                          <div className="border-t-2 border-primary mt-3"></div>
                        </div>
                      )}
                      {stat.trend && (
                        <div className="mt-3 pt-3 border-t">
                          <div
                            className={`text-xs font-medium flex items-center gap-1 ${
                              stat.trend.type === 'positive' ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            <TrendingUp className="h-3 w-3" />
                            {stat.trend.value}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}

          {/* Cards normales en grille */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {statsCards
              .filter(stat => !stat.fullWidth && !stat.halfWidth)
              .map((stat, index) => (
                <Card key={index} className="border-2">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium ">{stat.title}</CardTitle>
                    {stat.icon && (
                      <div className="h-4 w-4">
                        {getIcon(stat.icon, stat.iconColor, stat.iconClassName || '')}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold tracking-tight ">{stat.value}</div>

                    {stat.description && (
                      <div className="mt-2 inline-block">
                        <p className="text-xs text-muted-foreground">{stat.description}</p>
                        <div className="border-t-2 border-primary mt-2"></div>
                      </div>
                    )}
                    {stat.trend && (
                      <div className="mt-3 pt-3 border-t">
                        <div
                          className={`text-xs font-medium flex items-center gap-1 ${
                            stat.trend.type === 'positive' ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          <TrendingUp className="h-3 w-3" />
                          {stat.trend.value}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>

          {/* Cards demi-largeur (taux de conversion) */}
          {statsCards.filter(stat => stat.halfWidth).length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 mt-6">
              {statsCards
                .filter(stat => stat.halfWidth)
                .map((stat, index) => (
                  <Card
                    key={index}
                    className="border-2 relative overflow-hidden"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(45deg, transparent, transparent 10px, hsl(var(--muted) / 0.05) 10px, hsl(var(--muted) / 0.05) 20px)',
                    }}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b-2">
                      <CardTitle className="text-base font-bold">{stat.title}</CardTitle>
                      {stat.icon && (
                        <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                          {getIcon(stat.icon, stat.iconColor || 'text-primary', stat.iconClassName || 'h-4 w-4')}
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="text-3xl font-bold tracking-tight mb-2">{stat.value}</div>

                      {stat.description && (
                        <div className="mt-2">
                          <p className="text-sm text-muted-foreground italic">{stat.description}</p>
                        </div>
                      )}
                      {stat.trend && (
                        <div className="mt-3 pt-3 border-t">
                          <div
                            className={`text-xs font-medium flex items-center gap-1 ${
                              stat.trend.type === 'positive' ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            <TrendingUp className="h-3 w-3" />
                            {stat.trend.value}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Section des zones assignées (si applicable et autorisée) */}
      {assignedZones && zonePermissions.canView && (
        <div id="zones-assignees" className={getSectionClasses('zones-assignees')}>
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-1">Zones assignées</h2>
            <Separator className="border-t-2 border-primary mb-2" />
            <p className="text-sm text-muted-foreground">Territoires géographiques attribués</p>
          </div>
          <Separator className="mb-6" />
          <div className="space-y-4">
            {assignedZones.length > 0 ? (
              showAssignedZoneMaps ? (
                assignedZones.map(zone => (
                  <Suspense key={zone.id} fallback={<MapSkeleton />}>
                    <AssignedZoneCard
                      zone={zone}
                      assignmentDate={zone.assignmentDate || zone.createdAt}
                      immeublesCount={zone.immeublesCount || 0}
                    />
                  </Suspense>
                ))
              ) : (
                <Card className="border-2">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        Les cartes des zones sont chargees a la demande pour alleger la page.
                      </p>
                      <Button size="sm" className="gap-2" onClick={() => setShowAssignedZoneMaps(true)}>
                        <MapPin className="h-4 w-4" />
                        Afficher les cartes ({assignedZones.length})
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            ) : (
              <Card className="border-2">
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center py-8">Aucune zone assignée</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Sections additionnelles personnalisées */}
      {additionalSections.map((section, index) => (
        <div
          key={index}
          id={createSectionId(section.title)}
          className={getSectionClasses(createSectionId(section.title))}
        >
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-1">{section.title}</h2>
            <Separator className="border-t-2 border-primary mb-2" />
            {section.description && (
              <p className="text-sm text-muted-foreground">{section.description}</p>
            )}
          </div>
          <Separator className="mb-6" />
          {/* Afficher le filtre personnalisé si présent */}
          {section.customFilter && <div className="mb-6">{section.customFilter}</div>}
          <Card className="border-2">
            <CardContent className="pt-6">
              {section.type === 'grid' && (
                <div className="grid gap-6 md:grid-cols-2">
                  ^
                  {section.items.map((item, itemIndex) => (
                    <div key={itemIndex}>
                      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        {item.label}
                      </p>
                      <p className="text-base font-semibold mt-1.5">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
              {section.type === 'list' && (
                <div className="divide-y">
                  {section.items.map((item, itemIndex) => (
                    <div
                      key={itemIndex}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className="text-sm font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {section.type === 'custom' && section.render && section.render(data)}
              {section.type === 'custom' && section.component === 'DoorsTable' && (
                <DoorsTableContent
                  data={section.data.doors}
                  columns={section.data.columns}
                  customStatusFilter={section.data.customFilters}
                  searchPlaceholder="Rechercher par numéro de porte..."
                  searchKey="number"
                />
              )}
              {section.type === 'custom' && section.component === 'ImmeublesTable' && (
                <DoorsTableContent
                  data={section.data.immeubles}
                  columns={section.data.columns}
                  customStatusFilter={section.data.customFilters}
                  searchPlaceholder="Rechercher par adresse..."
                  searchKey="address"
                  nestedTableColumns={section.data.nestedColumns}
                  nestedDataKey="doors"
                  showFilters={section.data.showFilters !== false}
                />
              )}
              {section.type === 'custom' && section.component === 'ChartsSection' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {section.data.charts.map((chart, index) => {
                    if (chart.type === 'PortesStatusChart') {
                      return <PortesStatusChart key={index} {...chart.props} />
                    }
                    if (chart.type === 'PortesProspectionChart') {
                      return <PortesProspectionChart key={index} {...chart.props} />
                    }
                    if (chart.type === 'PortesWeeklyChart') {
                      return <PortesWeeklyChart key={index} {...chart.props} />
                    }
                    return null
                  })}
                </div>
              )}
              {section.type === 'custom' && section.component === 'FloorDetails' && (
                <div className="space-y-6">
                  {section.data.map((floor, floorIndex) => (
                    <div key={floorIndex} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Étage {floor.floor}</h3>
                        <div className="flex gap-2 text-xs">
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                            {floor.doors.filter(d => d.status === 'contrat_signe').length} signés
                          </span>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                            {floor.doors.filter(d => d.status === 'rdv_pris').length} RDV
                          </span>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                            {floor.doors.filter(d => d.status === 'absent').length} absents
                          </span>
                          <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">
                            {floor.doors.filter(d => d.status === 'argumente').length} argumentés
                          </span>
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                            {floor.doors.filter(d => d.status === 'refus').length} refus
                          </span>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <h4 className="text-sm font-medium mb-3">Statut des portes</h4>
                        <div className="grid gap-3">
                          {floor.doors.map((door, doorIndex) => {
                            const getStatusColor = status => {
                              switch (status) {
                                case 'contrat_signe':
                                  return 'bg-green-50 border-green-200 text-green-800'
                                case 'rdv_pris':
                                  return 'bg-blue-50 border-blue-200 text-blue-800'
                                case 'absent':
                                  return 'bg-blue-50 border-blue-200 text-blue-800'
                                case 'argumente':
                                  return 'bg-orange-50 border-orange-200 text-orange-800'
                                case 'refus':
                                  return 'bg-red-50 border-red-200 text-red-800'
                                default:
                                  return 'bg-gray-50 border-gray-200 text-gray-800'
                              }
                            }

                            const getStatusLabel = status => {
                              switch (status) {
                                case 'contrat_signe':
                                  return 'Contrat signé'
                                case 'rdv_pris':
                                  return 'RDV programmé'
                                case 'absent':
                                  return 'Absent'
                                case 'argumente':
                                  return 'Argumenté'
                                case 'refus':
                                  return 'Refus'
                                case 'non_visite':
                                  return 'Non visité'
                                default:
                                  return status
                              }
                            }

                            return (
                              <div
                                key={doorIndex}
                                className={`p-3 rounded border ${getStatusColor(door.status)}`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium">Porte {door.number}</span>
                                      <span className="text-xs px-2 py-1 rounded bg-white/50">
                                        {getStatusLabel(door.status)}
                                      </span>
                                    </div>

                                    {door.rdvDate && (
                                      <div className="text-sm mt-2">
                                        <span className="font-medium">RDV:</span> {door.rdvDate} à{' '}
                                        {door.rdvTime}
                                      </div>
                                    )}

                                    {door.lastVisit && (
                                      <div className="text-sm mt-1">
                                        <span className="font-medium">Dernière visite:</span>{' '}
                                        {door.lastVisit}
                                      </div>
                                    )}

                                    {door.comment && (
                                      <div className="text-sm mt-2 p-2 bg-white/30 rounded">
                                        <span className="font-medium">Commentaire:</span>{' '}
                                        {door.comment}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  )
}
