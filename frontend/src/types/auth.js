/**
 * @fileoverview Authentication and authorization types
 * Role-based access control definitions
 */

/**
 * @typedef {'admin' | 'directeur' | 'manager'} UserRole
 */

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} nom
 * @property {string} prenom
 * @property {string} email
 * @property {UserRole} role
 * @property {number} [managerId] - For managers (assigned directeur)
 * @property {number} [directeurId] - For managers (assigned directeur)
 */

/**
 * @typedef {Object} AuthState
 * @property {User | null} user
 * @property {boolean} isAuthenticated
 * @property {boolean} loading
 * @property {string | null} error
 */

/**
 * @typedef {Object} RolePermissions
 * @property {boolean} canCreate
 * @property {boolean} canUpdate
 * @property {boolean} canDelete
 * @property {boolean} canViewAll
 * @property {Array<string>} allowedEntities
 */

/**
 * @typedef {Object} DataFilter
 * @property {UserRole} role
 * @property {number} userId
 * @property {number} [managerId]
 * @property {number} [directeurId]
 */

export {}
