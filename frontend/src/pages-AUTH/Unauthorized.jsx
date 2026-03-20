import { Link } from 'react-router-dom'
import { ShieldX, ArrowLeft } from 'lucide-react'

export default function Unauthorized() {
  const handleLogout = () => {
    // Nettoyer le localStorage
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('token_expires_at (minutes)')

    // Rediriger vers la page de login
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        {/* Icône d'erreur */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center">
            <ShieldX className="w-12 h-12 text-destructive" />
          </div>
        </div>

        {/* Contenu */}
        <div className="bg-card rounded-2xl shadow-xl p-8 border border-border">
          <h1 className="text-3xl font-bold text-foreground mb-4">Accès refusé</h1>

          <p className="text-muted-foreground mb-2">403 - Accès refusé</p>

          <p className="text-sm text-muted-foreground mb-8">
            Vous n'avez pas les permissions nécessaires pour utiliser cet espace.
          </p>

          <div className="space-y-3">
            {/* Bouton retour à la connexion */}
            <button
              onClick={handleLogout}
              className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition shadow-lg"
            >
              <ArrowLeft className="inline-block w-4 h-4 mr-2" />
              Retour à la connexion
            </button>

            {/* Lien de contact */}
            <p className="text-sm text-muted-foreground pt-4">
              Besoin d'accès ?{' '}
              <a
                href="mailto:admin@pro-win.fr"
                className="font-medium text-primary hover:underline transition"
              >
                Contactez: l'administrateur
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
