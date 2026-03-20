import {
  getAssignedUserIdsFromZone,
  parseAssignedUserId,
  parseAssignedUserIds,
  removeRedundantAssignments,
} from './zones-utils'

describe('parseAssignedUserId', () => {
  it('parses commercial-42', () => {
    expect(parseAssignedUserId('commercial-42')).toEqual({ role: 'commercial', id: 42 })
  })

  it('parses manager-1', () => {
    expect(parseAssignedUserId('manager-1')).toEqual({ role: 'manager', id: 1 })
  })

  it('parses directeur-5', () => {
    expect(parseAssignedUserId('directeur-5')).toEqual({ role: 'directeur', id: 5 })
  })
})

describe('parseAssignedUserIds', () => {
  it('parses an array of assigned user ids', () => {
    expect(parseAssignedUserIds(['commercial-42', 'manager-1', 'directeur-5'])).toEqual([
      { role: 'commercial', id: 42 },
      { role: 'manager', id: 1 },
      { role: 'directeur', id: 5 },
    ])
  })

  it('returns empty array for empty input array', () => {
    expect(parseAssignedUserIds([])).toEqual([])
  })
})

describe('removeRedundantAssignments', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('removes manager and commercial when their directeur is assigned', () => {
    const assignments = [
      { role: 'directeur', id: 10 },
      { role: 'manager', id: 20 },
      { role: 'commercial', id: 30 },
      { role: 'commercial', id: 31 },
    ]

    const managers = [{ id: 20, directeurId: 10, prenom: 'M', nom: 'One' }]
    const commercials = [
      { id: 30, directeurId: 10, managerId: null, prenom: 'C', nom: 'One' },
      { id: 31, directeurId: null, managerId: 20, prenom: 'C', nom: 'Two' },
    ]

    expect(removeRedundantAssignments(assignments, [], managers, commercials)).toEqual([
      { role: 'directeur', id: 10 },
    ])
  })

  it('removes commercial when its manager is assigned and no directeur cascade applies', () => {
    const assignments = [
      { role: 'manager', id: 20 },
      { role: 'commercial', id: 31 },
      { role: 'commercial', id: 99 },
    ]

    const managers = [{ id: 20, directeurId: null, prenom: 'M', nom: 'One' }]
    const commercials = [{ id: 31, directeurId: null, managerId: 20, prenom: 'C', nom: 'Two' }]

    expect(removeRedundantAssignments(assignments, [], managers, commercials)).toEqual([
      { role: 'manager', id: 20 },
      { role: 'commercial', id: 99 },
    ])
  })
})

describe('getAssignedUserIdsFromZone', () => {
  it('builds ids from direct zone fields and assignment records with deduplication', () => {
    const zone = { id: 7, directeurId: 5, managerId: 3 }
    const allAssignments = [
      { zoneId: 7, userType: 'COMMERCIAL', userId: 11 },
      { zoneId: 7, userType: 'MANAGER', userId: 3 },
      { zoneId: 7, userType: 'DIRECTEUR', userId: 5 },
      { zoneId: 8, userType: 'COMMERCIAL', userId: 99 },
    ]

    expect(getAssignedUserIdsFromZone(zone, allAssignments)).toEqual([
      'directeur-5',
      'manager-3',
      'commercial-11',
    ])
  })

  it('returns empty array for null zone', () => {
    expect(getAssignedUserIdsFromZone(null, [])).toEqual([])
  })
})
