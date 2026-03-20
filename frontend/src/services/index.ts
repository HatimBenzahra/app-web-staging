/**
 * @fileoverview Main services export file
 * Central export point for all services and utilities
 */

// =============================================================================
// API Services
// =============================================================================

export { 
  api, 
  default as default,
  directeurApi,
  managerApi,
  commercialApi,
  zoneApi,
  immeubleApi,
  statisticApi,
  porteApi, 
} from './api'

export * from './api/commercials'
export * from './api/managers'
export * from './api/directeurs'
export * from './api/zones'
export * from './api/immeubles'
export * from './api/portes'
export * from './api/statistics'


// =============================================================================
// Core Services (Auth, Audio, etc.)
// =============================================================================

export * from './core'
export * from './auth'
export * from './audio'
export * from './core/graphql'

// =============================================================================
// React Hooks
// =============================================================================

export * from '../hooks/metier/use-api'
