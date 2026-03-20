/**
 * @fileoverview Authentication types and constants
 * Contains all type definitions and role mappings for the auth service
 */

export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type?: string
  scope?: string
  groups: string[]
  role: string
  userId: number
  email?: string
}

export interface TokenPayload {
  sub: string
  email?: string
  name?: string
  groups: string[]
  exp: number
  iat: number
}

// Mapping des groupes Keycloak vers les rôles de l'application
export const GROUP_TO_ROLE_MAP: Record<string, string> = {
  'Prospection-Admin': 'admin',
  'Prospection-Directeur': 'directeur',
  'Prospection-Manager': 'manager',
  'Prospection-Commercial': 'commercial',
}

// Groupes autorisés
export const ALLOWED_GROUPS = [
  'Prospection-Admin',
  'Prospection-Directeur',
  'Prospection-Manager',
  'Prospection-Commercial',
]
