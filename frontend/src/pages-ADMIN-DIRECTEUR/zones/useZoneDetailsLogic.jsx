import { useParams } from 'react-router-dom'
import {
  useZone,
  useCommercials,
  useZoneStatistics,
  useZoneCurrentAssignments,
} from '@/hooks/metier/use-api'
import { useEntityPermissions } from '@/hooks/metier/permissions/useRoleBasedData'
import { useMemo, useState, useEffect } from 'react'
import { mapboxCache } from '@/services/core'
import { logError } from '@/services/core'
import AssignedZoneCard from '@/components/AssignedZoneCard'
import { habitatBreakdown } from '@/constants/domain/habitat'

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

    // Compter et ventiler les bâtiments de cette zone
    const immeubles_count = zone.immeubles?.length || 0
    const typeBreakdown = habitatBreakdown(zone.immeubles || [])

    return {
      ...zone,
      name: zone.nom,
      region: `Zone ${zone.nom}`,
      immeubles_count,
      typeBreakdown,
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

  // Statistiques de la zone : uniquement l'agrégat fourni par le backend (même
  // source que le mobile). Si le backend n'a pas de stats pour cette zone, on
  // n'invente rien (pas de calcul de secours divergent) → les cartes afficheront « — ».
  const aggregatedStats = useMemo(() => {
    if (!zoneStats) return null
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
  }, [zoneStats])

  const personalInfo = useMemo(() => {
    if (!zoneData) return []
    return [
      { label: 'Région', value: zoneData.region, icon: 'mapPin' },
      { label: 'Commerciaux assignés', value: zoneData.manager, icon: 'users' },
      { label: 'Nombre de commerciaux', value: zoneData.commercial_count, icon: 'users' },
      { label: 'Nombre de bâtiments', value: zoneData.immeubles_count, icon: 'building' },
      {
        label: 'Répartition des bâtiments',
        value: `${zoneData.typeBreakdown.IMMEUBLE} immeubles · ${zoneData.typeBreakdown.MAISON} maisons · ${zoneData.typeBreakdown.PAVILLON} pavillons`,
        icon: 'building',
      },
      { label: 'Rayon de couverture', value: zoneData.surface_area, icon: 'mapPin' },
      {
        label: 'Coordonnées centre',
        value: locationName,
        icon: 'mapPin',
      },
      { label: 'Description', value: zoneData.description, icon: 'building' },
    ]
  }, [zoneData, locationName])

  // Statistiques personnalisées pour la zone.
  // Sans agrégat backend (zone absente de zoneStatistics) → « — » comme le mobile.
  // Les % sont arrondis à l'entier pour coller à l'affichage mobile.
  const customStatsCards = useMemo(() => {
    const s = aggregatedStats
    const count = v => (s ? v : '—')
    const pct = v => (s && v != null ? `${Math.round(v)}%` : '—')
    return [
      {
        title: 'Contrats signés',
        value: count(s?.contratsSignes),
        description: 'Total des contrats dans cette zone',
        icon: 'fileText',
      },
      {
        title: 'Rendez-vous pris',
        value: count(s?.rendezVousPris),
        description: 'Total des rendez-vous dans cette zone',
        icon: 'calendar',
      },
      {
        title: 'Bâtiments visités',
        value: count(s?.immeublesVisites),
        description: 'Bâtiments visités dans cette zone',
        icon: 'building',
      },
      {
        title: 'Refus',
        value: count(s?.refus),
        description: 'Total des refus dans cette zone',
        icon: 'x',
      },
      {
        title: 'Taux de conversion',
        value: pct(s?.tauxConversion),
        description: 'Contrats signés / (refus + RDV + contrats)',
        icon: 'trendingUp',
      },
      {
        title: 'Taux succès RDV',
        value: pct(s?.tauxSuccesRdv),
        description: 'RDV obtenus / bâtiments visités',
        icon: 'target',
      },
      {
        title: 'Performance globale',
        value: s ? `${Math.round(s.performanceGlobale)} pts` : '—',
        description: 'Taux de conversion + taux de succès RDV',
        icon: 'award',
      },
      {
        title: 'Portes prospectées',
        value: count(s?.nbPortesProspectes),
        description: 'Total des portes prospectées dans cette zone',
        icon: 'door',
      },
    ]
  }, [aggregatedStats])

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
    zoneStatsLoading,
    error,
    permissions,
    personalInfo,
    customStatsCards,
    customSections,
  }
}
