import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

/**
 * Composant de test pour l'ErrorBoundary
 * À utiliser uniquement en développement
 *
 * Usage : Ajoutez ce composant dans une page pour tester l'ErrorBoundary
 * <ErrorBoundaryTest />
 */
export default function ErrorBoundaryTest() {
  const [shouldThrowError, setShouldThrowError] = useState(false)

  if (shouldThrowError) {
    // Simuler une erreur de composant
    throw new Error(
      "🧪 Erreur de test : Composant intentionnellement cassé pour tester l'ErrorBoundary"
    )
  }

  // Ne rendre ce composant que en développement
  if (import.meta.env.PROD) {
    return null
  }

  return (
    <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-600">
          <AlertTriangle className="h-5 w-5" />
          Test ErrorBoundary (Dev uniquement)
        </CardTitle>
        <CardDescription className="text-orange-600/80">
          Cliquez sur le bouton ci-dessous pour simuler une erreur de composant
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => setShouldThrowError(true)} variant="destructive" size="sm">
          🧪 Déclencher une erreur
        </Button>
      </CardContent>
    </Card>
  )
}
