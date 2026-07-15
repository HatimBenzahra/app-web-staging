import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import {
  Lock,
  RefreshCw,
  Download,
  Power,
  Trash2,
  SlidersHorizontal,
  Terminal,
  Loader2,
} from 'lucide-react'

const COMMANDS = [
  {
    id: 'lock',
    label: "Verrouiller l'écran",
    description: "Verrouiller l'écran de la tablette",
    icon: Lock,
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/8 hover:bg-destructive/15 border-destructive/20',
    activeBgClass: 'bg-destructive/12 border-destructive/50 ring-2 ring-destructive/30',
  },
  {
    id: 'ota_check',
    label: 'Vérifier MAJ',
    description: 'Chercher les mises à jour OTA disponibles',
    icon: RefreshCw,
    colorClass: 'text-primary',
    bgClass: 'bg-primary/8 hover:bg-primary/15 border-primary/20',
    activeBgClass: 'bg-primary/12 border-primary/50 ring-2 ring-primary/30',
  },
  {
    id: 'ota_update',
    label: 'Lancer MAJ',
    description: 'Forcer le téléchargement et la mise à jour OTA',
    icon: Download,
    colorClass: 'text-chart-2',
    bgClass: 'bg-chart-2/8 hover:bg-chart-2/15 border-chart-2/20',
    activeBgClass: 'bg-chart-2/12 border-chart-2/50 ring-2 ring-chart-2/30',
  },
  {
    id: 'reboot',
    label: 'Redémarrer',
    description: 'Redémarrer la tablette',
    icon: Power,
    colorClass: 'text-chart-5',
    bgClass: 'bg-chart-5/8 hover:bg-chart-5/15 border-chart-5/20',
    activeBgClass: 'bg-chart-5/12 border-chart-5/50 ring-2 ring-chart-5/30',
  },
  {
    id: 'uninstall',
    label: 'Désinstaller',
    description: 'Désinstaller une application par son package',
    icon: Trash2,
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/8 hover:bg-destructive/15 border-destructive/20',
    activeBgClass: 'bg-destructive/12 border-destructive/50 ring-2 ring-destructive/30',
  },
  {
    id: 'set_setting',
    label: 'Réglage système',
    description: 'Modifier un réglage Android (global / secure)',
    icon: SlidersHorizontal,
    colorClass: 'text-purple-500',
    bgClass: 'bg-purple-500/8 hover:bg-purple-500/15 border-purple-500/20',
    activeBgClass: 'bg-purple-500/12 border-purple-500/50 ring-2 ring-purple-500/30',
  },
  {
    id: 'run_command',
    label: 'Commande',
    description: "Exécuter une commande au niveau de l'app",
    icon: Terminal,
    colorClass: 'text-blue-500',
    bgClass: 'bg-blue-500/8 hover:bg-blue-500/15 border-blue-500/20',
    activeBgClass: 'bg-blue-500/12 border-blue-500/50 ring-2 ring-blue-500/30',
  },
]

const INITIAL_FORM = {
  packageName: '',
  scope: 'global',
  settingKey: '',
  settingValue: '',
  command: '',
}

