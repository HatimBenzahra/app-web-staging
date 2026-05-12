/**
 * @fileoverview Authentication service for Keycloak SSO integration
 * Handles login, logout, token management and session state notifications.
 */

import { graphqlClient } from '../core/graphql'
import { clearAllAppStorage } from '../core/cache'
import { LoginCredentials, AuthResponse, ALLOWED_GROUPS, GROUP_TO_ROLE_MAP } from './auth.types'
import { decodeToken } from './token.utils'

// =============================================================================
// GraphQL Mutations
// =============================================================================

const LOGIN_MUTATION = `
  mutation Login($loginInput: LoginInput!) {
    login(loginInput: $loginInput) {
      access_token
      refresh_token
      expires_in
      token_type
      scope
      groups
      role
      userId
      email
    }
  }
`

const REFRESH_TOKEN_MUTATION = `
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      access_token
      refresh_token
      expires_in
      token_type
      scope
      groups
      role
      userId
      email
    }
  }
`

export type SessionStatus = 'unknown' | 'anonymous' | 'authenticated' | 'refreshing' | 'degraded'

export interface SessionSnapshot {
  status: SessionStatus
  isAuthenticated: boolean
  hasSession: boolean
  isRefreshing: boolean
  role: string | null
}

type SessionListener = (snapshot: SessionSnapshot) => void

// =============================================================================
// Auth Service Class
// =============================================================================

