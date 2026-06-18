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

export const GET_ACQUISCAN_ADDRESS_SUGGESTIONS = `
  query GetAcquiscanAddressSuggestions($input: AcquiscanAddressSearchInput!) {
    acquiscanAddressSuggestions(input: $input) {
      id
      label
      city
      postcode
      codeInsee
      latitude
      longitude
      score
    }
  }
`

export const GET_ACQUISCAN_MAP_ADDRESSES = `
  query GetAcquiscanMapAddresses($input: AcquiscanMapInput!) {
    acquiscanMapAddresses(input: $input) {
      totalInBounds
      returnedCount
      tooManyResults
      clustered
      coverage {
        dept
        importedCount
        importedAt
      }
      clusters {
        id
        latitude
        longitude
        count
      }
      points {
        id
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
        dept
        latitude
        longitude
      }
    }
  }
`

const ACQUISCAN_SUMMARY_FIELDS = `
  summary {
    totalBuildings
    fiberBuildings
    copperBuildings
    copperShutdown
    fiberRate
    copperShutdownRate
    closestShutdownYear
    sites4g
    sites5g
    sitesTotal
    opportunityScore
  }
`

export const GET_ACQUISCAN_DEPARTMENT_OPPORTUNITIES = `
  query GetAcquiscanDepartmentOpportunities {
    acquiscanDepartmentOpportunities {
      summary {
        totalBuildings
        fiberBuildings
        copperBuildings
        copperShutdown
        fiberRate
        copperShutdownRate
        closestShutdownYear
        sites4g
        sites5g
        sitesTotal
        opportunityScore
      }
      rows {
        codeDept
        ${ACQUISCAN_SUMMARY_FIELDS}
      }
    }
  }
`

export const GET_ACQUISCAN_COMMUNE_OPPORTUNITIES = `
  query GetAcquiscanCommuneOpportunities($input: AcquiscanCommuneOpportunitiesInput!) {
    acquiscanCommuneOpportunities(input: $input) {
      summary {
        totalBuildings
        fiberBuildings
        copperBuildings
        copperShutdown
        fiberRate
        copperShutdownRate
        closestShutdownYear
        sites4g
        sites5g
        sitesTotal
        opportunityScore
      }
      rows {
        codeInsee
        nomCommune
        codeDept
        ${ACQUISCAN_SUMMARY_FIELDS}
      }
    }
  }
`

export const GET_ACQUISCAN_COPPER_BUILDINGS = `
  query GetAcquiscanCopperBuildings($input: AcquiscanCopperBuildingsInput!) {
    acquiscanCopperBuildings(input: $input) {
      total
      limit
      offset
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
        opportunityScore
        opportunityLabel
      }
    }
  }
`
