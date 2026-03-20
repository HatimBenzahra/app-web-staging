import { mapboxCache } from '@/services/core'

/**
 * Fonction pour récupérer l'adresse via reverse geocoding Mapbox AVEC CACHE
 */
export const fetchLocationName = async (longitude, latitude) => {
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

/**
 * Parse l'assignedUserId (format: "role-id") et retourne le rôle et l'ID
 * @param {string} assignedUserId - Format: "directeur-5", "manager-3", "commercial-7"
 * @returns {{role: string, id: number} | null}
 */
export const parseAssignedUserId = assignedUserId => {
  if (!assignedUserId || typeof assignedUserId !== 'string') return null

  const parts = assignedUserId.split('-')
  if (parts.length !== 2) return null

  const [role, idStr] = parts
  const id = parseInt(idStr, 10)

  if (isNaN(id)) return null

  return { role, id }
}

/**
 * Parse plusieurs assignedUserIds et retourne un array d'objets {role, id}
 * @param {string[]} assignedUserIds - Array de format: ["directeur-5", "manager-3", "commercial-7"]
 * @returns {{role: string, id: number}[]}
 */
export const parseAssignedUserIds = assignedUserIds => {
  if (!Array.isArray(assignedUserIds)) return []
  return assignedUserIds
    .map(parseAssignedUserId)
    .filter(assignment => assignment !== null)
}

/**
 * Filtre les assignations pour enlever les utilisateurs subordonnés
 * quand leur supérieur est déjà assigné (évite les doublons dus à la cascade backend)
 */
export const removeRedundantAssignments = (assignments, directeurs, managers, commercials) => {
  // Récupérer les IDs des directeurs assignés
  const assignedDirecteurIds = new Set(
    assignments.filter(a => a.role === 'directeur').map(a => a.id)
  )

  // Filtrer les assignations
  return assignments.filter(assignment => {
    // 1. Si c'est un directeur, toujours garder
    if (assignment.role === 'directeur') {
      return true
    }

    // 2. Si c'est un manager, vérifier s'il n'a pas de directeur assigné
    if (assignment.role === 'manager') {
      const manager = managers?.find(m => m.id === assignment.id)
      if (!manager) return true

      // Si son directeur est assigné, enlever ce manager (cascade backend)
      if (manager.directeurId && assignedDirecteurIds.has(manager.directeurId)) {
        console.log(
          `Manager ${manager.prenom} ${manager.nom} (ID: ${manager.id}) sera assigné automatiquement via son directeur (ID: ${manager.directeurId})`
        )
        return false
      }
      return true
    }

    // 3. Si c'est un commercial, vérifier les relations hiérarchiques
    if (assignment.role === 'commercial') {
      const commercial = commercials?.find(c => c.id === assignment.id)
      if (!commercial) return true

      // Si son directeur est assigné, enlever ce commercial (cascade backend)
      if (commercial.directeurId && assignedDirecteurIds.has(commercial.directeurId)) {
        console.log(
          `Commercial ${commercial.prenom} ${commercial.nom} (ID: ${commercial.id}) sera assigné automatiquement via son directeur (ID: ${commercial.directeurId})`
        )
        return false
      }

      // Si son manager est assigné, vérifier que le directeur du manager n'est pas aussi assigné
      if (commercial.managerId) {
        const manager = managers?.find(m => m.id === commercial.managerId)

        // Si le directeur du manager est assigné, le commercial sera assigné via cascade directeur
        if (manager?.directeurId && assignedDirecteurIds.has(manager.directeurId)) {
          console.log(
            `Commercial ${commercial.prenom} ${commercial.nom} (ID: ${commercial.id}) sera assigné automatiquement via le directeur (ID: ${manager.directeurId}) de son manager`
          )
          return false
        }

        // Sinon, vérifier si le manager est directement assigné
        const isManagerAssigned = assignments.some(
          a => a.role === 'manager' && a.id === commercial.managerId
        )
        if (isManagerAssigned) {
          console.log(
            `Commercial ${commercial.prenom} ${commercial.nom} (ID: ${commercial.id}) sera assigné automatiquement via son manager (ID: ${commercial.managerId})`
          )
          return false
        }
      }

      return true
    }

    return true
  })
}

/**
 * Détermine tous les utilisateurs assignés à une zone (format: ["role-id", ...])
 */
export const getAssignedUserIdsFromZone = (zone, allAssignments) => {
  if (!zone) return []

  const assignedUsers = []

  // 1. Vérifier l'assignation directe au directeur
  if (zone.directeurId) {
    assignedUsers.push(`directeur-${zone.directeurId}`)
  }

  // 2. Vérifier l'assignation directe au manager
  if (zone.managerId) {
    assignedUsers.push(`manager-${zone.managerId}`)
  }

  // 3. Chercher toutes les assignations via ZoneEnCours
  const zoneAssignments = allAssignments?.filter(
    assignment => assignment.zoneId === zone.id
  ) || []

  zoneAssignments.forEach(assignment => {
    if (assignment.userType === 'COMMERCIAL') {
      assignedUsers.push(`commercial-${assignment.userId}`)
    } else if (assignment.userType === 'MANAGER') {
      assignedUsers.push(`manager-${assignment.userId}`)
    } else if (assignment.userType === 'DIRECTEUR') {
      assignedUsers.push(`directeur-${assignment.userId}`)
    }
  })

  // Deduplicate
  return [...new Set(assignedUsers)];
}
