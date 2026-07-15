import { useCallback } from 'react'
import { useCommercials, useManagers } from '@/services'

const normalizeUserType = value => (value === 'MANAGER' ? 'MANAGER' : 'COMMERCIAL')

/**
 * Directory helper joining actor-keyed GPS positions (userId, userType) to the
 * matching commercial / manager to obtain a displayable « prénom nom ».
 * Single source of truth for the join, shared by the GPS tracking page and the
 * dashboard fleet widget.
 */
export function useActorDirectory() {
  const { data: allCommercials } = useCommercials()
  const { data: allManagers } = useManagers()

  const resolveActorName = useCallback(
    (userId, userType) => {
      const type = normalizeUserType(userType)
      const id = Number(userId)
      const list = type === 'MANAGER' ? allManagers : allCommercials
      const person = (list ?? []).find(p => Number(p.id) === id)
      return person ? `${person.prenom} ${person.nom}`.trim() : `#${userId}`
    },
    [allCommercials, allManagers]
  )

  const buildActors = useCallback(
    positions => {
      const seen = new Set()
      const result = []
      for (const pos of positions ?? []) {
        if (pos.userId == null) continue
        const userType = normalizeUserType(pos.userType)
        const userId = Number(pos.userId)
        const key = `${userType}-${userId}`
        if (seen.has(key)) continue
        seen.add(key)
        result.push({
          key,
          userId,
          userType,
          name: resolveActorName(userId, userType),
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracy: pos.accuracy,
          batteryLevel: pos.batteryLevel,
          online: Boolean(pos.isOnline),
          lastSeen: pos.recordedAt,
        })
      }
      return result
    },
    [resolveActorName]
  )

  return { resolveActorName, buildActors }
}
