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

export const GET_TEAM_LAST_STATUS_ACTIVITIES = `
  query GetTeamLastStatusActivities {
    teamLastStatusActivities {
      userId
      userType
      userName
      statut
      changedAt
      porteId
      porteNumero
      immeubleId
      immeubleAdresse
    }
  }
`

export const GET_STATS_TIMELINE = `
  query GetStatsTimeline(
    $scopeType: String
    $ownerType: String
    $ownerId: Int
    $startDate: DateTime
    $endDate: DateTime
  ) {
    statsTimeline(
      scopeType: $scopeType
      ownerType: $ownerType
      ownerId: $ownerId
      startDate: $startDate
      endDate: $endDate
    ) {
      date
      rdvPris
      portesProspectees
      contratsSignes
      refus
      absents
      argumentes
      repassages
    }
  }
`

export const GET_STATS_ACTIVITY_BY_OWNER = `
  query GetStatsActivityByOwner(
    $scopeType: String
    $ownerType: String
    $ownerId: Int
    $startDate: DateTime
    $endDate: DateTime
  ) {
    statsActivityByOwner(
      scopeType: $scopeType
      ownerType: $ownerType
      ownerId: $ownerId
      startDate: $startDate
      endDate: $endDate
    ) {
      userId
      userType
      userName
      contratsSignes
      rendezVousPris
      refus
      absents
      argumentes
      repassages
      nbPortesProspectes
      tauxConversion
      points
      lastActivityAt
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
