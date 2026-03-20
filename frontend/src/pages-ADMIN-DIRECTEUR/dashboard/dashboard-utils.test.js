import { describe, it, expect } from 'vitest'

function buildMonthOptions(now = new Date()) {
  const options = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    options.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return options
}

function computePeriodKey(mode, now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return mode === 'DAILY' ? `${y}-${m}-${d}` : `${y}-${m}`
}

const AVATAR_COLORS = [
  'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
  'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
]

function getAvatarColor(name) {
  const index = (name || 'A').charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

function getOffreLogoUrl(logoUrl) {
  if (!logoUrl) return null
  if (logoUrl.startsWith('http')) return logoUrl
  return `https://www.winleadplus.com${logoUrl}`
}

function filterTop3(ranking) {
  if (!ranking) return []
  return ranking.filter(e => e.points > 0).slice(0, 3)
}

function computeMaxCount(distribution) {
  if (!distribution?.length) return 1
  return distribution[0].count
}

function computeBarPercent(count, maxCount) {
  return Math.round((count / maxCount) * 100)
}

describe('buildMonthOptions', () => {
  it('returns exactly 6 months', () => {
    const options = buildMonthOptions(new Date(2026, 2, 15))
    expect(options).toHaveLength(6)
  })

  it('starts with the current month', () => {
    const options = buildMonthOptions(new Date(2026, 2, 15))
    expect(options[0].key).toBe('2026-03')
  })

  it('goes back 5 months from current', () => {
    const options = buildMonthOptions(new Date(2026, 2, 15))
    expect(options[5].key).toBe('2025-10')
  })

  it('handles year boundary (January)', () => {
    const options = buildMonthOptions(new Date(2026, 0, 10))
    expect(options[0].key).toBe('2026-01')
    expect(options[1].key).toBe('2025-12')
    expect(options[5].key).toBe('2025-08')
  })

  it('zero-pads single digit months', () => {
    const options = buildMonthOptions(new Date(2026, 2, 1))
    expect(options[0].key).toBe('2026-03')
    const options2 = buildMonthOptions(new Date(2026, 0, 1))
    expect(options2[0].key).toBe('2026-01')
  })

  it('capitalizes label', () => {
    const options = buildMonthOptions(new Date(2026, 2, 15))
    expect(options[0].label.charAt(0)).toMatch(/[A-ZÀ-Ü]/)
  })
})

describe('computePeriodKey', () => {
  it('returns YYYY-MM-DD for DAILY', () => {
    const key = computePeriodKey('DAILY', new Date(2026, 2, 15))
    expect(key).toBe('2026-03-15')
  })

  it('returns YYYY-MM for MONTHLY', () => {
    const key = computePeriodKey('MONTHLY', new Date(2026, 2, 15))
    expect(key).toBe('2026-03')
  })

  it('zero-pads day and month', () => {
    const key = computePeriodKey('DAILY', new Date(2026, 0, 5))
    expect(key).toBe('2026-01-05')
  })

  it('defaults to MONTHLY for unknown mode', () => {
    const key = computePeriodKey('WEEKLY', new Date(2026, 2, 15))
    expect(key).toBe('2026-03')
  })
})

describe('getAvatarColor', () => {
  it('returns a string from the palette', () => {
    const color = getAvatarColor('Alice')
    expect(color).toContain('bg-')
    expect(color).toContain('text-')
  })

  it('returns deterministic color for same name', () => {
    expect(getAvatarColor('Bob')).toBe(getAvatarColor('Bob'))
  })

  it('handles null/undefined gracefully', () => {
    const color = getAvatarColor(null)
    expect(color).toContain('bg-')
  })

  it('handles empty string', () => {
    const color = getAvatarColor('')
    expect(color).toContain('bg-')
  })

  it('different names can produce different colors', () => {
    const colors = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(getAvatarColor))
    expect(colors.size).toBeGreaterThan(1)
  })
})

describe('getOffreLogoUrl', () => {
  it('returns null for falsy input', () => {
    expect(getOffreLogoUrl(null)).toBeNull()
    expect(getOffreLogoUrl(undefined)).toBeNull()
    expect(getOffreLogoUrl('')).toBeNull()
  })

  it('returns absolute URLs as-is', () => {
    expect(getOffreLogoUrl('https://example.com/logo.png')).toBe('https://example.com/logo.png')
    expect(getOffreLogoUrl('http://example.com/logo.png')).toBe('http://example.com/logo.png')
  })

  it('prefixes relative paths with winleadplus domain', () => {
    expect(getOffreLogoUrl('/uploads/logo.png')).toBe(
      'https://www.winleadplus.com/uploads/logo.png'
    )
  })
})

