/**
 * @fileoverview Hooks for Workspace Profiles
 */

import { useCallback } from 'react'
import { api } from '../../../services/api'
import { ROLES } from '../permissions/roleFilters'
import {
  useApiCall,
  UseApiState,
  UseApiActions,
} from './core'
import type { Commercial, Manager } from '../../../types/api'

type WorkspaceProfile = Commercial | Manager

//la fonction qu'on utilise pour charger les donnees des deux espaces (commercial et manager)
export function useWorkspaceProfile(
  id: number,
  role: string,
  includeTeam: boolean = false
): UseApiState<WorkspaceProfile> & UseApiActions {
  const fetchProfile = useCallback(() => {
    // Vérifier si id est valide (pas null, pas NaN, > 0)
    if (!id || Number.isNaN(id) || id <= 0) {
      return Promise.resolve(null as any)
    }
    if (role === ROLES.MANAGER) {
      // Si on est sur la page équipe, charger les données complètes avec les commerciaux
      if (includeTeam) {
        return api.managers.getFullById(id)
      }
      // Sinon, charger uniquement les données personnelles
      return api.managers.getPersonalById(id)
    }
    return api.commercials.getFullById(id)
  }, [id, role, includeTeam])

  return useApiCall(
    () => fetchProfile() as Promise<WorkspaceProfile>,
    [id, role, includeTeam],
    `workspace-${role}-${includeTeam ? 'full' : 'personal'}`
  )
}
