/**
 * @fileoverview Statistic related GraphQL mutations
 */

export const CREATE_STATISTIC = `
  mutation CreateStatistic($createStatisticInput: CreateStatisticInput!) {
    createStatistic(createStatisticInput: $createStatisticInput) {
      id
      commercialId
      contratsSignes
      immeublesVisites
      rendezVousPris
      refus
      createdAt
      updatedAt
    }
  }
`

export const UPDATE_STATISTIC = `
  mutation UpdateStatistic($updateStatisticInput: UpdateStatisticInput!) {
    updateStatistic(updateStatisticInput: $updateStatisticInput) {
      id
      commercialId
      contratsSignes
      immeublesVisites
      rendezVousPris
      refus
      createdAt
      updatedAt
    }
  }
`

export const REMOVE_STATISTIC = `
  mutation RemoveStatistic($id: Int!) {
    removeStatistic(id: $id) {
      id
      commercialId
      contratsSignes
      immeublesVisites
      rendezVousPris
      refus
      createdAt
      updatedAt
    }
  }
`

export const RECALCULATE_ALL_STATS = `
  mutation RecalculateAllStats {
    recalculateAllStats
  }
`

export const VALIDATE_STATS_COHERENCE = `
  query ValidateStatsCoherence {
    validateStatsCoherence
  }
`
