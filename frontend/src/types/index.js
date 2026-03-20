/**
 * @fileoverview Central exports for all types
 * Single point of truth for type imports
 */

// Re-export all entity types
export * from './entities.js'
export * from './auth.js'

// Re-export TypeScript API types
export * from './api'
export * from './graphql'
export * from './roles'

// Common UI types
/**
 * @typedef {'idle' | 'loading' | 'success' | 'error'} LoadingState
 */

/**
 * @typedef {Object} ApiError
 * @property {string} message
 * @property {string} [code]
 * @property {any} [details]
 */

/**
 * @typedef {Object} PaginationInfo
 * @property {number} page
 * @property {number} pageSize
 * @property {number} total
 * @property {number} totalPages
 */

/**
 * @typedef {Object} SortInfo
 * @property {string} field
 * @property {'asc' | 'desc'} direction
 */

/**
 * @typedef {Object} TableConfig
 * @property {Array<{key: string, label: string, sortable?: boolean}>} columns
 * @property {PaginationInfo} pagination
 * @property {SortInfo} [sort]
 * @property {boolean} [loading]
 */

/**
 * @typedef {Object} CrudOperation
 * @property {'create' | 'read' | 'update' | 'delete'} type
 * @property {any} data
 * @property {Function} onSuccess
 * @property {Function} onError
 */

export {}