export class AuthService {
  private refreshTimerId: ReturnType<typeof setTimeout> | null = null
  private refreshRetryCount = 0
  private authGeneration = 0
  private _isRefreshing = false
  private _refreshPromise: Promise<AuthResponse | null> | null = null
  private sessionStatus: SessionStatus = 'unknown'
  private listeners = new Set<SessionListener>()

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', event => {
        if (!event.key || this.isAuthStorageKey(event.key)) {
          this.syncGraphQLAuthHeader()
          this.notifySessionChanged()
        }
      })
    }
  }

  get isRefreshing(): boolean {
    return this._isRefreshing
  }

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener)
    listener(this.getSessionSnapshot())
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSessionSnapshot(): SessionSnapshot {
    const isAuthenticated = this.isAuthenticated()
    const hasSession = isAuthenticated || this.getRefreshToken() !== null
    const status = this.resolveSessionStatus(isAuthenticated, hasSession)

    return {
      status,
      isAuthenticated,
      hasSession,
      isRefreshing: this._isRefreshing,
      role: this.getUserRole(),
    }
  }

  /**
   * Connexion avec Keycloak via GraphQL.
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      this.resetAuthStateForLogin()

      const data = await graphqlClient.request<{ login: AuthResponse }>(
        LOGIN_MUTATION,
        { loginInput: credentials },
        undefined,
        true
      )

      const authResponse = data.login
      const hasAuthorizedGroup = authResponse.groups.some(group => ALLOWED_GROUPS.includes(group))

      if (!hasAuthorizedGroup) {
        throw new Error('UNAUTHORIZED_GROUP')
      }

      this.applyAuthenticatedSession(authResponse)
      return authResponse
    } catch (error: any) {
      if (
        error.message?.includes('UNAUTHORIZED_GROUP') ||
        error.graphQLErrors?.[0]?.message?.includes('UNAUTHORIZED_GROUP')
      ) {
        throw new Error('UNAUTHORIZED_GROUP')
      }

      throw error
    }
  }

  /**
   * Rafraîchit le token d'accès avec promise coalescing.
   */
  async refreshToken(): Promise<AuthResponse | null> {
    if (this._refreshPromise) return this._refreshPromise

    this._refreshPromise = this._doRefresh()
    const currentRefreshPromise = this._refreshPromise
    try {
      return await currentRefreshPromise
    } finally {
      if (this._refreshPromise === currentRefreshPromise) {
        this._refreshPromise = null
      }
    }
  }

  /**
   * Point d'entrée unique pour les clients API après un 401/auth error.
   * Ne déconnecte jamais automatiquement: il tente de récupérer la session,
   * puis laisse l'état central en degraded si la récupération échoue.
   */
  async handleAuthenticationChallenge(): Promise<boolean> {
    if (!this.hasSession()) return false
    return this.ensureAuthenticated()
  }

  /**
   * Déconnexion manuelle: nettoie tokens, header GraphQL et caches applicatifs.
   */
  logout(): void {
    this.clearAuthData({ notify: false })
    graphqlClient.clearAuthToken()
    clearAllAppStorage()
    this.setSessionStatus('anonymous')
  }

  isAuthenticated(): boolean {
    const token = this.getAccessToken()
    if (!token) return false

    try {
      const payload = decodeToken(token)
      const now = Date.now() / 1000
      return payload.exp > now
    } catch {
      return false
    }
  }

  async ensureAuthenticated(): Promise<boolean> {
    if (this.isAuthenticated()) {
      this.setSessionStatus('authenticated')
      return true
    }

    const refreshToken = this.getRefreshToken()
    if (!refreshToken) {
      this.setSessionStatus('anonymous')
      return false
    }

    const result = await this.refreshToken()
    return result !== null
  }

  hasSession(): boolean {
    return this.isAuthenticated() || this.getRefreshToken() !== null
  }

  getTokenExpiration(): number | null {
    const token = this.getAccessToken()
    if (!token) return null
    try {
      const payload = decodeToken(token)
      return payload.exp
    } catch {
      return null
    }
  }

  getUserRole(): string | null {
    const token = this.getAccessToken()
    if (!token) return null

    try {
      const payload = decodeToken(token)
      const groups = payload.groups || []

      for (const group of groups) {
        if (GROUP_TO_ROLE_MAP[group]) {
          return GROUP_TO_ROLE_MAP[group]
        }
      }
      return null
    } catch {
      return null
    }
  }

  getUserGroups(): string[] {
    const token = this.getAccessToken()
    if (!token) return []

    try {
      const payload = decodeToken(token)
      return payload.groups || []
    } catch {
      return []
    }
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token')
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token')
  }

  getAuthorizationHeaders(): Record<string, string> {
    const token = this.getAccessToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  initializeAuth(): void {
    const token = this.getAccessToken()
    if (token && this.isAuthenticated()) {
      this.syncGraphQLAuthHeader()

      const exp = this.getTokenExpiration()
      if (exp) {
        const remainingSeconds = exp - Math.floor(Date.now() / 1000)
        if (remainingSeconds > 0) {
          this.scheduleTokenRefresh(remainingSeconds)
        }
      }

      this.setSessionStatus('authenticated')
      return
    }

    if (this.getRefreshToken()) {
      this.setSessionStatus('refreshing')
      this.refreshToken()
        .then(result => {
          if (!result) {
            this.setSessionStatus('degraded')
            this.scheduleRefreshRetry()
          }
        })
        .catch(() => {
          this.setSessionStatus('degraded')
          this.scheduleRefreshRetry()
        })
      return
    }

    this.clearAuthData({ notify: false })
    graphqlClient.clearAuthToken()
    this.setSessionStatus('anonymous')
  }

  getUserEmail(): string | null {
    const token = this.getAccessToken()
    if (!token) return null

    try {
      const payload = decodeToken(token)
      return payload.email || null
    } catch {
      return null
    }
  }

  private async _doRefresh(): Promise<AuthResponse | null> {
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) {
      this.setSessionStatus('anonymous')
      return null
    }

    const refreshGeneration = this.authGeneration
    this._isRefreshing = true
    this.setSessionStatus('refreshing')

    try {
      const data = await graphqlClient.request<{ refreshToken: AuthResponse }>(
        REFRESH_TOKEN_MUTATION,
        { refreshToken },
        undefined,
        true
      )

      if (this.authGeneration !== refreshGeneration) {
        return null
      }

      const authResponse = data.refreshToken
      this.applyAuthenticatedSession(authResponse)
      return authResponse
    } catch (error) {
      console.error('Refresh token failed:', error)
      if (this.authGeneration === refreshGeneration) {
        this.setSessionStatus('degraded')
      }
      return null
    } finally {
      if (this.authGeneration === refreshGeneration) {
        this._isRefreshing = false
        this.notifySessionChanged()
      }
    }
  }

  private applyAuthenticatedSession(authResponse: AuthResponse): void {
    this.storeAuthData(authResponse)
    graphqlClient.setAuthToken(authResponse.access_token)
    this.setSessionStatus('authenticated')
  }

  private storeAuthData(authResponse: AuthResponse): void {
    localStorage.setItem('access_token', authResponse.access_token)
    localStorage.setItem('refresh_token', authResponse.refresh_token)
    const expiresAt = authResponse.expires_in / 60
    localStorage.setItem('token_expires_at (minutes)', expiresAt.toString())

    this.refreshRetryCount = 0
    this.scheduleTokenRefresh(authResponse.expires_in)
  }

  private clearAuthData(options: { notify?: boolean } = {}): void {
    this.authGeneration += 1
    this.cancelScheduledRefresh()
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('token_expires_at (minutes)')

    if (options.notify !== false) {
      this.setSessionStatus('anonymous')
    }
  }

  private scheduleTokenRefresh(expiresInSeconds: number): void {
    this.cancelScheduledRefresh()
    const scheduledGeneration = this.authGeneration

    const halfLifeMs = expiresInSeconds * 0.5 * 1000
    const oneMinuteBeforeExpiryMs = (expiresInSeconds - 60) * 1000
    const refreshAfterMs = expiresInSeconds > 120
      ? Math.max(5_000, Math.min(halfLifeMs, oneMinuteBeforeExpiryMs))
      : Math.max(5_000, halfLifeMs)

    if (refreshAfterMs <= 0) return

    this.refreshTimerId = setTimeout(async () => {
      const result = await this.refreshToken()
      if (this.authGeneration !== scheduledGeneration) return
      if (!result) {
        this.setSessionStatus('degraded')
        this.scheduleRefreshRetry()
      } else {
        this.refreshRetryCount = 0
      }
    }, refreshAfterMs)
  }

  private scheduleRefreshRetry(): void {
    this.cancelScheduledRefresh()
    const scheduledGeneration = this.authGeneration

    const retryDelayMs = Math.min(
      60_000,
      Math.max(5_000, 5_000 * Math.pow(2, this.refreshRetryCount))
    )
    this.refreshRetryCount += 1

    this.refreshTimerId = setTimeout(async () => {
      const retryResult = await this.refreshToken()
      if (this.authGeneration !== scheduledGeneration) return
      if (!retryResult) {
        this.setSessionStatus('degraded')
        this.scheduleRefreshRetry()
        return
      }
      this.refreshRetryCount = 0
    }, retryDelayMs)
  }

  private cancelScheduledRefresh(): void {
    if (this.refreshTimerId !== null) {
      clearTimeout(this.refreshTimerId)
      this.refreshTimerId = null
    }
  }

  private resetAuthStateForLogin(): void {
    this.authGeneration += 1
    this.cancelScheduledRefresh()
    this._refreshPromise = null
    this._isRefreshing = false
    this.refreshRetryCount = 0
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('token_expires_at (minutes)')
    graphqlClient.clearAuthToken()
    this.setSessionStatus('anonymous')
  }

  private syncGraphQLAuthHeader(): void {
    const token = this.getAccessToken()
    if (token && this.isAuthenticated()) {
      graphqlClient.setAuthToken(token)
    } else {
      graphqlClient.clearAuthToken()
    }
  }

  private setSessionStatus(status: SessionStatus): void {
    this.sessionStatus = status
    this.notifySessionChanged()
  }

  private notifySessionChanged(): void {
    const snapshot = this.getSessionSnapshot()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }

  private resolveSessionStatus(isAuthenticated: boolean, hasSession: boolean): SessionStatus {
    if (this._isRefreshing) return 'refreshing'
    if (isAuthenticated) return 'authenticated'
    if (!hasSession) return 'anonymous'
    if (this.sessionStatus === 'refreshing') return 'refreshing'
    return 'degraded'
  }

  private isAuthStorageKey(key: string): boolean {
    return key === 'access_token' || key === 'refresh_token' || key === 'token_expires_at (minutes)'
  }
}

// =============================================================================
// Default Instance
// =============================================================================

export const authService = new AuthService()

authService.initializeAuth()
