import React, { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, Upload, Check, AlertTriangle, Package, FileText, X } from 'lucide-react'

const formatFileSize = bytes => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

export default function UploadApkDialog({
  open,
  onClose,
  onUpload,
  onInspect,
  isUploading,
  isInspecting,
}) {
  const [file, setFile] = useState(null)
  const [inspectResult, setInspectResult] = useState(null)
  const [appName, setAppName] = useState('')
  const [notes, setNotes] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setFile(null)
    setInspectResult(null)
    setAppName('')
    setNotes('')
    setIsDragging(false)
  }, [open])

  const handleFileSelect = selectedFile => {
    if (!selectedFile || !selectedFile.name.endsWith('.apk')) return
    setFile(selectedFile)
    setInspectResult(null)
  }

  const handleDragOver = e => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = e => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = e => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) handleFileSelect(dropped)
  }

  const handleInspect = async () => {
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    const result = await onInspect(formData)
    setInspectResult(result)
    if (result?.metadata?.packageName && !appName) {
      setAppName(result.metadata.packageName)
    }
  }

  const handleUpload = async () => {
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('appName', appName || 'Application')
    formData.append('notes', notes || '')
    await onUpload(formData)
    onClose()
  }

  const hasInspected = !!inspectResult
  const hasError = !!inspectResult?.error
  const meta = inspectResult?.metadata

  const currentStep = !file ? 1 : !hasInspected ? 2 : !appName ? 3 : 4

  return (
    <Dialog open={open} onOpenChange={state => (!state ? onClose() : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload d&apos;un APK
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-1.5 py-1">
          {[1, 2, 3, 4].map((step, i) => (
            <React.Fragment key={step}>
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  currentStep > step
                    ? 'bg-chart-2 text-white'
                    : currentStep === step
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {currentStep > step ? <Check className="h-3 w-3" /> : step}
              </div>
              {i < 3 && (
                <div
                  className={`h-px flex-1 transition-colors ${
                    currentStep > step + 1 ? 'bg-chart-2' : 'bg-muted'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="space-y-4">
          <section
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            aria-label="Zone de dépôt de fichier APK"
            className={`relative rounded-xl border-2 border-dashed transition-all ${
              isDragging
                ? 'scale-[1.01] border-primary bg-primary/5'
                : file
                ? 'border-chart-2/50 bg-chart-2/5'
                : 'border-muted-foreground/25'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".apk"
              className="hidden"
              onChange={e => handleFileSelect(e.target.files?.[0] || null)}
            />
            {file ? (
              <div className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-chart-2/15 p-2.5 shrink-0">
                  <FileText className="h-5 w-5 text-chart-2" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setFile(null); setInspectResult(null) }}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 p-8 text-center"
              >
                <div
                  className={`rounded-xl p-3 transition-colors ${
                    isDragging ? 'bg-primary/15' : 'bg-muted'
                  }`}
                >
                  <Upload
                    className={`h-7 w-7 transition-colors ${
                      isDragging ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  />
                </div>
                <p className="text-sm font-medium">Glissez votre APK ici</p>
                <p className="text-xs text-muted-foreground">
                  ou <span className="text-primary underline underline-offset-2">parcourir</span>
                </p>
                <p className="text-xs text-muted-foreground/60">Format .apk uniquement</p>
              </button>
            )}
          </section>

          {file && !hasInspected && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleInspect}
              disabled={isInspecting}
            >
              {isInspecting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Package className="h-4 w-4" />
              )}
              {isInspecting ? 'Inspection en cours...' : 'Inspecter le fichier APK'}
            </Button>
          )}

          {hasInspected && (
            <div
              className={`space-y-3 rounded-xl border p-4 ${
                hasError
                  ? 'border-destructive/30 bg-destructive/5'
                  : 'border-chart-2/30 bg-chart-2/5'
              }`}
            >
              <div className="flex items-center gap-2">
                {hasError ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <Check className="h-4 w-4 text-chart-2" />
                )}
                <span
                  className={`text-sm font-semibold ${
                    hasError ? 'text-destructive' : 'text-chart-2'
                  }`}
                >
                  {hasError ? "Erreur d'inspection" : 'Fichier analysé avec succès'}
                </span>
              </div>
              {meta && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {meta.packageName && (
                    <>
                      <span className="text-muted-foreground">Package</span>
                      <span className="truncate font-mono text-xs font-medium">
                        {meta.packageName}
                      </span>
                    </>
                  )}
                  {meta.versionName && (
                    <>
                      <span className="text-muted-foreground">Version</span>
                      <span className="font-medium">{meta.versionName}</span>
                    </>
                  )}
                  {meta.versionCode && (
                    <>
                      <span className="text-muted-foreground">Code version</span>
                      <span className="font-medium">{meta.versionCode}</span>
                    </>
                  )}
                  {meta.sha256 && (
                    <>
                      <span className="text-muted-foreground">SHA-256</span>
                      <span className="truncate font-mono text-xs">
                        {meta.sha256.slice(0, 16)}…
                      </span>
                    </>
                  )}
                </div>
              )}
              {meta?.duplicateBinary && (
                <Alert variant="destructive" className="px-3 py-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Ce binaire est déjà présent dans le système
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {file && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="kiosk-apk-appname" className="text-sm font-medium">
                  Nom de l&apos;application
                </label>
                <Input
                  id="kiosk-apk-appname"
                  value={appName}
                  onChange={e => setAppName(e.target.value)}
                  placeholder="Ex: Kiosk Launcher"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="kiosk-apk-notes" className="text-sm font-medium">
                  Notes{' '}
                  <span className="font-normal text-muted-foreground">(optionnel)</span>
                </label>
                <textarea
                  id="kiosk-apk-notes"
                  className="w-full min-h-20 resize-y rounded-lg border bg-background p-3 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-ring"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Détails de la release, changements..."
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            className="flex-1 gap-2 sm:flex-initial"
            onClick={handleUpload}
            disabled={!file || isUploading}
          >
            {isUploading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isUploading ? 'Upload en cours...' : 'Uploader'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
