/**
 * @fileoverview Centralized error handling for GraphQL operations
 * Provides typed error classes and error categorization
 */

// =============================================================================
// Error Types Enum
// =============================================================================

export enum ErrorType {
  NETWORK = 'NETWORK_ERROR',
  GRAPHQL = 'GRAPHQL_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND_ERROR',
  SERVER = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR',
}

// =============================================================================
// Custom Error Class
// =============================================================================

export class GraphQLClientError extends Error {
  constructor(
    message: string,
    public type: ErrorType,
    public statusCode?: number,
    public originalError?: unknown,
    public graphQLErrors?: any[]
  ) {
    super(message)
    this.name = 'GraphQLClientError'

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GraphQLClientError)
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.type) {
      case ErrorType.NETWORK:
        return 'Problème de connexion au serveur. Vérifiez votre connexion internet.'
      case ErrorType.AUTHENTICATION:
        return 'Authentification requise. Veuillez vous reconnecter.'
      case ErrorType.AUTHORIZATION:
        return "Vous n'avez pas les permissions nécessaires pour cette action."
      case ErrorType.NOT_FOUND:
        return 'Ressource non trouvée.'
      case ErrorType.VALIDATION:
        return 'Données invalides. Vérifiez vos entrées.'
      case ErrorType.GRAPHQL:
        return this.message || 'Une erreur GraphQL est survenue.'
      case ErrorType.SERVER:
        return 'Erreur serveur. Veuillez réessayer plus tard.'
      default:
        return 'Une erreur inattendue est survenue.'
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return [ErrorType.NETWORK, ErrorType.SERVER].includes(this.type)
  }
}

// =============================================================================
// Centralized Error Handler
// =============================================================================

export class ErrorHandler {
  /**
   * Categorize and create appropriate error from HTTP response
   */
  handleHttpError(status: number, statusText: string): GraphQLClientError {
    let errorType: ErrorType
    let message: string

    switch (Math.floor(status / 100)) {
      case 4:
        if (status === 401) {
          errorType = ErrorType.AUTHENTICATION
          message = 'Non authentifié'
        } else if (status === 403) {
          errorType = ErrorType.AUTHORIZATION
          message = 'Accès refusé'
        } else if (status === 404) {
          errorType = ErrorType.NOT_FOUND
          message = 'Ressource non trouvée'
        } else if (status === 400 || status === 422) {
          errorType = ErrorType.VALIDATION
          message = 'Données invalides'
        } else {
          errorType = ErrorType.UNKNOWN
          message = 'Erreur client'
        }
        break
      case 5:
        errorType = ErrorType.SERVER
        message = 'Erreur serveur'
        break
      default:
        errorType = ErrorType.UNKNOWN
        message = 'Erreur HTTP'
    }

    return new GraphQLClientError(`${message}: ${status} ${statusText}`, errorType, status)
  }

  /**
   * Handle GraphQL-specific errors from response
   */
  handleGraphQLErrors(errors: any[]): GraphQLClientError {
    const firstError = errors[0]
    const message = firstError.message || 'Erreur GraphQL'

    // Check for specific error patterns
    let errorType = ErrorType.GRAPHQL

    if (
      message.toLowerCase().includes('unauthorized') ||
      message.toLowerCase().includes('not authenticated')
    ) {
      errorType = ErrorType.AUTHENTICATION
    } else if (
      message.toLowerCase().includes('forbidden') ||
      message.toLowerCase().includes('not authorized')
    ) {
      errorType = ErrorType.AUTHORIZATION
    } else if (message.toLowerCase().includes('not found')) {
      errorType = ErrorType.NOT_FOUND
    } else if (message.toLowerCase().includes('validation')) {
      errorType = ErrorType.VALIDATION
    }

    return new GraphQLClientError(message, errorType, undefined, undefined, errors)
  }

  /**
   * Handle network/fetch errors
   */
  handleNetworkError(error: unknown): GraphQLClientError {
    const message = error instanceof Error ? error.message : 'Erreur réseau'

    return new GraphQLClientError(
      `Erreur de connexion: ${message}`,
      ErrorType.NETWORK,
      undefined,
      error
    )
  }

  /**
   * Handle unknown errors
   */
  handleUnknownError(error: unknown): GraphQLClientError {
    // If it's already a GraphQLClientError, return it
    if (error instanceof GraphQLClientError) {
      return error
    }

    const message = error instanceof Error ? error.message : 'Erreur inconnue'

    return new GraphQLClientError(message, ErrorType.UNKNOWN, undefined, error)
  }

  /**
   * Main error processing method
   */
  process(error: unknown): GraphQLClientError {
    // Already processed error
    if (error instanceof GraphQLClientError) {
      return error
    }

    // Generic error fallback
    return this.handleUnknownError(error)
  }
}

// =============================================================================
// Default Error Handler Instance
// =============================================================================

export const errorHandler = new ErrorHandler()

// =============================================================================
// Error Utility Functions
// =============================================================================

/**
 * Type guard for GraphQLClientError
 */
export function isGraphQLClientError(error: unknown): error is GraphQLClientError {
  return error instanceof GraphQLClientError
}

/**
 * Get user-friendly error message from any error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof GraphQLClientError) {
    return error.getUserMessage()
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Une erreur est survenue'
}

// =============================================================================
// Logger Configuration
// =============================================================================

enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

class Logger {
  private level: LogLevel

  constructor() {
    // En production : WARN, en développement : DEBUG
    this.level = import.meta.env.PROD ? LogLevel.WARN : LogLevel.DEBUG
  }

  private formatMessage(level: string, namespace: string, args: any[]) {
    const timestamp = new Date().toISOString().slice(11, 23) // HH:mm:ss.SSS
    return [`[${timestamp}] ${namespace} ${level}:`, ...args]
  }

  error(namespace: string, ...args: any[]) {
    if (this.level >= LogLevel.ERROR) {
      console.error(...this.formatMessage('ERROR', namespace, args))
    }
  }

  warn(namespace: string, ...args: any[]) {
    if (this.level >= LogLevel.WARN) {
      console.warn(...this.formatMessage('WARN', namespace, args))
    }
  }

  info(namespace: string, ...args: any[]) {
    if (this.level >= LogLevel.INFO) {
      console.info(...this.formatMessage('INFO', namespace, args))
    }
  }

  debug(namespace: string, ...args: any[]) {
    if (this.level >= LogLevel.DEBUG) {
      console.log(...this.formatMessage('DEBUG', namespace, args))
    }
  }
}

export const logger = new Logger()

/**
 * Log error with detailed information (for debugging)
 */
export function logError(error: unknown, context?: string): void {
  const namespace = context || 'GraphQL Client'

  if (error instanceof GraphQLClientError) {
    logger.error(namespace, `${error.type}:`, {
      message: error.message,
      userMessage: error.getUserMessage(),
      statusCode: error.statusCode,
      isRetryable: error.isRetryable(),
      graphQLErrors: error.graphQLErrors,
      originalError: error.originalError,
    })
  } else {
    logger.error(namespace, 'Error:', error)
  }
}
