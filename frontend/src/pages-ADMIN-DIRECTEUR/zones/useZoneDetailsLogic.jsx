import { useParams } from 'react-router-dom'
import {
  useZone,
  useStatisticsByZone,
  useCommercials,
  useZoneStatistics,
  useZoneCurrentAssignments,
} from '@/hooks/metier/use-api'
import { useEntityPermissions } from '@/hooks/metier/permissions/useRoleBasedData'
import { useMemo, useState, useEffect } from 'react'
import { mapboxCache } from '@/services/core'
import { logError } from '@/services/core'
import AssignedZoneCard from '@/components/AssignedZoneCard'

const fetchLocationName = async (longitude, latitude) => {
  const roundedLng = longitude.toFixed(4)
  const roundedLat = latitude.toFixed(4)

  const fetchGeocode = async () => {
    try {
      const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${token}&types=place,region,country&language=fr`
      )

      if (!response.ok) {
        throw new Error(`Erreur Mapbox API: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (data.features && data.features.length > 0) {
        const feature = data.features[0]
        return feature.place_name || feature.text
      } else {
        return `${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E`
      }
    } catch (error) {
      // Utiliser le système centralisé de logging d'erreurs
      logError(error, 'ZoneDetails.fetchLocationName', {
        longitude,
        latitude,
      })
      return `${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E`
    }
  }

  // Utiliser le cache dédié Mapbox
  const cacheKey = mapboxCache.getKey(fetchGeocode, [roundedLng, roundedLat], 'mapbox-geocode')
  return mapboxCache.fetchWithCache(cacheKey, fetchGeocode)
}

