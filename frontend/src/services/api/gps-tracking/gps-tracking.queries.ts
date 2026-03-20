export const SAVE_GPS_POSITIONS = `
  mutation SaveGpsPositions($input: SaveGpsPositionsInput!) {
    saveGpsPositions(input: $input) {
      success
      saved
    }
  }
`

export const GET_GPS_HISTORY = `
  query GpsHistory($deviceId: String!, $from: String, $to: String, $limit: Int) {
    gpsHistory(deviceId: $deviceId, from: $from, to: $to, limit: $limit) {
      total
      positions {
        id
        deviceId
        deviceName
        latitude
        longitude
        accuracy
        batteryLevel
        isOnline
        recordedAt
      }
    }
  }
`

export const GET_GPS_DAILY_ROUTE = `
  query GpsDailyRoute($deviceId: String!, $date: String!) {
    gpsDailyRoute(deviceId: $deviceId, date: $date) {
      total
      positions {
        id
        deviceId
        deviceName
        latitude
        longitude
        accuracy
        batteryLevel
        isOnline
        recordedAt
      }
    }
  }
`

export const GET_GPS_LATEST_POSITIONS = `
  query GpsLatestPositions {
    gpsLatestPositions {
      id
      deviceId
      deviceName
      latitude
      longitude
      accuracy
      batteryLevel
      isOnline
      recordedAt
    }
  }
`

export const GET_GPS_DEVICES = `
  query GpsDevices {
    gpsDevices {
      deviceId
      deviceName
    }
  }
`

export const GET_GPS_ALL_POSITIONS = `
  query GpsAllPositions($from: String!, $to: String!, $deviceId: String, $limit: Int) {
    gpsAllPositions(from: $from, to: $to, deviceId: $deviceId, limit: $limit) {
      total
      positions {
        id
        deviceId
        deviceName
        latitude
        longitude
        accuracy
        batteryLevel
        isOnline
        recordedAt
      }
    }
  }
`

export const GET_DEVICE_MAPPINGS = `
  query DeviceMappings {
    deviceMappings {
      id
      deviceId
      commercialName
      updatedAt
    }
  }
`

export const SET_DEVICE_COMMERCIAL = `
  mutation SetDeviceCommercial($input: SetDeviceCommercialInput!) {
    setDeviceCommercial(input: $input) {
      id
      deviceId
      commercialName
    }
  }
`
