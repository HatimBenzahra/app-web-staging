export interface AcquiscanAddressesInput {
  dept: string
  commune?: string
  annee?: string
  search?: string
  fiber?: string
  coverage4g?: string
  coverage5g?: string
  segment?: string
  limit?: number
  offset?: number
  enrichCoordinates?: boolean
}

export interface AcquiscanCoordinate {
  latitude?: number | null
  longitude?: number | null
  imbX?: number | null
  imbY?: number | null
}

export interface AcquiscanAddress {
  immeubleId: string
  imbCode?: string | null
  addrNumero?: string | null
  addrNomVoie?: string | null
  addrNomCommune?: string | null
  codeInsee?: string | null
  nbrLogements?: string | null
  fermetureTechnique?: string | null
  fermetureComZone?: string | null
  fermetureComAddr?: string | null
  eligFo?: string | null
  anneeFt?: string | null
  sites4g?: number | null
  sites5g?: number | null
  sitesTotal?: number | null
  coordinates?: AcquiscanCoordinate | null
}

export interface AcquiscanImportStatus {
  dept: string
  isImported: boolean
  importedCount: number
  importedAt?: string | null
}

export interface AcquiscanAddressesPage {
  rows: AcquiscanAddress[]
  total: number
  enrichedCount: number
  importStatus: AcquiscanImportStatus
}
