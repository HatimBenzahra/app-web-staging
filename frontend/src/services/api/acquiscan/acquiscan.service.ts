import { gql } from '../../core/graphql'
import { GET_ACQUISCAN_ADDRESSES, IMPORT_ACQUISCAN_COORDINATES } from './acquiscan.queries'
import type {
  AcquiscanAddressesInput,
  AcquiscanAddressesPage,
  AcquiscanImportStatus,
} from './acquiscan.types'

export const acquiscanApi = {
  async getAddresses(input: AcquiscanAddressesInput): Promise<AcquiscanAddressesPage> {
    const response = await gql<
      { acquiscanAddresses: AcquiscanAddressesPage },
      { input: AcquiscanAddressesInput }
    >(GET_ACQUISCAN_ADDRESSES, { input })
    return response.acquiscanAddresses
  },

  async importCoordinates(dept: string): Promise<AcquiscanImportStatus> {
    const response = await gql<
      { importAcquiscanCoordinates: AcquiscanImportStatus },
      { dept: string }
    >(IMPORT_ACQUISCAN_COORDINATES, { dept })
    return response.importAcquiscanCoordinates
  },
}
