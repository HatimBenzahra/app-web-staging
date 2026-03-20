/**
 * @fileoverview Type definitions for role-based access control
 * Provides strict typing for roles, permissions and entity relationships
 */

import type { ROLES } from '../hooks/metier/permissions/roleFilters'

export type Role = (typeof ROLES)[keyof typeof ROLES]

export type EntityType =
  | 'commerciaux'
  | 'managers'
  | 'directeurs'
  | 'zones'
  | 'immeubles'
  | 'statistics'

export type Permission = 'view' | 'add' | 'edit' | 'delete'

export interface EntityPermissions {
  view: boolean
  add: boolean
  edit: boolean
  delete: boolean
}

export type RolePermissions = {
  [K in EntityType]: EntityPermissions
}

export interface UserRoleData {
  role: Role
  userId: number
  managerId?: number
  directeurId?: number
}

export interface FilterDependencies {
  commercials?: any[]
  managers?: any[]
  directeurs?: any[]
}

export interface EntityPageData<T = any> {
  data: T[]
  permissions: EntityPermissions
  description: string
}

export interface RoleContextValue {
  currentRole: Role
  currentUserId: string
  setUserRole: (role: Role) => void
  setUserId: (id: string) => void
  isAdmin: boolean
  isDirecteur: boolean
  isManager: boolean
  isCommercial: boolean
}
