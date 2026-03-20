/**
 * @fileoverview Statistic API Service
 */

import { gql } from '../../core/graphql'
import {
  GET_STATISTICS,
  GET_STATISTIC,
  GET_ZONE_STATISTICS,
  GET_ME,
} from './statistic.queries'
import {
  CREATE_STATISTIC,
  UPDATE_STATISTIC,
  REMOVE_STATISTIC,
  RECALCULATE_ALL_STATS,
  VALIDATE_STATS_COHERENCE,
} from './statistic.mutations'
import {
  GET_CURRENT_USER_ASSIGNMENT,
} from '../zones/zone.queries' // Importing this from zones as it is used here
import type {
  Statistic,
  ZoneStatistic,
  QueryStatisticsResponse,
  QueryStatisticResponse,
  QueryZoneStatisticsResponse,
  CreateStatisticVariables,
  MutationCreateStatisticResponse,
  UpdateStatisticVariables,
  MutationUpdateStatisticResponse,
  MutationRemoveStatisticResponse,
  GetEntityByIdVariables,
} from './statistic.types'

export const statisticApi = {
  async getAll(commercialId?: number): Promise<Statistic[]> {
    const response = await gql<QueryStatisticsResponse, { commercialId?: number }>(GET_STATISTICS, {
      commercialId,
    })
    return response.statistics
  },

  async getById(id: number): Promise<Statistic> {
    const response = await gql<QueryStatisticResponse, GetEntityByIdVariables>(GET_STATISTIC, {
      id,
    })
    return response.statistic
  },

  async create(input: CreateStatisticVariables['createStatisticInput']): Promise<Statistic> {
    const response = await gql<MutationCreateStatisticResponse, CreateStatisticVariables>(
      CREATE_STATISTIC,
      { createStatisticInput: input }
    )
    return response.createStatistic
  },

  async update(input: UpdateStatisticVariables['updateStatisticInput']): Promise<Statistic> {
    const response = await gql<MutationUpdateStatisticResponse, UpdateStatisticVariables>(
      UPDATE_STATISTIC,
      { updateStatisticInput: input }
    )
    return response.updateStatistic
  },

  async remove(id: number): Promise<Statistic> {
    const response = await gql<MutationRemoveStatisticResponse, GetEntityByIdVariables>(
      REMOVE_STATISTIC,
      { id }
    )
    return response.removeStatistic
  },

  async getZoneStatistics(): Promise<ZoneStatistic[]> {
    const response = await gql<QueryZoneStatisticsResponse, {}>(GET_ZONE_STATISTICS, {})
    return response.zoneStatistics
  },

  async getCurrentUserAssignment(userId: number, userType: string): Promise<any> {
    const response = await gql<any, { userId: number; userType: string }>(
      GET_CURRENT_USER_ASSIGNMENT,
      { userId, userType }
    )
    return response.currentUserAssignment
  },

  async recalculateAllStats(): Promise<string> {
    const response = await gql<{ recalculateAllStats: string }>(RECALCULATE_ALL_STATS)
    return response.recalculateAllStats
  },

  async validateStatsCoherence(): Promise<string> {
    const response = await gql<{ validateStatsCoherence: string }>(VALIDATE_STATS_COHERENCE)
    return response.validateStatsCoherence
  },
}

export const authApi = {
  /**
   * Récupère les informations de l'utilisateur connecté depuis le JWT
   */
  async getMe() {
    const data = await gql<{ me: any }>(GET_ME)
    return data.me
  },
}
