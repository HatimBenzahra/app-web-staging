export const GET_GPS_LATEST_ACTOR_POSITIONS = `
  query GpsLatestActorPositions {
    gpsLatestActorPositions {
      id
      userId
      userType
      latitude
      longitude
      accuracy
      batteryLevel
      isOnline
      recordedAt
    }
  }
`

export const GET_GPS_DAILY_ROUTE_BY_ACTOR = `
  query GpsDailyRouteByActor($userId: Int!, $userType: UserType!, $date: String!) {
    gpsDailyRouteByActor(userId: $userId, userType: $userType, date: $date) {
      latitude
      longitude
      recordedAt
    }
  }
`

export const GET_GPS_ROUTE_BY_ACTOR = `
  query GpsRouteByActor($userId: Int!, $userType: UserType!, $from: String!, $to: String!) {
    gpsRouteByActor(userId: $userId, userType: $userType, from: $from, to: $to) {
      latitude
      longitude
      recordedAt
      accuracy
    }
  }
`
