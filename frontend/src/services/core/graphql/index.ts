/**
 * @fileoverview GraphQL module exports
 * Centralized exports for GraphQL client and error handling
 */

// Client exports
export {
  GraphQLClient,
  graphqlClient,
  gql,
  config,
  isGraphQLError,
  handleApiError,
} from './client'

// Error exports
export {
  ErrorType,
  GraphQLClientError,
  ErrorHandler,
  errorHandler,
  isGraphQLClientError,
  getErrorMessage,
  logError,
  logger,
} from './errors'
