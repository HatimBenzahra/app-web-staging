import { Link } from 'react-router-dom'
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react'

export default function ErrorFallback({ error }) {
  const handleRefresh = () => {
    window.location.reload()
  }

  const handleGoBack = () => {
    window.history.back()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl text-center">
        {/* Icône d'erreur */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-12 h-12 text-destructive" />
          </div>
        </div>

        {/* Contenu principal */}
        <div className="bg-card rounded-2xl shadow-xl p-8 border border-border">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Oups ! Une erreur est survenue
          </h1>

          <p className="text-muted-foreground mb-2">Une erreur inattendue s'est produite</p>

          <p className="text-sm text-muted-foreground mb-8">
            Quelque chose s'est mal passé lors du chargement de cette page.
            <br />
            Nous nous excusons pour le désagrément.
          </p>

          {/* Message d'erreur technique (visible en prod pour faciliter le debug) */}
          {error && (
            <div className="bg-muted p-4 rounded-lg border border-border mb-6 text-left">
              <p className="text-sm font-semibold text-foreground mb-2">
                Détails techniques :
              </p>
              <p className="text-xs font-mono text-muted-foreground break-all">
                {error.toString()}
              </p>
              {error.stack && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    Voir la stack trace
                  </summary>
                  <pre className="text-xs mt-2 overflow-auto max-h-48 text-muted-foreground">
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {/* Bouton principal - Actualiser */}
            <button
              onClick={handleRefresh}
              className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition shadow-lg"
            >
              <RefreshCw className="inline-block w-4 h-4 mr-2" />
              Actualiser la page
            </button>

            {/* Boutons secondaires */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleGoBack}
                className="w-full bg-secondary text-secondary-foreground py-2.5 px-4 rounded-lg font-medium hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring transition"
              >
                <ArrowLeft className="inline-block w-4 h-4 mr-2" />
                Page précédente
              </button>

              <Link
                to="/"
                className="w-full bg-secondary text-secondary-foreground py-2.5 px-4 rounded-lg font-medium hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring transition inline-flex items-center justify-center"
              >
                <Home className="inline-block w-4 h-4 mr-2" />
                Tableau de bord
              </Link>
            </div>

            {/* Conseils */}
            <div className="bg-muted/50 p-4 rounded-lg border border-border mt-6">
              <p className="text-sm text-muted-foreground text-left">
                💡 <strong>Conseil :</strong> Si le problème persiste :
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 text-left ml-6 list-disc">
                <li>Videz le cache de votre navigateur</li>
                <li>Vérifiez votre connexion internet</li>
                <li>
                  Contactez le support technique :{' '}
                  <a
                    href="mailto:h.benzahra@gmail.com"
                    className="font-medium text-primary hover:underline"
                  >
                    Admin
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
