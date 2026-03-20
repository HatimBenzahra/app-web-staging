import { useMemo } from 'react'
import { useDeviceMappings } from '@/hooks/metier/api/gps-tracking'

export default function useDeviceCommercialNames() {
  const { data: mappings, isLoading } = useDeviceMappings()

  const lookup = useMemo(() => {
    const map = new Map()
    if (mappings) {
      for (const m of mappings) {
        map.set(m.deviceId, m.commercialName)
      }
    }
    return map
  }, [mappings])

  const getCommercialName = deviceOrId => {
    if (!deviceOrId) return null
    if (typeof deviceOrId === 'string') return lookup.get(deviceOrId) || null
    return lookup.get(deviceOrId.serialNumber)
      || lookup.get(deviceOrId.deviceId)
      || null
  }

  const getDeviceLabel = device => {
    if (!device) return ''
    const commercial = getCommercialName(device)
    const name = device.deviceName || device.deviceId || ''
    if (commercial) return `${commercial} — ${name}`
    return name
  }

  return { getCommercialName, getDeviceLabel, mappings: mappings || [], isLoading }
}
