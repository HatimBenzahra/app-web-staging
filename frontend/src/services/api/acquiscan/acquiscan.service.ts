import { gql } from '../../core/graphql'
import {
  GET_ACQUISCAN_ADDRESSES,
  GET_ACQUISCAN_ADDRESS_SUGGESTIONS,
  GET_ACQUISCAN_COMMUNE_OPPORTUNITIES,
  GET_ACQUISCAN_COPPER_BUILDINGS,
  GET_ACQUISCAN_DEPARTMENT_OPPORTUNITIES,
  GET_ACQUISCAN_MAP_ADDRESSES,
  GET_ACQUISCAN_ZONE_PREVIEW,
  CREATE_ACQUISCAN_ZONE,
} from './acquiscan.queries'
import type {
  AcquiscanAddressesInput,
  AcquiscanAddressesPage,
  AcquiscanAddressSearchInput,
  AcquiscanAddressSuggestion,
  AcquiscanCommuneOpportunitiesInput,
  AcquiscanCommuneOpportunitiesPage,
  AcquiscanCopperBuildingsInput,
  AcquiscanCopperBuildingsPage,
  AcquiscanDepartmentOpportunitiesPage,
  AcquiscanMapInput,
  AcquiscanMapResult,
  AcquiscanZonePreviewInput,
  AcquiscanZonePreviewResult,
  CreateAcquiscanZoneInput,
} from './acquiscan.types'
import type { Zone } from '../zones'

export const acquiscanApi = {
  async getAddressSuggestions(input: AcquiscanAddressSearchInput): Promise<AcquiscanAddressSuggestion[]> {
    const response = await gql<
      { acquiscanAddressSuggestions: AcquiscanAddressSuggestion[] },
      { input: AcquiscanAddressSearchInput }
    >(GET_ACQUISCAN_ADDRESS_SUGGESTIONS, { input })
    return response.acquiscanAddressSuggestions
  },

  async getAddresses(input: AcquiscanAddressesInput): Promise<AcquiscanAddressesPage> {
    const response = await gql<
      { acquiscanAddresses: AcquiscanAddressesPage },
      { input: AcquiscanAddressesInput }
    >(GET_ACQUISCAN_ADDRESSES, { input })
    return response.acquiscanAddresses
  },

  async getMapAddresses(input: AcquiscanMapInput): Promise<AcquiscanMapResult> {
    const response = await gql<
      { acquiscanMapAddresses: AcquiscanMapResult },
      { input: AcquiscanMapInput }
    >(GET_ACQUISCAN_MAP_ADDRESSES, { input })
    return response.acquiscanMapAddresses
  },

  async getDepartmentOpportunities(): Promise<AcquiscanDepartmentOpportunitiesPage> {
    const response = await gql<{ acquiscanDepartmentOpportunities: AcquiscanDepartmentOpportunitiesPage }>(
      GET_ACQUISCAN_DEPARTMENT_OPPORTUNITIES
    )
    return response.acquiscanDepartmentOpportunities
  },

  async getCommuneOpportunities(input: AcquiscanCommuneOpportunitiesInput): Promise<AcquiscanCommuneOpportunitiesPage> {
    const response = await gql<
      { acquiscanCommuneOpportunities: AcquiscanCommuneOpportunitiesPage },
      { input: AcquiscanCommuneOpportunitiesInput }
    >(GET_ACQUISCAN_COMMUNE_OPPORTUNITIES, { input })
    return response.acquiscanCommuneOpportunities
  },

  async getCopperBuildings(input: AcquiscanCopperBuildingsInput): Promise<AcquiscanCopperBuildingsPage> {
    const response = await gql<
      { acquiscanCopperBuildings: AcquiscanCopperBuildingsPage },
      { input: AcquiscanCopperBuildingsInput }
    >(GET_ACQUISCAN_COPPER_BUILDINGS, { input })
    return response.acquiscanCopperBuildings
  },

  async getZonePreview(input: AcquiscanZonePreviewInput): Promise<AcquiscanZonePreviewResult> {
    const response = await gql<
      { acquiscanZonePreview: AcquiscanZonePreviewResult },
      { input: AcquiscanZonePreviewInput }
    >(GET_ACQUISCAN_ZONE_PREVIEW, { input })
    return response.acquiscanZonePreview
  },

  async createZone(input: CreateAcquiscanZoneInput): Promise<Zone> {
    const response = await gql<
      { createAcquiscanZone: Zone },
      { input: CreateAcquiscanZoneInput }
    >(CREATE_ACQUISCAN_ZONE, { input })
    return response.createAcquiscanZone
  },
}
