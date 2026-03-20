import React, { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Rocket, Monitor, ArrowRight, Package } from 'lucide-react'

export default function DeployDialog({ open, onClose, onDeploy, device, releases, isPending }) {
  const [selectedRelease, setSelectedRelease] = useState('')

  const releaseOptions = useMemo(() => releases || [], [releases])

  useEffect(() => {
    if (!open) return
    setSelectedRelease(releaseOptions[0]?.id || '')
  }, [open, releaseOptions])

  const handleDeploy = async () => {
    if (!device?.deviceId || !selectedRelease) return
    await onDeploy({ deviceId: device.deviceId, releaseId: selectedRelease })
    onClose()
  }

  const selected = releaseOptions.find(r => r.id === selectedRelease)

  const getCurrentVersion = () => {
    if (!selected) return null
    const pkg = (selected.packageName || '').toLowerCase()
    if (pkg.includes('prowin') || pkg.includes('pro_win')) return device?.prowin?.version
    return device?.kiosk?.version
  }

  const currentVersion = getCurrentVersion()

  return (
    <Dialog open={open} onOpenChange={state => (!state ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Déployer une release
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 rounded-lg bg-primary/10 p-2">
                <Monitor className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">
                  {device?.deviceName || '—'}
                </p>
                {device?.deviceModel && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{device.deviceModel}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {device?.kiosk?.version && (
                    <Badge variant="outline" className="gap-1 font-mono text-xs">
                      <Package className="h-3 w-3" />
                      Kiosk {device.kiosk.version}
                    </Badge>
                  )}
                  {device?.prowin?.version && (
                    <Badge variant="outline" className="gap-1 font-mono text-xs">
                      <Package className="h-3 w-3" />
                      ProWin {device.prowin.version}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Release à déployer</p>
            <div className="max-h-52 space-y-2 overflow-y-auto pr-0.5">
              {releaseOptions.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Aucune release disponible
                </p>
              ) : (
                releaseOptions.map(release => {
                  const isSelected = selectedRelease === release.id
                  return (
                    <button
                      key={release.id}
                      type="button"
                      onClick={() => setSelectedRelease(release.id)}
                      className={`w-full rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary'
                          : 'hover:border-muted-foreground/30 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <div
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                              isSelected ? 'border-primary' : 'border-muted-foreground/40'
                            }`}
                          >
                            {isSelected && (
                              <span className="h-2 w-2 rounded-full bg-primary" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-tight">
                              {release.appName || '—'}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {release.packageName || ''}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {release.versionName || '—'}
                          </Badge>
                          {release.sizeHuman && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {release.sizeHuman}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {selected && currentVersion && selected.versionName && (
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="mb-2 text-xs text-muted-foreground">Aperçu du déploiement</p>
              <div className="flex items-center justify-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {currentVersion}
                </Badge>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <Badge className="border-primary/30 bg-primary/15 font-mono text-xs text-primary">
                  {selected.versionName}
                </Badge>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleDeploy}
            disabled={isPending || !selectedRelease}
            className="gap-2"
          >
            {isPending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Déploiement en cours...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4" />
                Déployer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
