/**
 * Contexte global pour la gestion des rôles et des données filtrées
 * Intégré avec Keycloak SSO
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ROLES } from '../hooks/metier/permissions/roleFilters'
import { RoleContext } from './userole'
import { authService } from '../services/auth'
import { api } from '../services/api'
import { clearAllAppStorage } from '../services/core'
import LoadingScreen from '../components/LoadingScreen'
import { useAppLoading } from './AppLoadingContext'
import { setUser as setSentryUser } from '../config/sentry'

export const RoleProvider = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAppReady } = useAppLoading()

  // État de chargement initial
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [hasCompletedInitialLoading, setHasCompletedInitialLoading] = useState(false)

  // userId sera chargé depuis l'API via api.auth.getMe()
  const [currentRole, setCurrentRole] = useState(() => authService.getUserRole())
  const [currentUserId, setCurrentUserId] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(() => authService.isAuthenticated())

  // Envoyer les infos utilisateur à Sentry au montage initial (si authentifié)
  useEffect(() => {
    if (currentUserId && currentRole && authService.isAuthenticated()) {
      setSentryUser({
        id: currentUserId.toString(),
        role: currentRole,
      })
    }
  }, [currentUserId, currentRole])

  useEffect(() => {
    if (!isInitialLoading && !hasCompletedInitialLoading) {
      setHasCompletedInitialLoading(true)
    }
  }, [isInitialLoading, hasCompletedInitialLoading])

  useEffect(() => {
    const publicRoutes = ['/login', '/unauthorized']
    const isPublicRoute = publicRoutes.some(route => location.pathname.startsWith(route))

    if (!isPublicRoute && !authService.hasSession()) {
      navigate('/login', { replace: true })
      setIsInitialLoading(false)
    } else if (isPublicRoute) {
      setIsInitialLoading(false)
    } else if (isAppReady) {
      setIsInitialLoading(false)
    } else {
      const maxTimer = setTimeout(() => {
        setIsInitialLoading(false)
      }, 3000)

      return () => clearTimeout(maxTimer)
    }
  }, [navigate, location, isAppReady])

  useEffect(() => {
    let authChangeTimers = []

    const handleAuthChange = () => {
      const newRole = authService.getUserRole()

      setCurrentRole(newRole)
      // userId sera rechargé via api.auth.getMe() dans le useEffect séparé
      // Ne pas essayer de le récupérer depuis le JWT car il n'y est pas

      // Recharger les infos utilisateur depuis l'API
      if (authService.isAuthenticated()) {
        setIsAuthenticated(true)
        api.auth
          .getMe()
          .then(userInfo => {
            setCurrentUserId(userInfo.id)
            setSentryUser({
              id: userInfo.id.toString(),
              role: userInfo.role,
            })
          })
          .catch(error => {
            console.error('Erreur récupération user info lors du changement:', error)
          })
      } else {
        setCurrentUserId(null)
        setSentryUser(null)
        setIsAuthenticated(false)
      }

      for (const timer of authChangeTimers) {
        clearTimeout(timer)
      }
      authChangeTimers = []

      setIsInitialLoading(true)

      const readyTimer = setTimeout(() => {
        setIsInitialLoading(false)
      }, 300)
      authChangeTimers.push(readyTimer)
    }

    // Écouter les changements de storage (entre onglets)
    window.addEventListener('storage', handleAuthChange)

    // Custom event pour les changements dans le même onglet
    window.addEventListener('auth-changed', handleAuthChange)

    return () => {
      window.removeEventListener('storage', handleAuthChange)
      window.removeEventListener('auth-changed', handleAuthChange)
      for (const timer of authChangeTimers) {
        clearTimeout(timer)
      }
    }
  }, [])

  const logout = useCallback(() => {
    // Nettoyer les tokens et données d'authentification
    authService.logout()

    clearAllAppStorage()

    // Réinitialiser les états locaux
    setCurrentRole(null)
    setCurrentUserId(null)
    setIsAuthenticated(false)

    // Retirer l'utilisateur de Sentry
    setSentryUser(null)

    // Rediriger vers la page de connexion
    navigate('/login', { replace: true })
  }, [navigate])

  const value = useMemo(
    () => ({
      currentRole,
      currentUserId,

      logout,
      isAuthenticated,
      isAdmin: currentRole === ROLES.ADMIN,
      isDirecteur: currentRole === ROLES.DIRECTEUR,
      isManager: currentRole === ROLES.MANAGER,
      isCommercial: currentRole === ROLES.COMMERCIAL,
    }),
    [currentRole, currentUserId, logout, isAuthenticated]
  )

  useEffect(() => {
    const checkAuthStatus = async () => {
      if (authService.isRefreshing) return

      const currentlyAuthenticated = authService.isAuthenticated()
      if (currentlyAuthenticated !== isAuthenticated) {
        if (!currentlyAuthenticated) {
          const recovered = await authService.ensureAuthenticated()
          if (recovered) return
          setIsAuthenticated(false)
          setCurrentRole(null)
          setCurrentUserId(null)
          setSentryUser(null)
        } else {
          setIsAuthenticated(true)
        }
      }
    }

    const handleUnauthorized = () => {
      if (authService.isRefreshing) return

      authService.logout()
      setIsAuthenticated(false)
      setCurrentRole(null)
      setCurrentUserId(null)
      setSentryUser(null)
    }

    checkAuthStatus()

    const interval = setInterval(checkAuthStatus, 30_000)

    window.addEventListener('auth-unauthorized', handleUnauthorized)

    return () => {
      clearInterval(interval)
      window.removeEventListener('auth-unauthorized', handleUnauthorized)
    }
  }, [isAuthenticated])

  // Charger les infos utilisateur depuis l'API au démarrage
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (authService.isAuthenticated()) {
        setIsAuthenticated(true)
        try {
          const userInfo = await api.auth.getMe()
          setCurrentUserId(userInfo.id)
          setCurrentRole(userInfo.role)

          // Mettre à jour Sentry
          setSentryUser({
            id: userInfo.id.toString(),
            role: userInfo.role,
          })
        } catch (error) {
          console.error('Erreur récupération user info:', error)
          const recovered = await authService.ensureAuthenticated()
          if (recovered) {
            try {
              const retryInfo = await api.auth.getMe()
              setCurrentUserId(retryInfo.id)
              setCurrentRole(retryInfo.role)
              setSentryUser({ id: retryInfo.id.toString(), role: retryInfo.role })
              return
            } catch {
              // noop — refresh OK mais getMe échoue encore
            }
          }
          logout()
        }
      } else {
        setIsAuthenticated(false)
      }
    }

    fetchUserInfo()
  }, [logout])

  return (
    <RoleContext.Provider value={value}>
      {children}
      {/* LoadingScreen par-dessus tout pendant le chargement initial */}
      {!hasCompletedInitialLoading && isInitialLoading && authService.isAuthenticated() && (
        <LoadingScreen />
      )}
    </RoleContext.Provider>
  )
}
