import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Lock, Unlock, RefreshCw, KeyRound, Loader2 } from 'lucide-react'

const COMMANDS = [
  {
    id: 'lock',
    label: 'Verrouiller',
    description: 'Passer le kiosk en mode verrouillé',
    icon: Lock,
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/8 hover:bg-destructive/15 border-destructive/20',
    activeBgClass: 'bg-destructive/12 border-destructive/50 ring-2 ring-destructive/30',
  },
  {
    id: 'unlock',
    label: 'Déverrouiller',
    description: 'Restaurer le mode libre du kiosk',
    icon: Unlock,
    colorClass: 'text-chart-2',
    bgClass: 'bg-chart-2/8 hover:bg-chart-2/15 border-chart-2/20',
    activeBgClass: 'bg-chart-2/12 border-chart-2/50 ring-2 ring-chart-2/30',
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
    id: 'set_pin',
    label: 'Définir PIN',
    description: 'Changer le code PIN de déverrouillage',
    icon: KeyRound,
    colorClass: 'text-purple-500',
    bgClass: 'bg-purple-500/8 hover:bg-purple-500/15 border-purple-500/20',
    activeBgClass: 'bg-purple-500/12 border-purple-500/50 ring-2 ring-purple-500/30',
  },
]

export default function DeviceCommandDialog({ open, onClose, onSend, device, isPending }) {
  const [action, setAction] = useState('ota_check')
  const [pin, setPin] = useState('')

  useEffect(() => {
    if (!open) return
    setAction('ota_check')
    setPin('')
  }, [open])

  const handleSend = async () => {
    if (!device) return
    const payload = action === 'set_pin' ? { pin } : undefined
    await onSend({ deviceId: device.deviceId, action, payload })
    onClose()
  }

  const selectedCommand = COMMANDS.find(c => c.id === action)
  const canSend = device && action && (action !== 'set_pin' || pin.length > 0)

  return (
    <Dialog open={open} onOpenChange={state => (!state ? onClose() : null)}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/40">
          <DialogTitle className="text-base font-semibold">Envoyer une commande</DialogTitle>
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

        <div className="px-6 py-5 space-y-5">
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

          {action === 'set_pin' && (
            <div className="space-y-2 animate-fade-in-content">
              <Separator />
              <div className="space-y-1.5">
                <label
                  htmlFor="kiosk-command-pin"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Code PIN
                </label>
                <Input
                  id="kiosk-command-pin"
                  value={pin}
                  onChange={event => setPin(event.target.value)}
                  type="password"
                  placeholder="Entrer le nouveau PIN"
                  className="font-mono tracking-widest text-base"
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">
                  Ce code sera utilisé pour déverrouiller le kiosk.
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
