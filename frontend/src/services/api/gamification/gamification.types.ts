/**
 * @fileoverview Gamification related types
 */

export interface RankSnapshot {
  id: number
  commercialId?: number
  managerId?: number
  period: string
  periodKey: string
  rank: number
  points: number
  contratsSignes: number
  rankTierKey: string
  rankTierLabel: string
  metadata?: string
  computedAt: string
  commercialNom?: string
  commercialPrenom?: string
  managerNom?: string
  managerPrenom?: string
}

export interface Offre {
  id: number
  externalId: number
  nom: string
  description?: string
  categorie: string
  fournisseur: string
  logoUrl?: string
  prixBase?: number
  features?: string
  popular: boolean
  rating?: number
  isActive: boolean
  points: number
  badgeProductKey?: string
  syncedAt: string
  createdAt: string
  updatedAt: string
}

export interface BadgeDefinition {
  id: number
  code: string
  nom: string
  description?: string
  category: 'PROGRESSION' | 'PRODUIT' | 'PERFORMANCE' | 'TROPHEE'
  iconUrl?: string
  condition?: string
  tier: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CommercialBadge {
  id: number
  commercialId?: number
  managerId?: number
  badgeDefinitionId: number
  periodKey: string
  awardedAt: string
  metadata?: string
  badgeDefinition?: BadgeDefinition
}

export interface WinleadPlusUser {
  id: string
  nom: string
  prenom: string
  username?: string
  email?: string
  role: string
  isActive: boolean
  managerId?: string
}

export interface MappingSuggestion {
  prowinId: number
  prowinNom: string
  prowinPrenom: string
  prowinEmail?: string
  prowinType: string
  winleadPlusId?: string
  winleadPlusNom?: string
  winleadPlusPrenom?: string
  winleadPlusEmail?: string
  confidence?: number
  alreadyMapped: boolean
}

export interface ContratValide {
  id: number
  externalContratId: number
  externalProspectId: number
  commercialWinleadPlusId: string
  commercialId?: number
  managerId?: number
  offreExternalId?: number
  offreId?: number
  dateValidation: string
  dateSignature?: string
  periodDay: string
  periodWeek: string
  periodMonth: string
  periodQuarter: string
  periodYear: string
  metadata?: string
  syncedAt: string
  createdAt: string
  offreNom?: string
  offreCategorie?: string
  offreFournisseur?: string
  offreLogoUrl?: string
  offrePoints?: number
}

export interface MutationResult {
  success: boolean
  message: string
  mapped: number
  skipped: number
}

export interface SyncResult {
  success: boolean
  message: string
  created: number
  updated: number
  total: number
}

export interface SyncContratsResult {
  success: boolean
  message: string
  created: number
  updated: number
  skipped: number
  total: number
}

export interface SeedResult {
  success: boolean
  message: string
  created: number
  skipped: number
  total: number
}

export interface EvaluateResult {
  success: boolean
  message: string
  awarded: number
  skipped: number
  total: number
}

// Query response types
export interface QueryRankingResponse { ranking: RankSnapshot[] }
export interface QueryCommercialRankingsResponse { commercialRankings: RankSnapshot[] }
export interface QueryOffresResponse { offres: Offre[] }
export interface QueryBadgeDefinitionsResponse { badgeDefinitions: BadgeDefinition[] }
export interface QueryCommercialBadgesResponse { commercialBadges: CommercialBadge[] }
export interface QueryManagerBadgesResponse { managerBadges: CommercialBadge[] }
export interface QueryWinleadPlusUsersResponse { winleadPlusUsers: WinleadPlusUser[] }
export interface QueryMappingSuggestionsResponse { mappingSuggestions: MappingSuggestion[] }
export interface QueryContratsByCommercialResponse { contratsByCommercial: ContratValide[] }
export interface QueryContratsByManagerResponse { contratsByManager: ContratValide[] }

// Mutation response types
export interface MutationSyncOffresResponse { syncOffres: SyncResult }
export interface MutationSyncContratsResponse { syncContrats: SyncContratsResult }
export interface MutationConfirmMappingResponse { confirmMapping: MutationResult }
export interface MutationRemoveMappingResponse { removeMapping: MutationResult }
export interface MutationUpdateOffrePointsResponse { updateOffrePoints: Offre }
export interface MutationUpdateOffreBadgeProductKeyResponse { updateOffreBadgeProductKey: Offre }
export interface MutationSeedBadgesResponse { seedBadges: SeedResult }
export interface MutationComputeRankingResponse { computeRanking: MutationResult }
export interface MutationEvaluateBadgesResponse { evaluateBadges: EvaluateResult }
export interface MutationEvaluateTropheesResponse { evaluateTrophees: EvaluateResult }
