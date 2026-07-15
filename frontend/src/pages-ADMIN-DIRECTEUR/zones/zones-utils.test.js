import {
  createGeoJSONCircle,
  getAssignedUserIdsFromZone,
  parseAssignedUserId,
  parseAssignedUserIds,
  polygonAreaKm2,
  removeRedundantAssignments,
  zoneToGeoJSON,
} from './zones-utils'

describe('zoneToGeoJSON', () => {
  it('builds a Feature<Polygon> from zone.polygon (new polygon zones)', () => {
    const ring = [
      [2.0, 48.0],
      [2.1, 48.0],
      [2.1, 48.1],
      [2.0, 48.1],
      [2.0, 48.0],
    ]
    const feature = zoneToGeoJSON({ polygon: ring })

    expect(feature).toEqual({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: {},
    })
  })

  it('falls back to a generated circle for legacy circle zones', () => {
    const zone = { xOrigin: 2.3522, yOrigin: 48.8566, rayon: 1000 }
    const feature = zoneToGeoJSON(zone)
    const expected = createGeoJSONCircle([zone.xOrigin, zone.yOrigin], zone.rayon)

    expect(feature).toEqual(expected)
    expect(feature.geometry.type).toBe('Polygon')
    // Anneau fermé
    const coords = feature.geometry.coordinates[0]
    expect(coords[0]).toEqual(coords[coords.length - 1])
  })

  it('returns null when no geometry is available', () => {
    expect(zoneToGeoJSON(null)).toBeNull()
    expect(zoneToGeoJSON({ nom: 'sans géométrie' })).toBeNull()
  })
})

describe('polygonAreaKm2', () => {
  it('returns 0 for invalid or degenerate rings', () => {
    expect(polygonAreaKm2(null)).toBe(0)
    expect(polygonAreaKm2([])).toBe(0)
    expect(polygonAreaKm2([[2, 48], [2.1, 48], [2, 48]])).toBe(0)
  })

  it('matches the area of a generated circle (~π·r²)', () => {
    const ring = createGeoJSONCircle([2.3522, 48.8566], 1000).geometry.coordinates[0]
    // Disque de rayon 1 km -> π km²
    expect(polygonAreaKm2(ring)).toBeCloseTo(Math.PI, 1)
  })

  it('computes a positive area regardless of winding order', () => {
    const ring = [
      [2.0, 48.0],
      [2.1, 48.0],
      [2.1, 48.1],
      [2.0, 48.1],
      [2.0, 48.0],
    ]
    const reversed = [...ring].reverse()
    expect(polygonAreaKm2(ring)).toBeGreaterThan(0)
    expect(polygonAreaKm2(reversed)).toBeCloseTo(polygonAreaKm2(ring), 6)
  })
})

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
