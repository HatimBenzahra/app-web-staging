import React, { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  useKioskDevices,
  useKioskSendCommand,
  useKioskRenameDevice,
  useKioskDeleteDevice,
} from '@/hooks/metier/api/kiosk'
import { useSetDeviceCommercial } from '@/hooks/metier/api/gps-tracking'
import DevicesTab from './components/DevicesTab'
import DeviceDetailSheet from './components/DeviceDetailSheet'
import DeviceCommandDialog from './components/DeviceCommandDialog'
import KioskErrorState from './components/KioskErrorState'

export default function KioskDevicesPage() {
  const devicesQuery = useKioskDevices()
  const sendCommandMutation = useKioskSendCommand()
  const renameDeviceMutation = useKioskRenameDevice()
  const deleteDeviceMutation = useKioskDeleteDevice()
  const setCommercialMutation = useSetDeviceCommercial()

  const [deviceFilters, setDeviceFilters] = useState({
    search: '',
    onlineFilter: 'all',
    lockFilter: 'all',
  })
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [commandDialog, setCommandDialog] = useState({ open: false, data: null })

  const handleDeviceCommand = (device, preset) => {
    if (!device) return

    if (preset?.action) {
      sendCommandMutation.mutate({
        deviceId: device.deviceId,
        action: preset.action,
        payload: preset.payload,
      })
      return
    }

    setCommandDialog({ open: true, data: device })
  }

  const handleRenameDevice = device => {
    const newName = window.prompt('Nouveau nom de la tablette', device.deviceName || '')
    if (!newName || !newName.trim()) return
    renameDeviceMutation.mutate({ deviceId: device.deviceId, deviceName: newName.trim() })
  }

  const handleDeleteDevice = device => {
    if (window.confirm(`Supprimer la tablette ${device.deviceName || device.deviceId} ?`)) {
      deleteDeviceMutation.mutate(device.deviceId)
    }
  }

  const handleSetCommercial = ({ deviceId, commercialName }) => {
    setCommercialMutation.mutate({ deviceId, commercialName })
  }

  if (devicesQuery.isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-muted-foreground">Chargement des tablettes...</p>
          </div>
        </div>
      </div>
    )
  }

  if (devicesQuery.error) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tablettes</h1>
          <p className="text-muted-foreground mt-1">Gestion du parc de tablettes kiosk</p>
        </div>
        <KioskErrorState error={devicesQuery.error} onRetry={() => devicesQuery.refetch()} />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tablettes</h1>
        <p className="text-muted-foreground mt-1">Gestion du parc de tablettes kiosk</p>
      </div>

      <DevicesTab
        devices={devicesQuery.data || []}
        loading={devicesQuery.isLoading}
        deviceFilters={deviceFilters}
        setDeviceFilters={setDeviceFilters}
        onCommand={handleDeviceCommand}
        onSetCommercial={handleSetCommercial}
        onRename={handleRenameDevice}
        onDelete={handleDeleteDevice}
        onSelectDevice={setSelectedDevice}
      />

      <DeviceDetailSheet
        device={selectedDevice}
        open={Boolean(selectedDevice)}
        onClose={() => setSelectedDevice(null)}
        onCommand={payload => sendCommandMutation.mutate(payload)}
        onRename={handleRenameDevice}
      />

      <DeviceCommandDialog
        open={commandDialog.open}
        onClose={() => setCommandDialog({ open: false, data: null })}
        onSend={payload => sendCommandMutation.mutate(payload)}
        device={commandDialog.data}
        isPending={sendCommandMutation.isPending}
      />
    </div>
  )
}
