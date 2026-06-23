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
  source?: string | null
  matchKey?: string | null
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
  hasCoordinates: boolean
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

export interface AcquiscanAddressSearchInput {
  query: string
  limit?: number
}

export interface AcquiscanAddressSuggestion {
  id: string
  label: string
  city?: string | null
  postcode?: string | null
  codeInsee?: string | null
  latitude: number
  longitude: number
  score?: number | null
}

export interface AcquiscanTerritoryGeoJsonInput {
  level: 'departments' | 'communes'
  dept?: string
  deptName?: string
}

export interface AcquiscanBoundsInput {
  west: number
  south: number
  east: number
  north: number
}

export interface AcquiscanMapInput {
  bounds: AcquiscanBoundsInput
  zoom: number
  dept?: string
  commune?: string
  search?: string
  annee?: string
  fiber?: string
  coverage4g?: string
  coverage5g?: string
  segment?: string
  limit?: number
  cluster?: boolean
}

export interface AcquiscanMapPoint {
  id: string
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
  dept: string
  latitude: number
  longitude: number
}

export interface AcquiscanMapCluster {
  id: string
  latitude: number
  longitude: number
  count: number
}

export interface AcquiscanDepartmentCoverage {
  dept: string
  importedCount: number
  importedAt?: string | null
}

export interface AcquiscanMapResult {
  points: AcquiscanMapPoint[]
  clusters: AcquiscanMapCluster[]
  totalInBounds: number
  returnedCount: number
  tooManyResults: boolean
  clustered: boolean
  coverage: AcquiscanDepartmentCoverage[]
}

export interface AcquiscanOpportunitySummary {
  totalBuildings: number
  fiberBuildings: number
  copperBuildings: number
  copperShutdown: number
  fiberRate: number
  copperShutdownRate: number
  closestShutdownYear?: number | null
  sites4g: number
  sites5g: number
  sitesTotal: number
  opportunityScore: number
}

export interface AcquiscanDepartmentOpportunity {
  codeDept: string
  summary: AcquiscanOpportunitySummary
}

export interface AcquiscanDepartmentOpportunitiesPage {
  rows: AcquiscanDepartmentOpportunity[]
  summary: AcquiscanOpportunitySummary
}

export interface AcquiscanCommuneOpportunitiesInput {
  dept: string
}

export interface AcquiscanCommuneOpportunity {
  codeInsee: string
  nomCommune?: string | null
  codeDept: string
  summary: AcquiscanOpportunitySummary
}

export interface AcquiscanCommuneOpportunitiesPage {
  rows: AcquiscanCommuneOpportunity[]
  summary: AcquiscanOpportunitySummary
}

export interface AcquiscanCopperBuildingsInput {
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
}

export interface AcquiscanCopperBuildingOpportunity extends AcquiscanAddress {
  opportunityScore: number
  opportunityLabel: string
}

export interface AcquiscanCopperBuildingsPage {
  rows: AcquiscanCopperBuildingOpportunity[]
  total: number
  limit: number
  offset: number
}

export interface AcquiscanZonePreviewInput {
  longitude: number
  latitude: number
  radiusMeters: number
  dept?: string
  commune?: string
  annee?: string
  fiber?: string
  coverage4g?: string
  coverage5g?: string
  segment?: string
  limit?: number
}

export interface AcquiscanZoneTargetPreview extends AcquiscanMapPoint {
  distanceMeters: number
  opportunityScore: number
}

export interface AcquiscanZonePreviewSummary {
  totalTargets: number
  totalLogements: number
  noFiberTargets: number
  fiberTargets: number
  copperClosureTargets: number
  strong4gTargets: number
  strong5gTargets: number
  averageOpportunityScore: number
}

export interface AcquiscanZonePreviewResult {
  targets: AcquiscanZoneTargetPreview[]
  summary: AcquiscanZonePreviewSummary
  totalInCircle: number
  tooManyResults: boolean
}

export interface CreateAcquiscanZoneInput extends AcquiscanZonePreviewInput {
  nom: string
  selectedImmeubleIds?: string[]
  directeurId?: number
  managerId?: number
}
