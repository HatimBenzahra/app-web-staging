/**
 * Composant pour gérer les erreurs réseau
 * Affiche un message quand l'utilisateur est hors ligne
 */

import { useState, useEffect } from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function NetworkErrorBoundary({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      if (wasOffline) {
        // Afficher brièvement le message de reconnexion
        setTimeout(() => setWasOffline(false), 3000)
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      setWasOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [wasOffline])

  return (
    <>
      {/* Bannière de statut réseau */}
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
              Vous n'êtes pas connecté à Internet. Certaines fonctionnalités peuvent être limitées.
            </AlertDescription>
          </Alert>
        </div>
      )}

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
