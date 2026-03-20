import { commercialApi } from './commercials'
import { managerApi } from './managers'
import { directeurApi } from './directeurs'
import { zoneApi } from './zones'
import { immeubleApi } from './immeubles'
import { porteApi } from './portes'
import { gamificationApi } from './gamification'
import { statisticApi, authApi } from './statistics'
import { kioskApi } from './kiosk'

export * from './commercials'
export * from './managers'
export * from './directeurs'
export * from './zones'
export * from './immeubles'
export * from './portes'
export * from './statistics'
export * from './gamification'
export * from './kiosk'

export const api = {
  auth: authApi,
  directeurs: directeurApi,
  managers: managerApi,
  commercials: commercialApi,
  zones: zoneApi,
  immeubles: immeubleApi,
  statistics: statisticApi,
  portes: porteApi,
  gamification: gamificationApi,
  kiosk: kioskApi,
}

export default api
