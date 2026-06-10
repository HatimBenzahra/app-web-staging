import { describe, expect, it } from 'vitest'
import { ErrorHandler, ErrorType } from './errors'

describe('ErrorHandler.handleGraphQLErrors', () => {
  const handler = new ErrorHandler()

  it.each([
    'invalid_grant',
    'Session not active',
    'Token is not active',
    'Token refresh failed',
    'Refresh token expired',
    'Unauthorized',
    'Not authenticated',
  ])('classifies Keycloak auth failure "%s" as authentication', message => {
    const error = handler.handleGraphQLErrors([{ message }])

    expect(error.type).toBe(ErrorType.AUTHENTICATION)
    expect(error.isRetryable()).toBe(false)
    expect(error.getUserMessage()).not.toContain(message)
    expect(error.getUserMessage()).toBe('Authentification requise. Veuillez vous reconnecter.')
  })

  it.each(['Forbidden', 'Not authorized'])(
    'classifies authorization failure "%s" as authorization',
    message => {
      const error = handler.handleGraphQLErrors([{ message }])

      expect(error.type).toBe(ErrorType.AUTHORIZATION)
      expect(error.isRetryable()).toBe(false)
    }
  )

  it('does not classify unrelated GraphQL errors as authentication failures', () => {
    const error = handler.handleGraphQLErrors([{ message: 'Validation failed' }])

    expect(error.type).toBe(ErrorType.VALIDATION)
  })

  it('keeps HTTP network/server retry semantics separate from GraphQL auth failures', () => {
    const serverError = handler.handleHttpError(500, 'Internal Server Error')
    const authError = handler.handleHttpError(401, 'Unauthorized')

    expect(serverError.type).toBe(ErrorType.SERVER)
    expect(serverError.isRetryable()).toBe(true)
    expect(authError.type).toBe(ErrorType.AUTHENTICATION)
    expect(authError.isRetryable()).toBe(false)
  })
})
