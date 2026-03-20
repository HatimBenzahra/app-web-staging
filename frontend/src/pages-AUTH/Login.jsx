import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail, Loader2, Eye, EyeOff } from 'lucide-react'
import ThemeToggle from '@/components/ThemeSwitchDarklight'
import logoSvg from '@/assets/logo.svg'

import { authService } from '@/services/auth'
import { useToast } from '@/components/ui/toast'
import { logger as Logger } from '@/services/core'
import { Input } from '@/components/ui/input'
import { useKeyboard } from '@/hooks/ui/keyboard'
export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { toast } = useToast()
  const isKeyboardOpen = useKeyboard()

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Appel au service d'authentification
      const authResponse = await authService.login({ username, password })

      Logger.debug('✅ Connexion réussie:', authResponse)

      // Notifier le contexte du changement d'authentification
      window.dispatchEvent(new Event('auth-changed'))

      // Redirection selon le rôle
      setTimeout(() => {
        navigate('/')
      }, 500)
    } catch (err) {
      Logger.debug('❌ Erreur de connexion:', err)

      // Vérifier si c'est une erreur de groupe non autorisé
      if (err.message === 'UNAUTHORIZED_GROUP') {
        navigate('/unauthorized')
        return
      }

      // Extraire le message d'erreur
      let errorMessage = 'Identifiants invalides'

      if (err.graphQLErrors && err.graphQLErrors.length > 0) {
        errorMessage = err.graphQLErrors[0].message
      } else if (err.message) {
        errorMessage = err.message
      }

      setError(errorMessage)
      toast({
        title: 'Erreur de connexion',
        description: errorMessage,
        variant: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className={`min-h-dvh bg-gradient-to-br from-orange-50/40 via-background to-red-50/30 dark:from-orange-950/20 dark:via-background dark:to-red-950/15 flex justify-center
      ${isKeyboardOpen ? 'items-start pt-6' : 'items-center'}
      px-4 sm:px-6 lg:px-8 overflow-y-auto transition-all duration-150
    `}
    >
      {/* Boutons de thème en haut à droite */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-xl" style={{ animation: 'loginFadeIn 0.5s ease-out forwards' }}>
        <style>{`
          @keyframes loginFadeIn {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* Logo et titre */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src={logoSvg}
              alt="Pro-Win"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl shadow-[0_0_30px_rgba(249,115,22,0.15)]"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Pro-Win</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Module prospection</p>
        </div>

        {/* Formulaire de connexion */}
        <div className="bg-card/80 backdrop-blur-sm rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08),0_0_0_1px_rgba(249,115,22,0.05)] p-5 sm:p-8 border border-border/50">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Message d'erreur */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm sm:text-base">
                {error}
              </div>
            )}

            {/* Champ Email/Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm sm:text-base font-medium text-foreground mb-2"
              >
                Email ou nom d'utilisateur
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  disabled={isLoading}
                  required
                  className="pl-10 py-5 text-base sm:text-lg focus-visible:ring-orange-400/50"
                  placeholder="Email ou nom d'utilisateur"
                />
              </div>
            </div>

            {/* Champ Mot de passe */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label
                  htmlFor="password"
                  className="block text-sm sm:text-base font-medium text-foreground"
                >
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="text-muted-foreground hover:text-foreground transition-colors focus:outline-none flex items-center gap-1 text-sm sm:text-base font-medium"
                >
                  {showPassword ? (
                    <>
                      <EyeOff className="h-5 w-5" />
                      Masquer
                    </>
                  ) : (
                    <>
                      <Eye className="h-5 w-5" />
                      Afficher
                    </>
                  )}
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  className="pl-10 py-5 text-base sm:text-lg focus-visible:ring-orange-400/50"
                  placeholder="********"
                />
              </div>
            </div>

            {/* Bouton de connexion */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white py-3 px-4 rounded-lg text-base sm:text-lg font-medium focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
        </div>

        {/* Copyright */}
        <p className="text-center text-muted-foreground/60 text-sm mt-6">© 2026 Pro-Win</p>
      </div>
    </div>
  )
}
