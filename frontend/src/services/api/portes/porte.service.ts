/**
 * @fileoverview Porte API Service
 */

import { gql } from '../../core/graphql'
import {
  GET_PORTES,
  GET_PORTE,
  GET_PORTES_BY_IMMEUBLE,
  GET_PORTES_MODIFIED_TODAY,
  GET_PORTE_STATISTICS,
  GET_PORTES_RDV_TODAY,
  GET_STATUS_HISTORIQUE_BY_PORTE,
  GET_STATUS_HISTORIQUE_BY_IMMEUBLE,
  GET_RECORDING_SEGMENTS_BY_PORTE,
  GET_RECORDING_SEGMENTS_BY_IMMEUBLE,
} from './porte.queries'
import {
  CREATE_PORTE,
  UPDATE_PORTE,
  REMOVE_PORTE,
} from './porte.mutations'
import type {
  Porte,
  QueryPortesResponse,
  QueryPorteResponse,
  QueryPortesByImmeubleResponse,
  QueryPortesModifiedTodayResponse,
  QueryPortesRdvTodayResponse,
  CreatePorteVariables,
  MutationCreatePorteResponse,
  UpdatePorteVariables,
  MutationUpdatePorteResponse,
  MutationRemovePorteResponse,
  GetEntityByIdVariables,
  GetPortesByImmeubleVariables,
  GetPortesModifiedTodayVariables,
} from './porte.types'

export const porteApi = {
  async getAll(): Promise<Porte[]> {
    const response = await gql<QueryPortesResponse>(GET_PORTES)
    return response.portes
  },

  async getById(id: number): Promise<Porte> {
    const response = await gql<QueryPorteResponse, GetEntityByIdVariables>(GET_PORTE, { id })
    return response.porte
  },

  async getByImmeuble(immeubleId: number, skip = 0, take = 20, etage?: number): Promise<Porte[]> {
    const response = await gql<QueryPortesByImmeubleResponse, any>(
      GET_PORTES_BY_IMMEUBLE,
      { immeubleId, skip, take, etage }
    )
    return response.portesByImmeuble
  },

  async create(input: CreatePorteVariables['createPorteInput']): Promise<Porte> {
    const response = await gql<MutationCreatePorteResponse, CreatePorteVariables>(CREATE_PORTE, {
      createPorteInput: input,
    })
    return response.createPorte
  },

  async update(input: UpdatePorteVariables['updatePorteInput']): Promise<Porte> {
    const response = await gql<MutationUpdatePorteResponse, UpdatePorteVariables>(UPDATE_PORTE, {
      updatePorteInput: input,
    })
    return response.updatePorte
  },

  async remove(id: number): Promise<Porte> {
    const response = await gql<MutationRemovePorteResponse, GetEntityByIdVariables>(REMOVE_PORTE, {
      id,
    })
    return response.removePorte
  },

  async getModifiedToday(immeubleId?: number): Promise<Porte[]> {
    const response = await gql<QueryPortesModifiedTodayResponse, GetPortesModifiedTodayVariables>(
      GET_PORTES_MODIFIED_TODAY,
      { immeubleId }
    )
    return response.portesModifiedToday
  },

  async getRdvToday(): Promise<Porte[]> {
    const response = await gql<QueryPortesRdvTodayResponse>(GET_PORTES_RDV_TODAY)
    return response.portesRdvToday
  },

  async getStatistics(immeubleId: number): Promise<any> {
    const response = await gql<any, { immeubleId: number }>(GET_PORTE_STATISTICS, { immeubleId })
    return response.porteStatistics
  },

  async getStatusHistorique(porteId: number): Promise<any[]> {
    const response = await gql<any, { porteId: number }>(GET_STATUS_HISTORIQUE_BY_PORTE, { porteId })
    return response.statusHistoriqueByPorte
  },

  async getStatusHistoriqueByImmeuble(immeubleId: number): Promise<any[]> {
    const response = await gql<any, { immeubleId: number }>(GET_STATUS_HISTORIQUE_BY_IMMEUBLE, { immeubleId })
    return response.statusHistoriqueByImmeuble
  },

  async getRecordingSegments(porteId: number): Promise<any[]> {
    const response = await gql<any, { porteId: number }>(GET_RECORDING_SEGMENTS_BY_PORTE, { porteId })
    return response.recordingSegmentsByPorte
  },

  async getRecordingSegmentsByImmeuble(immeubleId: number): Promise<any[]> {
    const response = await gql<any, { immeubleId: number }>(GET_RECORDING_SEGMENTS_BY_IMMEUBLE, { immeubleId })
    return response.recordingSegmentsByImmeuble
  },
}
