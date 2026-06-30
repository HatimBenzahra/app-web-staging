import { useMemo } from 'react'
import { useKioskDevices } from '@/hooks/metier/api/kiosk'

// Source unique du nom commercial : il est remonté par la tablette dans son
// heartbeat (device.commercialName) puis stocké côté backend kiosk. On indexe
// ce champ par deviceId ET serialNumber pour résoudre aussi les appels qui ne
// disposent que d'un identifiant.
export default function useDeviceCommercialNames() {
  const { data: devices, isLoading } = useKioskDevices()

  const lookup = useMemo(() => {
    const map = new Map()
    for (const device of devices || []) {
      const name = device.commercialName
      if (!name) continue
      if (device.deviceId) map.set(device.deviceId, name)
      if (device.serialNumber) map.set(device.serialNumber, name)
    }
    return map
  }, [devices])

  const getCommercialName = deviceOrId => {
    if (!deviceOrId) return null
    if (typeof deviceOrId === 'string') return lookup.get(deviceOrId) || null
    return (
      deviceOrId.commercialName
      || lookup.get(deviceOrId.serialNumber)
      || lookup.get(deviceOrId.deviceId)
      || null
    )
  }

  const getDeviceLabel = device => {
    if (!device) return ''
    const commercial = getCommercialName(device)
    const name = device.deviceName || device.deviceId || ''
    if (commercial) return `${commercial} — ${name}`
    return name
  }

  return { getCommercialName, getDeviceLabel, isLoading }
}
