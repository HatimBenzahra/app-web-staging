import React, { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  useKioskReleases,
  useKioskUploadRelease,
  useKioskInspectApk,
  useKioskToggleRelease,
  useKioskDeleteRelease,
} from '@/hooks/metier/api/kiosk'
import ReleasesTab from './components/ReleasesTab'
import UploadApkDialog from './components/UploadApkDialog'
import KioskErrorState from './components/KioskErrorState'

export default function KioskReleasesPage() {
  const releasesQuery = useKioskReleases()
  const uploadReleaseMutation = useKioskUploadRelease()
  const inspectApkMutation = useKioskInspectApk()
  const toggleReleaseMutation = useKioskToggleRelease()
  const deleteReleaseMutation = useKioskDeleteRelease()

  const [uploadDialog, setUploadDialog] = useState({ open: false, data: null })

  if (releasesQuery.isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-muted-foreground">Chargement des releases...</p>
          </div>
        </div>
      </div>
    )
  }

  if (releasesQuery.error) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Releases</h1>
          <p className="text-muted-foreground mt-1">Gestion des versions APK pour les déploiements OTA</p>
        </div>
        <KioskErrorState error={releasesQuery.error} onRetry={() => releasesQuery.refetch()} />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Releases</h1>
        <p className="text-muted-foreground mt-1">Gestion des versions APK pour les déploiements OTA</p>
      </div>

      <ReleasesTab
        releases={releasesQuery.data || []}
        loading={releasesQuery.isLoading}
        onUploadClick={() => setUploadDialog({ open: true, data: null })}
        onToggle={(releaseId, active) => toggleReleaseMutation.mutate({ releaseId, active })}
        onDelete={releaseId => deleteReleaseMutation.mutate(releaseId)}
      />

      <UploadApkDialog
        open={uploadDialog.open}
        onClose={() => setUploadDialog({ open: false, data: null })}
        onUpload={formData => uploadReleaseMutation.mutateAsync(formData)}
        onInspect={formData => inspectApkMutation.mutateAsync(formData)}
        isUploading={uploadReleaseMutation.isPending}
        isInspecting={inspectApkMutation.isPending}
      />
    </div>
  )
}
