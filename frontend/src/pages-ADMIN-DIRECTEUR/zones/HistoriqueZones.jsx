import { useMemo } from 'react'
import { useAllZoneHistory, useCommercials, useManagers, useDirecteurs } from '@/services'
import { AdvancedDataTable } from '@/components/tableau'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function HistoriqueZones() {
  // implemented useAllZoneHistory hook as a filter by current user role and id
  const { data: rawHistory, loading: historyLoading, error: historyError } = useAllZoneHistory()

  const { data: commercials } = useCommercials()
  const { data: managers } = useManagers()
  const { data: directeurs } = useDirecteurs()

  // Enrichir les données avec les noms des utilisateurs
  const enrichedHistory = useMemo(() => {
    if (!rawHistory) return []

    return rawHistory.map(item => {
      // Trouver le nom de l'utilisateur selon son type
      let userName = `ID: ${item.userId}`

      if (item.userType === 'COMMERCIAL') {
        const commercial = commercials?.find(c => c.id === item.userId)
        if (commercial) userName = `${commercial.prenom} ${commercial.nom}`
      } else if (item.userType === 'MANAGER') {
        const manager = managers?.find(m => m.id === item.userId)
        if (manager) userName = `${manager.prenom} ${manager.nom}`
      } else if (item.userType === 'DIRECTEUR') {
        const directeur = directeurs?.find(d => d.id === item.userId)
        if (directeur) userName = `${directeur.prenom} ${directeur.nom}`
      }

      // Calculer la durée
      const durationDays = Math.ceil(
        (new Date(item.unassignedAt) - new Date(item.assignedAt)) / (1000 * 60 * 60 * 24)
      )

      return {
        ...item,
        id: item.zone?.id || item.id, // Utiliser l'ID de la zone pour la navigation
        userName,
        zoneName: item.zone?.nom || 'N/A',
        durationDays,
      }
    })
  }, [rawHistory, commercials, managers, directeurs])

  // Configuration des colonnes
  const columns = [
    {
      header: 'Zone',
      accessor: 'zoneName',
      sortable: true,
      className: 'font-medium',
    },
    {
      header: 'Utilisateur',
      accessor: 'userName',
      sortable: true,
    },
    {
      header: 'Type',
      accessor: 'userType',
      sortable: true,
      cell: row => {
        const variant =
          row.userType === 'DIRECTEUR'
            ? 'default'
            : row.userType === 'MANAGER'
              ? 'secondary'
              : 'outline'
        return <Badge variant={variant}>{row.userType}</Badge>
      },
    },
    {
      header: 'Date début',
      accessor: 'assignedAt',
      sortable: true,
      className: 'hidden md:table-cell',
      cell: row => new Date(row.assignedAt).toLocaleDateString('fr-FR'),
    },
    {
      header: 'Date fin',
      accessor: 'unassignedAt',
      sortable: true,
      className: 'hidden md:table-cell',
      cell: row => new Date(row.unassignedAt).toLocaleDateString('fr-FR'),
    },
    {
      header: 'Durée',
      accessor: 'durationDays',
      sortable: true,
      className: 'hidden lg:table-cell text-center',
      cell: row => `${row.durationDays} jour${row.durationDays > 1 ? 's' : ''}`,
    },
    {
      header: 'Contrats',
      accessor: 'totalContratsSignes',
      sortable: true,
      className: 'text-center',
      cell: row => (
        <Badge className="bg-green-100 text-green-800">{row.totalContratsSignes || 0}</Badge>
      ),
    },
    {
      header: 'Immeubles',
      accessor: 'totalImmeublesVisites',
      sortable: true,
      className: 'hidden xl:table-cell text-center',
      cell: row => (
        <Badge className="bg-blue-100 text-blue-800">{row.totalImmeublesVisites || 0}</Badge>
      ),
    },
    {
      header: 'RDV',
      accessor: 'totalRendezVousPris',
      sortable: true,
      className: 'hidden xl:table-cell text-center',
      cell: row => (
        <Badge className="bg-purple-100 text-purple-800">{row.totalRendezVousPris || 0}</Badge>
      ),
    },
  ]

  if (historyLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historique des Zones</CardTitle>
          <CardDescription>Chargement...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (historyError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historique des Zones</CardTitle>
          <CardDescription className="text-red-500">
            Erreur lors du chargement : {historyError}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Historique des Zones</h1>
        <p className="text-muted-foreground text-base">
          Consultez l'historique complet des assignations de zones avec leurs performances
        </p>
      </div>
      <AdvancedDataTable
        showStatusColumn={false}
        title="Historique des Zones"
        description="Toutes les assignations de zones passées avec leurs statistiques"
        data={enrichedHistory}
        columns={columns}
        searchKey="zoneName"
        itemsPerPage={10}
        detailsPath="/zones"
      />
    </div>
  )
}
