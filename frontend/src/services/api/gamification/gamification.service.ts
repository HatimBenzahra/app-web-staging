/**
 * @fileoverview Gamification API Service
 */

import { gql } from '../../core/graphql'
import {
  GET_RANKING,
  GET_COMMERCIAL_RANKINGS,
  GET_OFFRES,
  GET_BADGE_DEFINITIONS,
  GET_COMMERCIAL_BADGES,
  GET_MANAGER_BADGES,
  GET_WINLEADPLUS_USERS,
  GET_MAPPING_SUGGESTIONS,
  GET_CONTRATS_BY_COMMERCIAL,
  GET_CONTRATS_BY_MANAGER,
  GET_OFFRE_DISTRIBUTION,
} from './gamification.queries'
import {
  SYNC_OFFRES,
  SYNC_CONTRATS,
  CONFIRM_MAPPING,
  REMOVE_MAPPING,
  UPDATE_OFFRE_POINTS,
  UPDATE_OFFRE_BADGE_PRODUCT_KEY,
  SEED_BADGES,
  COMPUTE_RANKING,
  EVALUATE_BADGES,
  EVALUATE_TROPHEES,
} from './gamification.mutations'
import type {
  RankSnapshot,
  Offre,
  BadgeDefinition,
  CommercialBadge,
  WinleadPlusUser,
  MappingSuggestion,
  ContratValide,
  MutationResult,
  SyncResult,
  SyncContratsResult,
  SeedResult,
  EvaluateResult,
  QueryRankingResponse,
  QueryCommercialRankingsResponse,
  QueryOffresResponse,
  QueryBadgeDefinitionsResponse,
  QueryCommercialBadgesResponse,
  QueryManagerBadgesResponse,
  QueryWinleadPlusUsersResponse,
  QueryMappingSuggestionsResponse,
  QueryContratsByCommercialResponse,
  QueryContratsByManagerResponse,
  MutationSyncOffresResponse,
  MutationSyncContratsResponse,
  MutationConfirmMappingResponse,
  MutationRemoveMappingResponse,
  MutationUpdateOffrePointsResponse,
  MutationUpdateOffreBadgeProductKeyResponse,
  MutationSeedBadgesResponse,
  MutationComputeRankingResponse,
  MutationEvaluateBadgesResponse,
  MutationEvaluateTropheesResponse,
} from './gamification.types'

export const gamificationApi = {
  // --- Ranking ---
  async getRanking(period: string, periodKey: string, includeContratFinie?: boolean): Promise<RankSnapshot[]> {
    const response = await gql<QueryRankingResponse>(GET_RANKING, { period, periodKey, includeContratFinie })
    return response.ranking
  },

  async getCommercialRankings(commercialId: number): Promise<RankSnapshot[]> {
    const response = await gql<QueryCommercialRankingsResponse>(GET_COMMERCIAL_RANKINGS, { commercialId })
    return response.commercialRankings
  },

  async computeRanking(period: string, periodKey: string): Promise<MutationResult> {
    const response = await gql<MutationComputeRankingResponse>(COMPUTE_RANKING, { input: { period, periodKey } })
    return response.computeRanking
  },

  // --- Offres ---
  async getOffres(activeOnly?: boolean): Promise<Offre[]> {
    const response = await gql<QueryOffresResponse>(GET_OFFRES, { activeOnly })
    return response.offres
  },

  async syncOffres(): Promise<SyncResult> {
    const response = await gql<MutationSyncOffresResponse>(SYNC_OFFRES)
    return response.syncOffres
  },

  async updateOffrePoints(offreId: number, points: number): Promise<Offre> {
    const response = await gql<MutationUpdateOffrePointsResponse>(UPDATE_OFFRE_POINTS, { offreId, points })
    return response.updateOffrePoints
  },

  async updateOffreBadgeProductKey(offreId: number, badgeProductKey?: string): Promise<Offre> {
    const response = await gql<MutationUpdateOffreBadgeProductKeyResponse>(UPDATE_OFFRE_BADGE_PRODUCT_KEY, {
      offreId,
      badgeProductKey,
    })
    return response.updateOffreBadgeProductKey
  },

  // --- Badges ---
  async getBadgeDefinitions(category?: string, activeOnly?: boolean): Promise<BadgeDefinition[]> {
    const response = await gql<QueryBadgeDefinitionsResponse>(GET_BADGE_DEFINITIONS, { category, activeOnly })
    return response.badgeDefinitions
  },

  async getCommercialBadges(commercialId: number): Promise<CommercialBadge[]> {
    const response = await gql<QueryCommercialBadgesResponse>(GET_COMMERCIAL_BADGES, { commercialId })
    return response.commercialBadges
  },

  async getManagerBadges(managerId: number): Promise<CommercialBadge[]> {
    const response = await gql<QueryManagerBadgesResponse>(GET_MANAGER_BADGES, { managerId })
    return response.managerBadges
  },

  async seedBadges(): Promise<SeedResult> {
    const response = await gql<MutationSeedBadgesResponse>(SEED_BADGES)
    return response.seedBadges
  },

  async evaluateBadges(): Promise<EvaluateResult> {
    const response = await gql<MutationEvaluateBadgesResponse>(EVALUATE_BADGES)
    return response.evaluateBadges
  },

  async evaluateTrophees(quarter: string): Promise<EvaluateResult> {
    const response = await gql<MutationEvaluateTropheesResponse>(EVALUATE_TROPHEES, { quarter })
    return response.evaluateTrophees
  },

  // --- Mapping ---
  async getWinleadPlusUsers(): Promise<WinleadPlusUser[]> {
    const response = await gql<QueryWinleadPlusUsersResponse>(GET_WINLEADPLUS_USERS)
    return response.winleadPlusUsers
  },

  async getMappingSuggestions(): Promise<MappingSuggestion[]> {
    const response = await gql<QueryMappingSuggestionsResponse>(GET_MAPPING_SUGGESTIONS)
    return response.mappingSuggestions
  },

  async confirmMapping(
    mappings: Array<{ prowinId: number; winleadPlusId: string; type: string }>
  ): Promise<MutationResult> {
    const response = await gql<MutationConfirmMappingResponse>(CONFIRM_MAPPING, { input: { mappings } })
    return response.confirmMapping
  },

  async removeMapping(prowinId: number, type: string): Promise<MutationResult> {
    const response = await gql<MutationRemoveMappingResponse>(REMOVE_MAPPING, { input: { prowinId, type } })
    return response.removeMapping
  },

  // --- Contrats ---
  async syncContrats(): Promise<SyncContratsResult> {
    const response = await gql<MutationSyncContratsResponse>(SYNC_CONTRATS)
    return response.syncContrats
  },

  async getContratsByCommercial(commercialId: number): Promise<ContratValide[]> {
    const response = await gql<QueryContratsByCommercialResponse>(GET_CONTRATS_BY_COMMERCIAL, { commercialId })
    return response.contratsByCommercial
  },

  async getContratsByManager(managerId: number): Promise<ContratValide[]> {
    const response = await gql<QueryContratsByManagerResponse>(GET_CONTRATS_BY_MANAGER, { managerId })
    return response.contratsByManager
  },

  async getOffreDistribution(periodMonth: string): Promise<Array<{ offreId: number; nom: string; categorie: string; fournisseur: string; logoUrl?: string; count: number }>> {
    const response = await gql<{ offreDistribution: Array<{ offreId: number; nom: string; categorie: string; fournisseur: string; logoUrl?: string; count: number }> }>(GET_OFFRE_DISTRIBUTION, { periodMonth })
    return response.offreDistribution
  },
}
