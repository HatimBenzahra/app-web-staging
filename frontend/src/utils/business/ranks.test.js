import { aggregateStats, calculateRank, calculateRankFromStats, getNextRank } from './ranks'

describe('calculateRank', () => {
  it('returns Bronze with 0 points for zero inputs', () => {
    const result = calculateRank(0, 0, 0)

    expect(result.rank.name).toBe('Bronze')
    expect(result.points).toBe(0)
  })

  it('returns Silver for 2 signed contracts (100 points)', () => {
    const result = calculateRank(2, 0, 0)

    expect(result.rank.name).toBe('Silver')
    expect(result.points).toBe(100)
  })

  it('returns Gold for 5 signed contracts (250 points)', () => {
    const result = calculateRank(5, 0, 0)

    expect(result.rank.name).toBe('Gold')
    expect(result.points).toBe(250)
  })

  it('returns Platinum for 10 signed contracts (500 points)', () => {
    const result = calculateRank(10, 0, 0)

    expect(result.rank.name).toBe('Platinum')
    expect(result.points).toBe(500)
  })

  it('returns Diamond for 20 signed contracts (1000 points)', () => {
    const result = calculateRank(20, 0, 0)

    expect(result.rank.name).toBe('Diamond')
    expect(result.points).toBe(1000)
  })

  it('returns Gold for mixed stats totaling 250 points', () => {
    const result = calculateRank(3, 5, 10)

    expect(result.rank.name).toBe('Gold')
    expect(result.points).toBe(250)
  })

  it('uses default params for undefined inputs', () => {
    const result = calculateRank()

    expect(result.rank.name).toBe('Bronze')
    expect(result.points).toBe(0)
  })
})

describe('getNextRank', () => {
  it('returns Silver and 100 points needed from 0', () => {
    const result = getNextRank(0)

    expect(result.nextRank.name).toBe('Silver')
    expect(result.pointsToNextRank).toBe(100)
  })

  it('returns Silver and 1 point needed from 99', () => {
    const result = getNextRank(99)

    expect(result.nextRank.name).toBe('Silver')
    expect(result.pointsToNextRank).toBe(1)
  })

  it('returns Gold and 150 points needed from 100', () => {
    const result = getNextRank(100)

    expect(result.nextRank.name).toBe('Gold')
    expect(result.pointsToNextRank).toBe(150)
  })

  it('returns no next rank at Diamond threshold and above', () => {
    const result = getNextRank(1000)

    expect(result.nextRank).toBeUndefined()
    expect(result.pointsToNextRank).toBe(0)
  })
})

describe('aggregateStats', () => {
  it('returns all zeros for null input', () => {
    expect(aggregateStats(null)).toEqual({
      contratsSignes: 0,
      rendezVousPris: 0,
      immeublesVisites: 0,
      refus: 0,
    })
  })

  it('returns all zeros for empty array', () => {
    expect(aggregateStats([])).toEqual({
      contratsSignes: 0,
      rendezVousPris: 0,
      immeublesVisites: 0,
      refus: 0,
    })
  })

  it('aggregates a single stats entry', () => {
    expect(
      aggregateStats([
        { contratsSignes: 1, rendezVousPris: 2, immeublesVisites: 3, refus: 4 },
      ])
    ).toEqual({
      contratsSignes: 1,
      rendezVousPris: 2,
      immeublesVisites: 3,
      refus: 4,
    })
  })

  it('aggregates multiple stats entries', () => {
    expect(
      aggregateStats([
        { contratsSignes: 1, rendezVousPris: 2, immeublesVisites: 3, refus: 1 },
        { contratsSignes: 4, rendezVousPris: 5, immeublesVisites: 6, refus: 2 },
      ])
    ).toEqual({
      contratsSignes: 5,
      rendezVousPris: 7,
      immeublesVisites: 9,
      refus: 3,
    })
  })

  it('defaults refus to 0 when field is missing', () => {
    expect(
      aggregateStats([
        { contratsSignes: 1, rendezVousPris: 1, immeublesVisites: 1 },
        { contratsSignes: 2, rendezVousPris: 2, immeublesVisites: 2, refus: 5 },
      ])
    ).toEqual({
      contratsSignes: 3,
      rendezVousPris: 3,
      immeublesVisites: 3,
      refus: 5,
    })
  })
})

describe('calculateRankFromStats', () => {
  it('returns Bronze for null stats', () => {
    const result = calculateRankFromStats(null)

    expect(result.rank.name).toBe('Bronze')
    expect(result.points).toBe(0)
  })

  it('returns Silver for stats totaling 100 points', () => {
    const result = calculateRankFromStats([
      { contratsSignes: 2, rendezVousPris: 0, immeublesVisites: 0 },
    ])

    expect(result.rank.name).toBe('Silver')
    expect(result.points).toBe(100)
  })

  it('matches calculateRank result for equivalent totals', () => {
    const stats = [
      { contratsSignes: 1, rendezVousPris: 3, immeublesVisites: 4 },
      { contratsSignes: 2, rendezVousPris: 1, immeublesVisites: 6 },
    ]

    const fromStats = calculateRankFromStats(stats)
    const manual = calculateRank(3, 4, 10)

    expect(fromStats).toEqual(manual)
  })
})