describe('filterTop3', () => {
  it('returns empty array for null ranking', () => {
    expect(filterTop3(null)).toEqual([])
  })

  it('returns empty array for undefined ranking', () => {
    expect(filterTop3(undefined)).toEqual([])
  })

  it('filters out entries with 0 points', () => {
    const ranking = [
      { id: 1, points: 50 },
      { id: 2, points: 0 },
      { id: 3, points: 30 },
    ]
    const result = filterTop3(ranking)
    expect(result).toHaveLength(2)
    expect(result.every(e => e.points > 0)).toBe(true)
  })

  it('returns max 3 entries', () => {
    const ranking = [
      { id: 1, points: 50 },
      { id: 2, points: 40 },
      { id: 3, points: 30 },
      { id: 4, points: 20 },
      { id: 5, points: 10 },
    ]
    expect(filterTop3(ranking)).toHaveLength(3)
  })

  it('returns fewer than 3 if not enough positive entries', () => {
    const ranking = [{ id: 1, points: 50 }]
    expect(filterTop3(ranking)).toHaveLength(1)
  })

  it('preserves order', () => {
    const ranking = [
      { id: 1, points: 100 },
      { id: 2, points: 80 },
      { id: 3, points: 60 },
    ]
    const result = filterTop3(ranking)
    expect(result[0].id).toBe(1)
    expect(result[1].id).toBe(2)
    expect(result[2].id).toBe(3)
  })
})

describe('computeMaxCount (offre distribution)', () => {
  it('returns 1 for null/empty distribution', () => {
    expect(computeMaxCount(null)).toBe(1)
    expect(computeMaxCount([])).toBe(1)
    expect(computeMaxCount(undefined)).toBe(1)
  })

  it('returns first entry count (sorted desc)', () => {
    const dist = [{ count: 189 }, { count: 184 }, { count: 61 }]
    expect(computeMaxCount(dist)).toBe(189)
  })
})

describe('computeBarPercent', () => {
  it('returns 100 for max value', () => {
    expect(computeBarPercent(189, 189)).toBe(100)
  })

  it('returns correct percentage', () => {
    expect(computeBarPercent(61, 189)).toBe(32)
  })

  it('returns 0 for 0 count', () => {
    expect(computeBarPercent(0, 189)).toBe(0)
  })

  it('rounds to nearest integer', () => {
    expect(computeBarPercent(1, 3)).toBe(33)
  })
})

describe('PERF_MODES integration', () => {
  const PERF_MODES = [
    { value: 'DAILY', label: 'Du jour' },
    { value: 'MONTHLY', label: 'Du mois' },
  ]

  it('has exactly 2 modes', () => {
    expect(PERF_MODES).toHaveLength(2)
  })

  it('DAILY mode produces daily period key', () => {
    const key = computePeriodKey(PERF_MODES[0].value, new Date(2026, 2, 15))
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('MONTHLY mode produces monthly period key', () => {
    const key = computePeriodKey(PERF_MODES[1].value, new Date(2026, 2, 15))
    expect(key).toMatch(/^\d{4}-\d{2}$/)
  })
})

describe('SEGMENT_FILTERS', () => {
  const SEGMENT_FILTERS = [
    { key: 'ARGUMENTE', label: 'Argumenté' },
    { key: 'REFUS', label: 'Refus' },
    { key: 'CONTRAT_SIGNE', label: 'Contrats' },
    { key: 'RENDEZ_VOUS_PRIS', label: 'RDV' },
    { key: null, label: 'Tous' },
  ]

  it('has 5 filters', () => {
    expect(SEGMENT_FILTERS).toHaveLength(5)
  })

  it('last filter has null key (show all)', () => {
    expect(SEGMENT_FILTERS[SEGMENT_FILTERS.length - 1].key).toBeNull()
  })

  it('all filters have a label', () => {
    SEGMENT_FILTERS.forEach(f => {
      expect(f.label).toBeTruthy()
    })
  })

  it('contains CONTRAT_SIGNE filter', () => {
    expect(SEGMENT_FILTERS.find(f => f.key === 'CONTRAT_SIGNE')).toBeTruthy()
  })
})

describe('PODIUM_STYLES', () => {
  const PODIUM_STYLES = [
    { badge: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    { badge: 'bg-slate-100 text-slate-700 border-slate-300' },
    { badge: 'bg-orange-100 text-orange-800 border-orange-300' },
  ]

  it('has exactly 3 styles (gold, silver, bronze)', () => {
    expect(PODIUM_STYLES).toHaveLength(3)
  })

  it('first style is gold (yellow)', () => {
    expect(PODIUM_STYLES[0].badge).toContain('yellow')
  })

  it('second style is silver (slate)', () => {
    expect(PODIUM_STYLES[1].badge).toContain('slate')
  })

  it('third style is bronze (orange)', () => {
    expect(PODIUM_STYLES[2].badge).toContain('orange')
  })
})
