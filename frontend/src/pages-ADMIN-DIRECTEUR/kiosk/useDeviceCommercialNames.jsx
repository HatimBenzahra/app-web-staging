import { useMemo } from 'react'
import { useKioskDevices } from '@/hooks/metier/api/kiosk'

/**
 * Source of truth: the commercial/operator name is the value the tablet reports
 * in its heartbeat (`device.commercialName`), i.e. the ProWin operator assigned
 * via SET_OPERATOR. This is pure MDM asset labeling (which tablet belongs to
 * whom) — it is NOT derived from any GraphQL mapping model or commercial↔device
 * name-matching.
 */
export function useDeviceCommercialNames() {
  const devicesQuery = useKioskDevices()

  const nameMap = useMemo(() => {
    const map = new Map()
    for (const device of devicesQuery.data || []) {
      const commercialName = device?.commercialName || null
      if (!commercialName) continue
      if (device.deviceId) map.set(device.deviceId, commercialName)
      if (device.serialNumber) map.set(device.serialNumber, commercialName)
    }
    return map
  }, [devicesQuery.data])

  const getCommercialName = deviceOrId => {
    if (!deviceOrId) return null
    if (typeof deviceOrId === 'string') {
      return nameMap.get(deviceOrId) || null
    }
    return deviceOrId.commercialName || null
  }

  const getDeviceLabel = device => {
    if (!device) return ''
    const commercialName = device.commercialName || null
    return commercialName ? `${commercialName} — ${device.deviceName}` : device.deviceName
  }

  return { getCommercialName, getDeviceLabel }
}

export default useDeviceCommercialNames
