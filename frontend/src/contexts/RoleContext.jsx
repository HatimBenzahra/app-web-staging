/**
 * Contexte global pour la gestion des rôles et des données filtrées.
 * La politique de session reste centralisée dans authService; ce contexte hydrate
 * seulement les informations utilisateur dont l'UI a besoin.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ROLES } from '../hooks/metier/permissions/roleFilters'
import { RoleContext } from './userole'
import { authService } from '../services/auth'
import { api } from '../services/api'
import LoadingScreen from '../components/LoadingScreen'
import { useAppLoading } from './AppLoadingContext'
import { setUser as setSentryUser } from '../config/sentry'

const PUBLIC_ROUTES = ['/login', '/unauthorized']

export const RoleProvider = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAppReady } = useAppLoading()
  const initialSession = authService.getSessionSnapshot()

  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [hasCompletedInitialLoading, setHasCompletedInitialLoading] = useState(false)
  const [sessionStatus, setSessionStatus] = useState(initialSession.status)
  const [currentRole, setCurrentRole] = useState(initialSession.role)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(initialSession.hasSession)

  const hydrateUserInfo = useCallback(async () => {
    if (!authService.isAuthenticated()) return

    try {
      const userInfo = await api.auth.getMe()
      setCurrentUserId(userInfo.id)
      setCurrentRole(userInfo.role)
      setSentryUser({
        id: userInfo.id.toString(),
        role: userInfo.role,
      })
    } catch (error) {
      console.error('Erreur récupération user info:', error)
      const recovered = await authService.ensureAuthenticated()
      if (!recovered) return

      try {
        const retryInfo = await api.auth.getMe()
        setCurrentUserId(retryInfo.id)
        setCurrentRole(retryInfo.role)
        setSentryUser({ id: retryInfo.id.toString(), role: retryInfo.role })
      } catch {
        // Refresh OK mais getMe échoue encore: on conserve la session en état degraded.
      }
    }
  }, [])

  useEffect(() => {
    return authService.subscribe(snapshot => {
      setSessionStatus(snapshot.status)
      setCurrentRole(snapshot.role)
      setIsAuthenticated(snapshot.hasSession)

      if (snapshot.status === 'anonymous') {
        setCurrentUserId(null)
        setSentryUser(null)
        return
      }

      if (snapshot.isAuthenticated) {
        hydrateUserInfo()
      }
    })
  }, [hydrateUserInfo])

  useEffect(() => {
    if (!isInitialLoading && !hasCompletedInitialLoading) {
      setHasCompletedInitialLoading(true)
    }
  }, [isInitialLoading, hasCompletedInitialLoading])

  useEffect(() => {
    const isPublicRoute = PUBLIC_ROUTES.some(route => location.pathname.startsWith(route))

    if (!isPublicRoute && sessionStatus === 'anonymous') {
      navigate('/login', { replace: true })
      setIsInitialLoading(false)
      return
    }

    if (isPublicRoute || isAppReady || sessionStatus === 'degraded') {
      setIsInitialLoading(false)
      return
    }

    const maxTimer = setTimeout(() => {
      setIsInitialLoading(false)
    }, 3000)

    return () => clearTimeout(maxTimer)
  }, [navigate, location, isAppReady, sessionStatus])

  const logout = useCallback(() => {
    authService.logout()
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

  return (
    <RoleContext.Provider value={value}>
      {children}
      {!hasCompletedInitialLoading && isInitialLoading && isAuthenticated && <LoadingScreen />}
    </RoleContext.Provider>
  )
}
