import React, { useMemo, useState } from 'react'
import { RefreshCw, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useKioskVersionMatrix,
  useKioskDeployHistory,
  useKioskDevices,
  useKioskDeploy,
} from '@/hooks/metier/api/kiosk'
import DeploymentsTab from './components/DeploymentsTab'
import DeployDialog from './components/DeployDialog'
import KioskErrorState from './components/KioskErrorState'

export default function KioskDeploymentsPage() {
  const versionMatrixQuery = useKioskVersionMatrix()
  const devicesQuery = useKioskDevices()
  const deployMutation = useKioskDeploy()

  const [deployDialog, setDeployDialog] = useState({ open: false, data: null })
  const [activeTab, setActiveTab] = useState('deploy')
  const [deployHistoryFilters, setDeployHistoryFilters] = useState({
    deviceId: 'all',
    limit: 20,
  })

  const normalizedDeployHistoryFilters = useMemo(
    () => ({
      deviceId: deployHistoryFilters.deviceId === 'all' ? undefined : deployHistoryFilters.deviceId,
      limit: Number(deployHistoryFilters.limit) || 20,
    }),
    [deployHistoryFilters]
  )

  const deployHistoryQuery = useKioskDeployHistory(normalizedDeployHistoryFilters)

  const initialLoading =
    (!versionMatrixQuery.data && versionMatrixQuery.isLoading) ||
    (!deployHistoryQuery.data && deployHistoryQuery.isLoading) ||
    (!devicesQuery.data && devicesQuery.isLoading)

  if (initialLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-muted-foreground">Chargement des déploiements...</p>
          </div>
        </div>
      </div>
    )
  }

  const mainError = versionMatrixQuery.error || deployHistoryQuery.error || devicesQuery.error
  if (mainError) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Déploiements</h1>
          <p className="text-muted-foreground mt-1">
            Pilotage des déploiements OTA et suivi des exécutions
          </p>
        </div>
        <KioskErrorState
          error={mainError}
          onRetry={() => {
            versionMatrixQuery.refetch()
            deployHistoryQuery.refetch()
            devicesQuery.refetch()
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Déploiements</h1>
          <p className="text-muted-foreground mt-1">
            Pilotage des déploiements OTA et suivi des exécutions
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Circle
              className={`h-2.5 w-2.5 fill-current ${
                versionMatrixQuery.isFetching || deployHistoryQuery.isFetching
                  ? 'animate-pulse text-chart-2'
                  : 'text-muted-foreground/60'
              }`}
            />
            <span>
              {versionMatrixQuery.isFetching || deployHistoryQuery.isFetching
                ? 'Actualisation en cours'
                : 'Données synchronisées'}
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            versionMatrixQuery.refetch()
            deployHistoryQuery.refetch()
            devicesQuery.refetch()
          }}
          disabled={versionMatrixQuery.isFetching || deployHistoryQuery.isFetching}
        >
          <RefreshCw
            className={`h-4 w-4 ${
              versionMatrixQuery.isFetching || deployHistoryQuery.isFetching ? 'animate-spin' : ''
            }`}
          />
          Rafraîchir
        </Button>
      </div>

      <DeploymentsTab
        versionMatrix={versionMatrixQuery.data}
        deployHistory={deployHistoryQuery.data}
        loading={initialLoading}
        onDeploy={device => setDeployDialog({ open: true, data: device })}
        deployHistoryFilters={deployHistoryFilters}
        setDeployHistoryFilters={setDeployHistoryFilters}
        devices={devicesQuery.data || []}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <DeployDialog
        open={deployDialog.open}
        onClose={() => setDeployDialog({ open: false, data: null })}
        onDeploy={payload => deployMutation.mutate(payload)}
        device={deployDialog.data}
        releases={versionMatrixQuery.data?.availableReleases || []}
        isPending={deployMutation.isPending}
      />
    </div>
  )
}
