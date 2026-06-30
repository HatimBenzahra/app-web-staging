import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Package, Power, Trash2, Copy, Check, GitCommit } from 'lucide-react'
import { ChannelBadge } from './versionPresentation'

const formatDateTime = value => {
  if (!value) return 'Inconnu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Inconnu'
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatRelativeTime = value => {
  if (!value) return 'Inconnu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Inconnu'
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `il y a ${days}j`
  if (hours > 0) return `il y a ${hours}h`
  if (minutes > 0) return `il y a ${minutes}min`
  return "à l'instant"
}

const parseSizeMB = sizeHuman => {
  if (!sizeHuman) return 0
  const match = sizeHuman.match(/([\d.]+)\s*(MB|GB|KB)/i)
  if (!match) return 0
  const value = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  if (unit === 'GB') return value * 1024
  if (unit === 'KB') return value / 1024
  return value
}

export default function ReleasesTab({ releases, loading, onToggle, onDelete }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  const handleCopySha256 = (id, sha256) => {
    if (!sha256) return
    navigator.clipboard.writeText(sha256)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleConfirmDelete = () => {
    if (confirmDeleteId) {
      onDelete(confirmDeleteId)
      setConfirmDeleteId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardTitle>Gestion des APK</CardTitle>
            {releases?.length > 0 && (
              <Badge
                variant="secondary"
                className="rounded-full tabular-nums px-2 py-0.5 text-xs"
              >
                {releases.length}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center text-muted-foreground">
              <Package className="h-10 w-10 opacity-30 animate-pulse" />
              <p className="text-sm">Chargement des releases...</p>
            </div>
          ) : !releases?.length ? (
            <div className="py-20 flex flex-col items-center gap-4 text-center">
              <div className="rounded-full bg-muted p-5">
                <Package className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Aucune release</p>
                <p className="text-sm text-muted-foreground">
                  Les releases sont publiées via le pipeline versionné (npm run deploy)
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-semibold pl-4">Application</TableHead>
                    <TableHead className="font-semibold">Version</TableHead>
                    <TableHead className="font-semibold">Commit</TableHead>
                    <TableHead className="font-semibold">Taille</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Actif</TableHead>
                    <TableHead className="font-semibold">APK SHA-256</TableHead>
                    <TableHead className="font-semibold text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {releases.map((release, index) => {
                    const sizeMB = parseSizeMB(release.sizeHuman)
                    const isLarge = sizeMB > 100
                    const sha256Short = release.apkSha256 ? release.apkSha256.slice(0, 12) : null
                    const gitShaShort = release.gitSha ? release.gitSha.slice(0, 7) : null

                    return (
                      <TableRow
                        key={release.id}
                        className={`transition-colors hover:bg-muted/50 ${
                          index % 2 !== 0 ? 'bg-muted/20' : ''
                        }`}
                      >
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-2.5">
                            <div className="rounded-md bg-primary/10 p-1.5 shrink-0">
                              <Package className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm leading-tight">
                                {release.appName || '—'}
                              </p>
                              <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                                {release.packageName || ''}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-semibold tabular-nums">
                                {release.versionName || '—'}
                              </span>
                              <ChannelBadge channel={release.channel} />
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums pl-0.5">
                              code {release.versionCode ?? '—'}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          {gitShaShort ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded cursor-default">
                                  <GitCommit className="h-3 w-3" />
                                  {gitShaShort}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <span className="text-xs break-words max-w-xs block">
                                  {release.gitMessage || release.gitSha}
                                </span>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <span
                            className={`text-sm font-medium ${
                              isLarge ? 'text-destructive' : 'text-foreground'
                            }`}
                          >
                            {release.sizeHuman || '—'}
                          </span>
                        </TableCell>

                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm cursor-default border-b border-dashed border-muted-foreground/40 text-muted-foreground">
                                {formatRelativeTime(release.uploadedAt)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{formatDateTime(release.uploadedAt)}</TooltipContent>
                          </Tooltip>
                        </TableCell>

                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => onToggle(release.id, !release.active)}
                                className="flex items-center gap-1.5 cursor-pointer group"
                              >
                                {release.active ? (
                                  <span className="h-3.5 w-3.5 rounded-full bg-chart-2 shadow-sm shadow-chart-2/50 ring-2 ring-chart-2/20 transition-transform group-hover:scale-110" />
                                ) : (
                                  <span className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 transition-transform group-hover:scale-110" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {release.active ? 'Désactiver' : 'Activer'}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>

                        <TableCell>
                          {sha256Short ? (
                            <div className="flex items-center gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded cursor-default">
                                    {sha256Short}…
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <span className="font-mono text-xs break-all max-w-xs">
                                    {release.apkSha256}
                                  </span>
                                </TooltipContent>
                              </Tooltip>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleCopySha256(release.id, release.apkSha256)}
                              >
                                {copiedId === release.id ? (
                                  <Check className="h-3 w-3 text-chart-2" />
                                ) : (
                                  <Copy className="h-3 w-3 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="pr-4">
                          <div className="flex items-center justify-end gap-0.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => onToggle(release.id, !release.active)}
                                >
                                  <Power
                                    className={`h-4 w-4 ${
                                      release.active
                                        ? 'text-chart-2'
                                        : 'text-muted-foreground'
                                    }`}
                                  />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {release.active ? 'Désactiver' : 'Activer'}
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setConfirmDeleteId(release.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Supprimer</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!confirmDeleteId}
        onOpenChange={open => !open && setConfirmDeleteId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cette action est irréversible. La release sera définitivement supprimée.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
