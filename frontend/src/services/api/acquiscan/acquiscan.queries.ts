export const GET_ACQUISCAN_ADDRESSES = `
  query GetAcquiscanAddresses($input: AcquiscanAddressesInput!) {
    acquiscanAddresses(input: $input) {
      total
      enrichedCount
      importStatus {
        dept
        isImported
        importedCount
        importedAt
      }
      rows {
        immeubleId
        imbCode
        addrNumero
        addrNomVoie
        addrNomCommune
        codeInsee
        nbrLogements
        fermetureTechnique
        fermetureComZone
        fermetureComAddr
        eligFo
        anneeFt
        sites4g
        sites5g
        sitesTotal
        coordinates {
          latitude
          longitude
          imbX
          imbY
        }
      }
    }
  }
`

export const IMPORT_ACQUISCAN_COORDINATES = `
  mutation ImportAcquiscanCoordinates($dept: String!) {
    importAcquiscanCoordinates(dept: $dept) {
      dept
      isImported
      importedCount
      importedAt
    }
  }
`
