import { useCallback, useMemo } from 'react'
import { useCommercials, useManagers } from '@/services'
import { useKioskDevices } from '@/hooks/metier/api/kiosk'

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
  const { data: kioskDevices } = useKioskDevices()

  // La batterie correcte est celle des tablettes kiosk (même source que les pages
  // Kiosk). On indexe la batterie par commercial : clé principale = commercialId,
  // fallback = commercialName (les pages kiosk joignent par nom). On ignore les
  // batteries inconnues (-1) pour laisser retomber sur le « — » habituel.
  const kioskBatteryByCommercial = useMemo(() => {
    const byId = new Map()
    const byName = new Map()
    for (const device of kioskDevices ?? []) {
      if (device?.batteryLevel == null || device.batteryLevel < 0) continue
      const level = device.batteryLevel
      const id = device.commercialId != null ? Number(device.commercialId) : NaN
      if (Number.isFinite(id) && !byId.has(id)) byId.set(id, level)
      const name = (device.commercialName ?? '').trim()
      if (name && !byName.has(name)) byName.set(name, level)
    }
    return { byId, byName }
  }, [kioskDevices])

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
        const name = resolveActorName(userId, userType)
        // Pour un commercial, la batterie fiable vient de sa tablette kiosk
        // (identique aux pages Kiosk) ; sinon on garde la valeur de la position GPS.
        let batteryLevel = pos.batteryLevel
        if (userType === 'COMMERCIAL') {
          const kioskLevel =
            kioskBatteryByCommercial.byId.get(userId) ??
            kioskBatteryByCommercial.byName.get(name)
          if (kioskLevel != null) batteryLevel = kioskLevel
        }
        result.push({
          key,
          userId,
          userType,
          name,
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracy: pos.accuracy,
          batteryLevel,
          online: Boolean(pos.isOnline),
          lastSeen: pos.recordedAt,
        })
      }
      return result
    },
    [resolveActorName, kioskBatteryByCommercial]
  )

  return { resolveActorName, buildActors }
}
