/**
 * @fileoverview Authentication service for Keycloak SSO integration
 * Handles login, logout, token management and role extraction
 */

import { graphqlClient } from '../core/graphql'
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

// =============================================================================
// Auth Service Class
// =============================================================================

export class AuthService {
  /**
   * Connexion avec Keycloak via GraphQL
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const data = await graphqlClient.request<{ login: AuthResponse }>(LOGIN_MUTATION, {
        loginInput: credentials,
      })

      const authResponse = data.login

      // Vérifier que l'utilisateur a un groupe autorisé
      const hasAuthorizedGroup = authResponse.groups.some(group => ALLOWED_GROUPS.includes(group))

      if (!hasAuthorizedGroup) {
        throw new Error('UNAUTHORIZED_GROUP')
      }

      // Stocker les tokens et le rôle dans le localStorage
      this.storeAuthData(authResponse)

      // Configurer le token dans le client GraphQL pour les futures requêtes
      graphqlClient.setAuthToken(authResponse.access_token)

      return authResponse
    } catch (error: any) {
      // Si c'est une erreur de groupe non autorisé du backend
      if (
        error.message?.includes('UNAUTHORIZED_GROUP') ||
        error.graphQLErrors?.[0]?.message?.includes('UNAUTHORIZED_GROUP')
      ) {
        throw new Error('UNAUTHORIZED_GROUP')
      }

      // Sinon, propager l'erreur
      throw error
    }
  }

  /**
   * Rafraîchit le token d'accès
   */
  async refreshToken(): Promise<AuthResponse | null> {
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) return null

    this._isRefreshing = true
    try {
      const data = await graphqlClient.request<{ refreshToken: AuthResponse }>(
        REFRESH_TOKEN_MUTATION,
        { refreshToken }
      )

      const authResponse = data.refreshToken
      this.storeAuthData(authResponse)
      graphqlClient.setAuthToken(authResponse.access_token)
      return authResponse
    } catch (error) {
      console.error('Refresh token failed:', error)
      return null
    } finally {
      this._isRefreshing = false
    }
  }

  /**
   * Déconnexion : nettoie les données d'authentification
   */
  logout(): void {
    this.clearAuthData()
    graphqlClient.clearAuthToken()
  }

  /**
   * Vérifie si l'utilisateur est authentifié
   */
  isAuthenticated(): boolean {
    const token = this.getAccessToken()
    if (!token) return false

    // Vérifier si le token est expiré
    try {
      const payload = decodeToken(token)
      const now = Date.now() / 1000
      return payload.exp > now
    } catch {
      return false
    }
  }

  /**
   * Vérifie si la session est récupérable : soit le token est valide,
   * soit un refresh token existe et le refresh réussit.
   * Contrairement à isAuthenticated() (synchrone), cette méthode async
   * tente un refresh si l'access token est expiré.
   */
  async ensureAuthenticated(): Promise<boolean> {
    if (this.isAuthenticated()) return true

    const refreshToken = this.getRefreshToken()
    if (!refreshToken) return false

    const result = await this.refreshToken()
    return result !== null
  }

  /**
   * Vérifie si une session existe (token valide OU refresh token disponible).
   * Check synchrone et permissif — utilisé pour les redirections de route
   * afin de ne pas rediriger vers /login pendant qu'un refresh est possible.
   */
  hasSession(): boolean {
    return this.isAuthenticated() || this.getRefreshToken() !== null
  }

  /**
   * Récupère l'expiration du token (timestamp en secondes)
   */
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

  /**
   * Récupère le rôle de l'utilisateur depuis le JWT token
   */
  getUserRole(): string | null {
    const token = this.getAccessToken()
    if (!token) return null

    try {
      const payload = decodeToken(token)
      const groups = payload.groups || []

      // Mapper le groupe au rôle
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

  /**
   * Récupère les groupes de l'utilisateur depuis le JWT token
   */
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

  /**
   * Récupère l'access token
   */
  getAccessToken(): string | null {
    return localStorage.getItem('access_token')
  }

  /**
   * Récupère le refresh token
   */
  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token')
  }

  /**
   * Initialise le client GraphQL avec le token stocké
   */
  initializeAuth(): void {
    const token = this.getAccessToken()
    if (token && this.isAuthenticated()) {
      graphqlClient.setAuthToken(token)

      const exp = this.getTokenExpiration()
      if (exp) {
        const remainingSeconds = exp - Math.floor(Date.now() / 1000)
        if (remainingSeconds > 0) {
          this.scheduleTokenRefresh(remainingSeconds)
        }
      }
    } else if (this.getRefreshToken()) {
      // Access token expiré mais refresh token dispo — tenter un refresh silencieux
      // au lieu de tout wiper (cas typique : retour sur l'app après background tab)
      this.refreshToken()
        .then(result => {
          if (result) {
            graphqlClient.setAuthToken(result.access_token)
            window.dispatchEvent(new Event('auth-changed'))
          } else {
            this.clearAuthData()
          }
        })
        .catch(() => {
          this.clearAuthData()
        })
    } else {
      this.clearAuthData()
    }
  }

  private refreshTimerId: ReturnType<typeof setTimeout> | null = null
  private _isRefreshing = false

  get isRefreshing(): boolean {
    return this._isRefreshing
  }

  private storeAuthData(authResponse: AuthResponse): void {
    localStorage.setItem('access_token', authResponse.access_token)
    localStorage.setItem('refresh_token', authResponse.refresh_token)
    const expiresAt = authResponse.expires_in / 60
    localStorage.setItem('token_expires_at (minutes)', expiresAt.toString())

    // Programmer le refresh automatique a 80% de la duree de vie du token
    this.scheduleTokenRefresh(authResponse.expires_in)
  }

  /**
   * Nettoie les données d'authentification du localStorage
   */
  private clearAuthData(): void {
    this.cancelScheduledRefresh()
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('token_expires_at (minutes)')
  }

  /**
   * Extrait l'email depuis le token JWT
   */
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

  /**
   * Programme un refresh automatique du token avant son expiration.
   * Se declenche a 80% de la duree de vie (ex: 8 min si TTL = 10 min).
   */
  private scheduleTokenRefresh(expiresInSeconds: number): void {
    this.cancelScheduledRefresh()

    // Refresh at 50% of TTL for more buffer, minimum 60s before expiration
    const refreshAfterMs = Math.max(
      (expiresInSeconds * 0.5) * 1000,
      (expiresInSeconds - 60) * 1000
    )

    if (refreshAfterMs <= 0) return

    this.refreshTimerId = setTimeout(async () => {
      // Retry every 30s for up to 5 minutes before giving up
      const MAX_RETRIES = 10
      const RETRY_INTERVAL_MS = 30_000

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const result = await this.refreshToken()
        if (result) return

        if (!this.getRefreshToken()) break

        if (attempt < MAX_RETRIES - 1) {
          await new Promise<void>(r => setTimeout(r, RETRY_INTERVAL_MS))
        }
      }

      window.dispatchEvent(new Event('auth-unauthorized'))
    }, refreshAfterMs)
  }

  private cancelScheduledRefresh(): void {
    if (this.refreshTimerId !== null) {
      clearTimeout(this.refreshTimerId)
      this.refreshTimerId = null
    }
  }
}

// =============================================================================
// Default Instance
// =============================================================================

export const authService = new AuthService()

// Initialiser l'authentification au chargement
authService.initializeAuth()