export default function DeviceCommandDialog({ open, onClose, onSend, device, isPending }) {
  const [action, setAction] = useState('ota_check')
  const [form, setForm] = useState(INITIAL_FORM)

  useEffect(() => {
    if (!open) return
    setAction('ota_check')
    setForm(INITIAL_FORM)
  }, [open])

  const updateForm = patch => setForm(current => ({ ...current, ...patch }))

  const buildPayload = () => {
    switch (action) {
      case 'uninstall':
        return { packageName: form.packageName.trim() }
      case 'set_setting':
        return {
          scope: form.scope,
          key: form.settingKey.trim(),
          value: form.settingValue,
        }
      case 'run_command':
        return { command: form.command.trim() }
      default:
        return undefined
    }
  }

  const canSend = (() => {
    if (!device || !action) return false
    if (action === 'uninstall') return form.packageName.trim().length > 0
    if (action === 'set_setting') return form.settingKey.trim().length > 0
    if (action === 'run_command') return form.command.trim().length > 0
    return true
  })()

  const handleSend = async () => {
    if (!device || !canSend) return
    await onSend({ deviceId: device.deviceId, action, payload: buildPayload() })
    onClose()
  }

  const selectedCommand = COMMANDS.find(c => c.id === action)

  return (
    <Dialog open={open} onOpenChange={state => (!state ? onClose() : null)}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/40">
          <DialogTitle className="text-base font-semibold">Actions avancées</DialogTitle>
          {device && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">Tablette :</span>
              <span className="text-sm font-medium">{device.deviceName || device.deviceId}</span>
              <Badge
                variant="outline"
                className={
                  device.online
                    ? 'text-xs bg-chart-2/10 text-chart-2 border-chart-2/25 ml-1'
                    : 'text-xs bg-muted text-muted-foreground ml-1'
                }
              >
                <span
                  className={`mr-1 inline-flex h-1.5 w-1.5 rounded-full ${
                    device.online ? 'bg-chart-2' : 'bg-muted-foreground/50'
                  }`}
                />
                {device.online ? 'En ligne' : 'Hors ligne'}
              </Badge>
            </div>
          )}
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Choisir une action
            </p>
            <div className="grid grid-cols-2 gap-2">
              {COMMANDS.map(cmd => {
                const Icon = cmd.icon
                const isSelected = action === cmd.id
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => setAction(cmd.id)}
                    className={`relative flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-all duration-150 cursor-pointer ${
                      isSelected ? cmd.activeBgClass : `${cmd.bgClass} border`
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        isSelected ? 'bg-background/80' : 'bg-background/50'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${cmd.colorClass}`} />
                    </div>
                    <div className="space-y-0.5">
                      <p className={`text-xs font-semibold leading-tight ${cmd.colorClass}`}>
                        {cmd.label}
                      </p>
                      <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                        {cmd.description}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {action === 'uninstall' && (
            <div className="space-y-2 animate-fade-in-content">
              <Separator />
              <div className="space-y-1.5">
                <label
                  htmlFor="kiosk-command-package"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Package
                </label>
                <Input
                  id="kiosk-command-package"
                  value={form.packageName}
                  onChange={event => updateForm({ packageName: event.target.value })}
                  placeholder="com.exemple.app"
                  className="font-mono text-sm"
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {action === 'set_setting' && (
            <div className="space-y-3 animate-fade-in-content">
              <Separator />
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Portée
                </label>
                <Select value={form.scope} onValueChange={value => updateForm({ scope: value })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Portée" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">global</SelectItem>
                    <SelectItem value="secure">secure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="kiosk-command-setting-key"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Clé
                </label>
                <Input
                  id="kiosk-command-setting-key"
                  value={form.settingKey}
                  onChange={event => updateForm({ settingKey: event.target.value })}
                  placeholder="screen_brightness"
                  className="font-mono text-sm"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="kiosk-command-setting-value"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Valeur
                </label>
                <Input
                  id="kiosk-command-setting-value"
                  value={form.settingValue}
                  onChange={event => updateForm({ settingValue: event.target.value })}
                  placeholder="255"
                  className="font-mono text-sm"
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {action === 'run_command' && (
            <div className="space-y-2 animate-fade-in-content">
              <Separator />
              <div className="space-y-1.5">
                <label
                  htmlFor="kiosk-command-run"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Commande
                </label>
                <Textarea
                  id="kiosk-command-run"
                  value={form.command}
                  onChange={event => updateForm({ command: event.target.value })}
                  placeholder="Entrer la commande à exécuter"
                  className="font-mono text-sm min-h-24"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  La commande s&apos;exécute aujourd&apos;hui avec les privilèges de
                  l&apos;application (pas en root). Le résultat est remonté par la tablette (logs{' '}
                  <code className="font-mono">command_result</code> /{' '}
                  <code className="font-mono">command_failed</code>).
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 pb-5 pt-0 flex items-center gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
            Annuler
          </Button>
          <Button
            onClick={handleSend}
            disabled={isPending || !canSend}
            className="flex-1 sm:flex-none sm:min-w-40"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                {selectedCommand && <selectedCommand.icon className="h-4 w-4" />}
                Envoyer : {selectedCommand?.label || '—'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
