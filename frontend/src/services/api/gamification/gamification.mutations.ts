/**
 * @fileoverview Gamification related GraphQL mutations
 */

export const SYNC_OFFRES = `
  mutation SyncOffres {
    syncOffres {
      success
      message
      created
      updated
      total
    }
  }
`

export const SYNC_CONTRATS = `
  mutation SyncContrats {
    syncContrats {
      success
      message
      created
      updated
      skipped
      total
    }
  }
`

export const CONFIRM_MAPPING = `
  mutation ConfirmMapping($input: ConfirmMappingInput!) {
    confirmMapping(input: $input) {
      success
      message
      mapped
      skipped
    }
  }
`

export const REMOVE_MAPPING = `
  mutation RemoveMapping($input: RemoveMappingInput!) {
    removeMapping(input: $input) {
      success
      message
      mapped
      skipped
    }
  }
`

export const UPDATE_OFFRE_POINTS = `
  mutation UpdateOffrePoints($offreId: Int!, $points: Int!) {
    updateOffrePoints(offreId: $offreId, points: $points) {
      id
      nom
      points
    }
  }
`

export const UPDATE_OFFRE_BADGE_PRODUCT_KEY = `
  mutation UpdateOffreBadgeProductKey($offreId: Int!, $badgeProductKey: String) {
    updateOffreBadgeProductKey(offreId: $offreId, badgeProductKey: $badgeProductKey) {
      id
      nom
      badgeProductKey
    }
  }
`

export const SEED_BADGES = `
  mutation SeedBadges {
    seedBadges {
      success
      message
      created
      skipped
      total
    }
  }
`

export const COMPUTE_RANKING = `
  mutation ComputeRanking($input: ComputeRankingInput!) {
    computeRanking(input: $input) {
      success
      message
      mapped
      skipped
    }
  }
`

export const EVALUATE_BADGES = `
  mutation EvaluateBadges {
    evaluateBadges {
      success
      message
      awarded
      skipped
      total
    }
  }
`

export const EVALUATE_TROPHEES = `
  mutation EvaluateTrophees($quarter: String!) {
    evaluateTrophees(quarter: $quarter) {
      success
      message
      awarded
      skipped
      total
    }
  }
`
