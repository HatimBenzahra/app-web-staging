/**
 * @fileoverview Token utility functions
 * Contains token decoding and manipulation utilities
 */

import { TokenPayload } from './auth.types'

/**
 * Décode un JWT token (sans vérification de signature)
 * @param token - Le JWT token à décoder
 * @returns Le payload du token
 * @throws Error si le format du token est invalide
 */
export function decodeToken(token: string): TokenPayload {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (error) {
    throw new Error('Invalid token format')
  }
}
