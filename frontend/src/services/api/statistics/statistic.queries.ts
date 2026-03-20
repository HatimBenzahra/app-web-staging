/**
 * @fileoverview Statistic related GraphQL queries
 */

export const GET_STATISTICS = `
  query GetStatistics($commercialId: Int) {
    statistics(commercialId: $commercialId) {
      id
      commercialId
      managerId
      immeubleId
      zoneId
      contratsSignes
      immeublesVisites
      absents
      argumentes
      rendezVousPris
      refus
      nbImmeublesProspectes
      nbPortesProspectes
      createdAt
      updatedAt
    }
  }
`

export const GET_STATISTIC = `
  query GetStatistic($id: Int!) {
    statistic(id: $id) {
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

export const GET_ZONE_STATISTICS = `
  query GetZoneStatistics {
    zoneStatistics {
      zoneId
      zoneName
      totalContratsSignes
      totalImmeublesVisites
      totalRendezVousPris
      totalRefus
      totalImmeublesProspectes
      totalPortesProspectes
      tauxConversion
      tauxSuccesRdv
      nombreCommerciaux
      performanceGlobale
    }
  }
`

export const GET_ME = `
  query Me {
    me {
      id
      role
      email
    }
  }
`
