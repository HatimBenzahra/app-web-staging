import React, { useEffect, useState } from 'react'
import { offlineQueue } from '../services/core'
import { api } from '../services/api'
import { CACHE_INVALIDATION_MAP } from '../services/core'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

/**
 * Composant fusionné pour la gestion offline
 * Gère à la fois :
 * - L'affichage de l'état de connexion (bannière UI)
 * - La synchronisation automatique de la queue offline
 */
export function OfflineSyncProvider({ children }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    const handleOnline = async () => {
      console.log('[OfflineSync] Application back online')
      setIsOnline(true)
      setWasOffline(true)

      const queue = offlineQueue.getQueue()
      if (queue.length > 0) {
        toast({
          title: "Connexion rétablie",
          description: "Synchronisation des modifications en cours...",
          action: <RefreshCw className="h-4 w-4 animate-spin" />,
        })

        let successCount = 0
        let errorCount = 0
        const relatedEntities = new Set()

        // Process queue serially to respect order
        while (!offlineQueue.isEmpty()) {
          const action = offlineQueue.peek()
          if (!action) break

          try {
            console.log('[OfflineSync] Processing:', action)

            // Map action types to API calls
            switch (action.type) {
              case 'UPDATE_PORTE':
                // We use updatePorte from api service
                // Note: The structure in queue must match input
                await api.portes.update(action.payload)
                relatedEntities.add('portes')
                break
              default:
                console.warn('[OfflineSync] Unknown action type:', action.type)
            }

            offlineQueue.dequeue() // Remove on success
            successCount++
          } catch (error) {
            console.error('[OfflineSync] Action failed:', error)
            // If 400/500, we might want to keep it or drop it?
            // For now, we drop it to avoid blocking, but normally we'd retry logic
            // Simple logic: if network error, stop processing. If logic error, drop.
            if (!navigator.onLine) {
                 break // Stop processing if we lost connection again
            }
            errorCount++
            offlineQueue.dequeue() // Drop failed action to prevent deadlock in this MVP
          }
        }

        const namespacesToInvalidate = Array.from(relatedEntities).flatMap(
          entity => CACHE_INVALIDATION_MAP[entity] || [entity]
        )

        await Promise.all(
          namespacesToInvalidate.map(namespace =>
            queryClient.invalidateQueries({
              predicate: query =>
                Array.isArray(query.queryKey) &&
                query.queryKey[0] === 'api' &&
                query.queryKey[1] === namespace,
            })
          )
        )

        // Notify result
        if (successCount > 0) {
             toast({
              title: "Synchronisation terminée",
              description: `${successCount} modifications envoyées au serveur.`,
              variant: "success",
              duration: 3000
            })
        }
        if (errorCount > 0) {
            toast({
              title: "Erreur de synchronisation",
              description: `${errorCount} modifications n'ont pas pu être appliquées.`,
              variant: "destructive",
            })
        }
      } else {
        // Pas de queue à synchroniser, juste notifier la reconnexion
        toast({
          title: "Vous êtes en ligne",
          description: "Connexion rétablie.",
          variant: "success",
          duration: 3000,
          action: <Wifi className="h-4 w-4" />
        })
      }

      // Masquer la bannière "reconnecté" après 3 secondes
      setTimeout(() => setWasOffline(false), 3000)
    }

    const handleOffline = () => {
      console.log('[OfflineSync] Application offline')
      setIsOnline(false)
      setWasOffline(true)

      toast({
        title: "Mode hors-ligne",
        description: "Vos modifications seront sauvegardées localement.",
        variant: "warning",
        duration: 5000,
        action: <WifiOff className="h-4 w-4" />
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [queryClient, toast])

  return (
    <>
      {/* Bannière de statut réseau - Hors ligne */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[10000]">
          <Alert
            variant="destructive"
            className="rounded-none border-x-0 border-t-0 bg-red-50 dark:bg-red-950/90 backdrop-blur-sm shadow-lg"
          >
            <WifiOff className="h-4 w-4" />
            <AlertTitle className="text-red-900 dark:text-red-100 font-semibold">
              Hors ligne
            </AlertTitle>
            <AlertDescription className="text-red-800 dark:text-red-200">
              Vous n'êtes pas connecté à Internet. Vos modifications seront synchronisées automatiquement.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Bannière de statut réseau - Reconnecté */}
      {isOnline && wasOffline && (
        <div className="fixed top-0 left-0 right-0 z-[10000]">
          <Alert className="rounded-none border-x-0 border-t-0 bg-green-50 dark:bg-green-950/90 backdrop-blur-sm border-green-200 dark:border-green-800 shadow-lg">
            <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertTitle className="text-green-900 dark:text-green-100 font-semibold">
              Connexion rétablie
            </AlertTitle>
            <AlertDescription className="text-green-800 dark:text-green-200">
              Vous êtes de nouveau en ligne.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {children}
    </>
  )
}
