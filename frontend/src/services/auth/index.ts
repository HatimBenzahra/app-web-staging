/**
 * @fileoverview Auth module exports
 * Central export point for all auth-related functionality
 */

export { AuthService, authService } from './auth.service'
export { decodeToken } from './token.utils'
export type { LoginCredentials, AuthResponse, TokenPayload } from './auth.types'
export { GROUP_TO_ROLE_MAP, ALLOWED_GROUPS } from './auth.types'
