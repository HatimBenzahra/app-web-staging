import { getStatusFilterOptions, getStatusMeta } from './user-status'

describe('getStatusMeta', () => {
  it('returns actif metadata', () => {
    const result = getStatusMeta('ACTIF')

    expect(result.label).toBe('Actif')
    expect(result.badgeClass).toContain('emerald')
  })

  it('returns contrat finie metadata', () => {
    const result = getStatusMeta('CONTRAT_FINIE')

    expect(result.label).toBe('Contrat fini')
    expect(result.badgeClass).toContain('orange')
  })

  it('returns unknown metadata for null status', () => {
    const result = getStatusMeta(null)

    expect(result.label).toBe('Inconnu')
    expect(result.badgeClass).toContain('gray')
  })

  it('returns passthrough label with unknown badge for unknown value', () => {
    const result = getStatusMeta('UNKNOWN_VALUE')

    expect(result.label).toBe('UNKNOWN_VALUE')
    expect(result.badgeClass).toContain('gray')
  })
})

describe('getStatusFilterOptions', () => {
  it('returns exactly 3 filter options', () => {
    const options = getStatusFilterOptions()

    expect(options).toHaveLength(3)
  })

  it('returns options with only value and label fields', () => {
    const options = getStatusFilterOptions()

    options.forEach(option => {
      expect(option).toHaveProperty('value')
      expect(option).toHaveProperty('label')
      expect(option).not.toHaveProperty('badgeClass')
    })
  })
})
