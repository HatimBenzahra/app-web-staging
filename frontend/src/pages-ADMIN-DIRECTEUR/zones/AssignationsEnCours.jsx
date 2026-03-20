import { useMemo } from 'react'
import { useAllCurrentAssignments, useCommercials, useManagers, useDirecteurs } from '@/services'
import { AdvancedDataTable } from '@/components/tableau'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { mapboxCache } from '@/services/core'

// Fonction pour récupérer l'adresse via reverse geocoding Mapbox AVEC CACHE
const fetchLocationName = async (longitude, latitude) => {
  // Arrondir les coordonnées pour améliorer le taux de cache hit
  const roundedLng = longitude.toFixed(4)
  const roundedLat = latitude.toFixed(4)

  // Créer une fonction unique pour cette géolocalisation
  const fetchGeocode = async () => {
    try {
      const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${token}&types=place,region,country&language=fr`
      )
      const data = await response.json()

      if (data.features && data.features.length > 0) {
        // Récupérer le lieu le plus pertinent (ville, région, pays)
        const feature = data.features[0]
        return feature.place_name || feature.text
      } else {
        return `${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E`
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du nom de lieu:', error)
      return `${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E`
    }
  }

  // Utiliser le cache dédié Mapbox avec namespace et gestion de déduplication
  const cacheKey = mapboxCache.getKey(fetchGeocode, [roundedLng, roundedLat], 'mapbox-geocode')
  return mapboxCache.fetchWithCache(cacheKey, fetchGeocode)
}

export default function AssignationsEnCours() {
  // Charger les données
  const {
    data: rawAssignments,
    loading: assignmentsLoading,
    error: assignmentsError,
  } = useAllCurrentAssignments()

  const { data: commercials } = useCommercials()
  const { data: managers } = useManagers()
  const { data: directeurs } = useDirecteurs()

  // Enrichir les données avec les noms des utilisateurs
  const enrichedAssignments = useMemo(() => {
    if (!rawAssignments) return []

    return rawAssignments.map(item => {
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

      // Calculer le nombre de jours depuis l'assignation
      const daysSince = Math.ceil((new Date() - new Date(item.assignedAt)) / (1000 * 60 * 60 * 24))

      return {
        ...item,
        userName,
        zoneName: item.zone?.nom || 'N/A',
        daysSince,
      }
    })
  }, [rawAssignments, commercials, managers, directeurs])

  // Configuration pour le lazy loading des adresses
  const mapboxLazyLoader = useMemo(
    () => ({
      namespace: 'mapbox-geocode',
      fetcher: async assignment => {
        if (assignment.zone?.xOrigin && assignment.zone?.yOrigin) {
          return fetchLocationName(assignment.zone.xOrigin, assignment.zone.yOrigin)
        }
        return null
      },
      getCacheKey: assignment => {
        if (assignment.zone?.xOrigin && assignment.zone?.yOrigin) {
          return [assignment.zone.xOrigin.toFixed(4), assignment.zone.yOrigin.toFixed(4)]
        }
        return null
      },
      shouldLoad: (assignment, currentData) => {
        return assignment.zone?.xOrigin && assignment.zone?.yOrigin && !currentData
      },
      delay: 200, // 200ms entre chaque appel
      maxConcurrent: 3,
    }),
    []
  )

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
      header: "Date d'assignation",
      accessor: 'assignedAt',
      sortable: true,
      cell: row => new Date(row.assignedAt).toLocaleDateString('fr-FR'),
    },
    {
      header: 'Depuis',
      accessor: 'daysSince',
      sortable: true,
      className: 'hidden md:table-cell text-center',
      cell: row => (
        <Badge className="bg-blue-100 text-blue-800">
          {row.daysSince} jour{row.daysSince > 1 ? 's' : ''}
        </Badge>
      ),
    },
    {
      header: 'Rayon',
      accessor: 'rayon',
      sortable: true,
      className: 'hidden lg:table-cell text-center',
      cell: row => (row.zone?.rayon ? `${(row.zone.rayon / 1000).toFixed(1)} km` : 'N/A'),
    },
    {
      header: 'Localisation',
      accessor: 'location',
      className: 'hidden xl:table-cell',
      cell: (row, { getLoadedData, isLoading }) => {
        // Utiliser les données chargées dynamiquement
        const loadedLocation = getLoadedData(row, 'mapbox-geocode')

        if (loadedLocation) return loadedLocation

        if (row.zone?.xOrigin && row.zone?.yOrigin) {
          const isCurrentlyLoading = isLoading(row, 'mapbox-geocode')
          if (isCurrentlyLoading) {
            return (
              <span className="text-gray-500 text-sm flex items-center gap-1">
                <div className="animate-spin h-3 w-3 border border-gray-300 border-t-blue-600 rounded-full"></div>
                Chargement...
              </span>
            )
          }
          // Si pas encore chargé et pas en cours, afficher coordonnées temporaires
          return `${row.zone.yOrigin.toFixed(2)}°N, ${row.zone.xOrigin.toFixed(2)}°E`
        }

        return 'Non disponible'
      },
    },
  ]

  if (assignmentsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assignations en Cours</CardTitle>
          <CardDescription>Chargement...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (assignmentsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assignations en Cours</CardTitle>
          <CardDescription className="text-red-500">
            Erreur lors du chargement : {assignmentsError}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Assignations en Cours</h1>
        <p className="text-muted-foreground text-base">
          Visualisez toutes les zones actuellement assignées et leur progression
        </p>
      </div>
      <AdvancedDataTable
        showStatusColumn={false}
        title="Assignations en Cours"
        description="Toutes les zones actuellement assignées aux utilisateurs"
        data={enrichedAssignments}
        columns={columns}
        searchKey="zoneName"
        itemsPerPage={15}
        detailsPath="/zones"
        lazyLoaders={[mapboxLazyLoader]}
      />
    </div>
  )
}