export function useZoneDetailsLogic() {
  const { id } = useParams()

  // État pour le nom de la localisation
  const [locationName, setLocationName] = useState('Chargement...')

  // API hooks
  const { data: zone, loading: zoneLoading, error } = useZone(parseInt(id))
  const { data: statistics, loading: statsLoading } = useStatisticsByZone(parseInt(id))
  const { data: allZoneStats, loading: zoneStatsLoading } = useZoneStatistics()
  const { data: commercials } = useCommercials()
  const { data: zoneAssignments } = useZoneCurrentAssignments(parseInt(id))
  const permissions = useEntityPermissions('zones')

  // Charger le nom de la localisation
  useEffect(() => {
    if (zone?.xOrigin && zone?.yOrigin) {
      fetchLocationName(zone.xOrigin, zone.yOrigin)
        .then(name => {
          setLocationName(name)
        })
        .catch(error => {
          logError(error, 'ZoneDetails.fetchLocationName', {
            zoneId: zone.id,
            zoneName: zone.nom,
          })
          setLocationName(`${zone.yOrigin.toFixed(2)}°N, ${zone.xOrigin.toFixed(2)}°E`)
        })
    }
  }, [zone])

  // Transformation des données API vers format UI
  const zoneData = useMemo(() => {
    if (!zone) return null

    // Trouver les commercials assignés à cette zone via ZoneEnCours
    const assignedCommercialIds =
      zoneAssignments
        ?.filter(assignment => assignment.userType === 'COMMERCIAL')
        .map(assignment => assignment.userId) || []
    const assignedCommercials = commercials?.filter(c => assignedCommercialIds.includes(c.id)) || []

    // Compter les immeubles dans cette zone
    const immeubles_count = zone.immeubles?.length || 0

    return {
      ...zone,
      name: zone.nom,
      region: `Zone ${zone.nom}`,
      immeubles_count,
      manager:
        assignedCommercials.length > 0
          ? assignedCommercials.map(c => `${c.prenom} ${c.nom}`).join(', ')
          : 'Non assigné',
      status: 'actif',
      commercial_count: assignedCommercials.length,
      description: `Zone géographique ${zone.nom}`,
      surface_area: `${(zone.rayon / 1000).toFixed(1)} km de rayon`,
      population: 'Non définie',
      avg_rent: 'Non défini',
    }
  }, [zone, commercials, zoneAssignments])

  // Obtenir les statistiques agrégées de la zone depuis l'API
  const zoneStats = useMemo(() => {
    if (!allZoneStats || !id) return null
    return allZoneStats.find(stat => stat.zoneId === parseInt(id))
  }, [allZoneStats, id])

  // Calculer les statistiques agrégées de la zone (fallback si API pas disponible)
  const aggregatedStats = useMemo(() => {
    // Utiliser les stats de l'API si disponibles
    if (zoneStats) {
      return {
        contratsSignes: zoneStats.totalContratsSignes,
        immeublesVisites: zoneStats.totalImmeublesVisites,
        rendezVousPris: zoneStats.totalRendezVousPris,
        refus: zoneStats.totalRefus,
        nbImmeublesProspectes: zoneStats.totalImmeublesProspectes,
        nbPortesProspectes: zoneStats.totalPortesProspectes,
        tauxConversion: zoneStats.tauxConversion,
        tauxSuccesRdv: zoneStats.tauxSuccesRdv,
        nombreCommerciaux: zoneStats.nombreCommerciaux,
        performanceGlobale: zoneStats.performanceGlobale,
      }
    }

    // Fallback vers le calcul manuel si API pas disponible
    if (!statistics || statistics.length === 0) {
      return {
        contratsSignes: 0,
        immeublesVisites: 0,
        rendezVousPris: 0,
        refus: 0,
        nbImmeublesProspectes: 0,
        nbPortesProspectes: 0,
        tauxConversion: 0,
        tauxSuccesRdv: 0,
        nombreCommerciaux: 0,
        performanceGlobale: 0,
      }
    }

    const totals = statistics.reduce(
      (acc, stat) => ({
        contratsSignes: acc.contratsSignes + (stat.contratsSignes || 0),
        immeublesVisites: acc.immeublesVisites + (stat.immeublesVisites || 0),
        rendezVousPris: acc.rendezVousPris + (stat.rendezVousPris || 0),
        refus: acc.refus + (stat.refus || 0),
        nbImmeublesProspectes: acc.nbImmeublesProspectes + (stat.nbImmeublesProspectes || 0),
        nbPortesProspectes: acc.nbPortesProspectes + (stat.nbPortesProspectes || 0),
      }),
      {
        contratsSignes: 0,
        immeublesVisites: 0,
        rendezVousPris: 0,
        refus: 0,
        nbImmeublesProspectes: 0,
        nbPortesProspectes: 0,
        tauxConversion: 0,
        tauxSuccesRdv: 0,
        nombreCommerciaux: 0,
        performanceGlobale: 0,
      }
    )

    // Calcul des taux
    const tauxConversion =
      totals.nbPortesProspectes > 0 ? (totals.contratsSignes / totals.nbPortesProspectes) * 100 : 0
    const tauxSuccesRdv =
      totals.immeublesVisites > 0 ? (totals.rendezVousPris / totals.immeublesVisites) * 100 : 0

    return {
      ...totals,
      tauxConversion: Math.round(tauxConversion * 100) / 100,
      tauxSuccesRdv: Math.round(tauxSuccesRdv * 100) / 100,
      nombreCommerciaux: new Set(statistics.map(s => s.commercialId).filter(Boolean)).size,
      performanceGlobale: Math.round((tauxConversion * 0.4 + tauxSuccesRdv * 0.6) * 100) / 100,
    }
  }, [zoneStats, statistics])

  const personalInfo = useMemo(() => {
    if (!zoneData) return []
    return [
      { label: 'Région', value: zoneData.region, icon: 'mapPin' },
      { label: 'Commerciaux assignés', value: zoneData.manager, icon: 'users' },
      { label: 'Nombre de commerciaux', value: zoneData.commercial_count, icon: 'users' },
      { label: "Nombre d'immeubles", value: zoneData.immeubles_count, icon: 'building' },
      { label: 'Rayon de couverture', value: zoneData.surface_area, icon: 'mapPin' },
      {
        label: 'Coordonnées centre',
        value: locationName,
        icon: 'mapPin',
      },
      { label: 'Description', value: zoneData.description, icon: 'building' },
    ]
  }, [zoneData, locationName])

  // Statistiques personnalisées pour la zone
  const customStatsCards = useMemo(
    () => [
      {
        title: 'Contrats signés',
        value: aggregatedStats.contratsSignes,
        description: 'Total des contrats dans cette zone',
        icon: 'fileText',
      },
      {
        title: 'Rendez-vous pris',
        value: aggregatedStats.rendezVousPris,
        description: 'Total des rendez-vous dans cette zone',
        icon: 'calendar',
      },
      {
        title: 'Immeubles visités',
        value: aggregatedStats.immeublesVisites,
        description: 'Immeubles visités dans cette zone',
        icon: 'building',
      },
      {
        title: 'Refus',
        value: aggregatedStats.refus,
        description: 'Total des refus dans cette zone',
        icon: 'x',
      },
      {
        title: 'Taux de conversion',
        value: `${aggregatedStats.tauxConversion || 0}%`,
        description: 'Pourcentage de contrats signés / portes prospectées',
        icon: 'trendingUp',
      },
      {
        title: 'Taux succès RDV',
        value: `${aggregatedStats.tauxSuccesRdv || 0}%`,
        description: 'Pourcentage de RDV obtenus / immeubles visités',
        icon: 'target',
      },
      {
        title: 'Performance globale',
        value: `${aggregatedStats.performanceGlobale || 0} pts`,
        description: 'Score de performance composite de la zone',
        icon: 'award',
      },
      {
        title: 'Portes prospectées',
        value: aggregatedStats.nbPortesProspectes,
        description: 'Total des portes prospectées dans cette zone',
        icon: 'door',
      },
    ],
    [aggregatedStats]
  )

  // Sections personnalisées avec la carte de zone
  const customSections = useMemo(
    () => [
      {
        title: 'Visualisation de la zone',
        description: 'Carte interactive avec limites géographiques',
        type: 'custom',
        render: () => (
          <AssignedZoneCard
            zone={zone}
            assignmentDate={zone?.createdAt}
            className="w-full"
            fullWidth={true}
          />
        ),
      },
    ],
    [zone]
  )

  return {
    zoneData,
    zoneLoading,
    statsLoading,
    zoneStatsLoading,
    error,
    permissions,
    personalInfo,
    customStatsCards,
    customSections,
  }
}
