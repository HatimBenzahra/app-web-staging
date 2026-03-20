import React, { useState, useEffect } from 'react'
import { AlertCircle, Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Composant qui vérifie et demande la permission microphone
 * Bloque l'accès à l'espace tant que le micro n'est pas autorisé
 */
export default function MicrophoneGuard({ children, onMicrophoneReady }) {
  const [microphoneStatus, setMicrophoneStatus] = useState('checking') // 'checking' | 'granted' | 'denied' | 'error'
  const [errorMessage, setErrorMessage] = useState('')
  const [isRetrying, setIsRetrying] = useState(false)

  const checkMicrophonePermission = async () => {
    try {
      setIsRetrying(true)
      setErrorMessage('')

      // Vérifier d'abord si le navigateur supporte l'API
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicrophoneStatus('error')
        setErrorMessage("Votre navigateur ne supporte pas l'accès au microphone.")
        setIsRetrying(false)
        return
      }

      console.log('🎤 Demande de permission microphone...')

      // Demander l'accès au microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      console.log('✅ Permission microphone accordée')
      console.log('🎤 Microphone détecté:', stream.getAudioTracks()[0]?.label)

      // Arrêter le stream de test (on le redemandera plus tard)
      stream.getTracks().forEach(track => track.stop())

      setMicrophoneStatus('granted')

      // Notifier le parent que le micro est prêt
      if (onMicrophoneReady) {
        onMicrophoneReady()
      }
    } catch (error) {
      console.error('❌ Erreur permission microphone:', error)

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setMicrophoneStatus('denied')
        setErrorMessage('Vous devez autoriser l\'accès au microphone pour utiliser cette application.')
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setMicrophoneStatus('error')
        setErrorMessage('Aucun microphone détecté sur votre appareil.')
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setMicrophoneStatus('error')
        setErrorMessage('Le microphone est déjà utilisé par une autre application.')
      } else {
        setMicrophoneStatus('error')
        setErrorMessage(`Erreur : ${error.message || 'Impossible d\'accéder au microphone.'}`)
      }
    } finally {
      setIsRetrying(false)
    }
  }

  // Vérifier au montage
  useEffect(() => {
    checkMicrophonePermission()
  }, [])

  // Si le microphone est autorisé, afficher le contenu
  if (microphoneStatus === 'granted') {
    return <>{children}</>
  }

  // Sinon, afficher l'écran de demande de permission
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            {microphoneStatus === 'checking' ? (
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            ) : microphoneStatus === 'denied' || microphoneStatus === 'error' ? (
              <AlertCircle className="h-8 w-8 text-destructive" />
            ) : (
              <Mic className="h-8 w-8 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {microphoneStatus === 'checking' && 'Vérification '}
            {microphoneStatus === 'denied' && 'Permission requise'}
            {microphoneStatus === 'error' && 'Problème détecté'}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {microphoneStatus === 'checking' && 'Veuillez patienter pendant que nous vérifions votre microphone.'}
            {microphoneStatus === 'denied' && 'L\'accès au microphone est obligatoire pour utiliser l\'application.'}
            {microphoneStatus === 'error' && 'Un problème empêche l\'accès au microphone.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-medium mb-1">⚠️ Erreur</p>
              <p>{errorMessage}</p>
            </div>
          )}

          {(microphoneStatus === 'denied' || microphoneStatus === 'error') && (
            <>
              <div className="rounded-lg bg-muted p-4 text-sm">
                <p className="font-medium mb-2">📋 Instructions :</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Cliquez sur le bouton "Autoriser le microphone"</li>
                  <li>Dans la popup du navigateur, cliquez sur "Autoriser"</li>
                  <li>Si vous avez déjà refusé, vous devez modifier les paramètres du navigateur</li>
                </ol>
              </div>

              <Button
                onClick={checkMicrophonePermission}
                disabled={isRetrying}
                className="w-full"
                size="lg"
              >
                {isRetrying ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Vérification...
                  </>
                ) : (
                  <>
                    <Mic className="mr-2 h-4 w-4" />
                    Autoriser le microphone
                  </>
                )}
              </Button>

              <div className="text-xs text-center text-muted-foreground pt-2">
                <p className="mb-1">💡 Astuce : Si le problème persiste :</p>
                <ul className="text-left space-y-1">
                  <li>• Fermez les autres applications utilisant le microphone</li>
                  <li>• Vérifiez les paramètres de votre navigateur</li>
                  <li>• Redémarrez l'application</li>
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
