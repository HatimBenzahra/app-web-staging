import { describe, it, expect } from 'vitest'
import {
  buildUserLookup,
  enrichRecordingWithUser,
  filterRecordings,
  sortRecordings,
  filterEcouteUsers,
} from './ecoutes-utils'

const makeUser = (id, prenom, nom, userType = 'commercial', status = 'ACTIF') => ({
  id,
  prenom,
  nom,
  userType,
  status,
})

const makeRecording = (key, size, lastModified, filename) => ({
  key,
  size,
  lastModified,
  filename: filename || key.split('/').pop() || '',
})

describe('buildUserLookup', () => {
  it('retourne un Map vide pour un tableau vide', () => {
    const lookup = buildUserLookup([])
    expect(lookup).toBeInstanceOf(Map)
    expect(lookup.size).toBe(0)
  })

  it('crée les clés room correctes pour des commerciaux', () => {
    const users = [makeUser('42', 'Jean', 'Dupont', 'commercial')]
    const lookup = buildUserLookup(users)
    expect(lookup.has('room_commercial_42')).toBe(true)
    expect(lookup.get('room_commercial_42').prenom).toBe('Jean')
  })

  it('crée les clés room correctes pour des managers', () => {
    const users = [makeUser('7', 'Marie', 'Martin', 'manager')]
    const lookup = buildUserLookup(users)
    expect(lookup.has('room_manager_7')).toBe(true)
  })

  it('gère userType undefined', () => {
    const users = [{ id: '1', prenom: 'Test', nom: 'User' }]
    const lookup = buildUserLookup(users)
    expect(lookup.has('room__1')).toBe(true)
  })

  it('gère plusieurs utilisateurs', () => {
    const users = [
      makeUser('1', 'A', 'B', 'commercial'),
      makeUser('2', 'C', 'D', 'manager'),
      makeUser('3', 'E', 'F', 'commercial'),
    ]
    const lookup = buildUserLookup(users)
    expect(lookup.size).toBe(3)
  })
})

describe('enrichRecordingWithUser', () => {
  const formatSize = bytes => `${bytes} B`
  const users = [makeUser('42', 'Jean', 'Dupont', 'commercial')]
  const lookup = buildUserLookup(users)

  it('enrichit un enregistrement avec les infos utilisateur', () => {
    const recording = { key: 'recordings/room_commercial_42/file.wav', size: 1024, lastModified: '2025-01-15T10:00:00Z' }
    const result = enrichRecordingWithUser(recording, lookup, formatSize)

    expect(result.userName).toBe('Jean Dupont')
    expect(result.userId).toBe('42')
    expect(result.userType).toBe('commercial')
    expect(result.filename).toBe('file.wav')
    expect(result.duration).toBe('1024 B')
    expect(result.key).toBe(recording.key)
    expect(result.id).toBe(recording.key)
  })

  it('retourne userName vide si pas de match', () => {
    const recording = { key: 'recordings/room_unknown_99/file.wav', size: 512, lastModified: null }
    const result = enrichRecordingWithUser(recording, lookup, formatSize)

    expect(result.userName).toBe('')
    expect(result.userId).toBeUndefined()
    expect(result.userType).toBeUndefined()
  })

  it('gère lastModified null pour date et time', () => {
    const recording = { key: 'recordings/room_commercial_42/test.wav', size: 100, lastModified: null }
    const result = enrichRecordingWithUser(recording, lookup, formatSize)

    expect(result.date).toBe('')
    expect(result.time).toBe('')
  })

  it('gère une clé sans sous-dossier', () => {
    const recording = { key: 'file.wav', size: 100, lastModified: '2025-01-15T10:00:00Z' }
    const result = enrichRecordingWithUser(recording, lookup, formatSize)

    expect(result.userName).toBe('')
    expect(result.filename).toBe('file.wav')
  })

  it('gère prenom ou nom manquant', () => {
    const partialLookup = new Map()
    partialLookup.set('room_commercial_1', { id: '1', prenom: 'Solo', userType: 'commercial' })
    const recording = { key: 'x/room_commercial_1/a.wav', size: 0, lastModified: null }
    const result = enrichRecordingWithUser(recording, partialLookup, formatSize)

    expect(result.userName).toBe('Solo')
  })
})

describe('filterRecordings', () => {
  const recordings = [
    makeRecording('a/appel-jean.wav', 100, '2025-03-01T10:00:00Z', 'appel-jean.wav'),
    makeRecording('b/reunion-equipe.wav', 200, '2025-03-05T14:00:00Z', 'reunion-equipe.wav'),
    makeRecording('c/demo-client.wav', 300, '2025-03-10T09:00:00Z', 'demo-client.wav'),
  ]

  it('retourne tout sans filtres', () => {
    const result = filterRecordings(recordings, '', null, null)
    expect(result).toHaveLength(3)
  })

  it('filtre par terme de recherche (case insensitive)', () => {
    const result = filterRecordings(recordings, 'JEAN', null, null)
    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe('appel-jean.wav')
  })

  it('filtre par dateFrom', () => {
    const result = filterRecordings(recordings, '', '2025-03-04', null)
    expect(result).toHaveLength(2)
  })

  it('filtre par dateTo', () => {
    const result = filterRecordings(recordings, '', null, '2025-03-05')
    expect(result).toHaveLength(2)
  })

  it('filtre par plage de dates', () => {
    const result = filterRecordings(recordings, '', '2025-03-04', '2025-03-06')
    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe('reunion-equipe.wav')
  })

  it('combine recherche et dates', () => {
    const result = filterRecordings(recordings, 'demo', '2025-03-01', '2025-03-15')
    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe('demo-client.wav')
  })

  it('retourne vide si recordings null', () => {
    expect(filterRecordings(null, '', null, null)).toEqual([])
  })

  it('retourne vide si aucun match', () => {
    const result = filterRecordings(recordings, 'inexistant', null, null)
    expect(result).toHaveLength(0)
  })
})

describe('sortRecordings', () => {
  const recordings = [
    { key: 'k1', filename: 'beta.wav', size: 300, lastModified: '2025-03-05T10:00:00Z' },
    { key: 'k2', filename: 'alpha.wav', size: 100, lastModified: '2025-03-01T10:00:00Z' },
    { key: 'k3', filename: 'gamma.wav', size: 200, lastModified: '2025-03-10T10:00:00Z' },
  ]

  it('tri par date desc (défaut)', () => {
    const result = sortRecordings(recordings, { key: 'date', direction: 'desc' }, new Map())
    expect(result[0].key).toBe('k3')
    expect(result[2].key).toBe('k2')
  })

  it('tri par date asc', () => {
    const result = sortRecordings(recordings, { key: 'date', direction: 'asc' }, new Map())
    expect(result[0].key).toBe('k2')
    expect(result[2].key).toBe('k3')
  })

  it('tri par filename asc', () => {
    const result = sortRecordings(recordings, { key: 'filename', direction: 'asc' }, new Map())
    expect(result[0].filename).toBe('alpha.wav')
    expect(result[2].filename).toBe('gamma.wav')
  })

  it('tri par size desc', () => {
    const result = sortRecordings(recordings, { key: 'size', direction: 'desc' }, new Map())
    expect(result[0].size).toBe(300)
    expect(result[2].size).toBe(100)
  })

  it('tri par speechScore avec scores', () => {
    const scores = new Map([
      ['k1', { score: 50 }],
      ['k2', { score: 90 }],
      ['k3', { score: 70 }],
    ])
    const result = sortRecordings(recordings, { key: 'speechScore', direction: 'desc' }, scores)
    expect(result[0].key).toBe('k2')
    expect(result[1].key).toBe('k3')
    expect(result[2].key).toBe('k1')
  })

  it('tri par speechScore utilise -1 pour scores manquants', () => {
    const scores = new Map([['k1', { score: 50 }]])
    const result = sortRecordings(recordings, { key: 'speechScore', direction: 'asc' }, scores)
    expect(result[0].key).not.toBe('k1')
  })

  it('retourne vide pour tableau vide', () => {
    expect(sortRecordings([], { key: 'date', direction: 'asc' }, new Map())).toEqual([])
  })

  it('retourne vide pour null', () => {
    expect(sortRecordings(null, { key: 'date', direction: 'asc' }, new Map())).toEqual([])
  })

  it('ne modifie pas le tableau original', () => {
    const original = [...recordings]
    sortRecordings(recordings, { key: 'filename', direction: 'asc' }, new Map())
    expect(recordings).toEqual(original)
  })
})

describe('filterEcouteUsers', () => {
  const users = [
    makeUser('1', 'Jean', 'Dupont', 'commercial', 'ACTIF'),
    makeUser('2', 'Marie', 'Martin', 'manager', 'ACTIF'),
    makeUser('3', 'Paul', 'Durand', 'commercial', 'INACTIF'),
    makeUser('4', 'Sophie', 'Bernard', 'manager', 'ACTIF'),
  ]

  const alwaysOnline = () => true
  const neverOnline = () => false
  const onlyUser1Online = (id) => id === '1'

  it('retourne tout sans filtres actifs', () => {
    const result = filterEcouteUsers(users, '', false, alwaysOnline, 'ALL')
    expect(result).toHaveLength(4)
  })

  it('filtre par nom (case insensitive)', () => {
    const result = filterEcouteUsers(users, 'dupont', false, alwaysOnline, 'ALL')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('filtre par prenom', () => {
    const result = filterEcouteUsers(users, 'marie', false, alwaysOnline, 'ALL')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })

  it('filtre par statut', () => {
    const result = filterEcouteUsers(users, '', false, alwaysOnline, 'INACTIF')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('3')
  })

  it('filtre par online quand showOnlyOnline=true', () => {
    const result = filterEcouteUsers(users, '', true, onlyUser1Online, 'ALL')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('ignore online quand showOnlyOnline=false', () => {
    const result = filterEcouteUsers(users, '', false, neverOnline, 'ALL')
    expect(result).toHaveLength(4)
  })

  it('combine tous les filtres', () => {
    const result = filterEcouteUsers(users, 'jean', true, alwaysOnline, 'ACTIF')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('retourne vide si aucun match', () => {
    const result = filterEcouteUsers(users, 'xyz', false, alwaysOnline, 'ALL')
    expect(result).toHaveLength(0)
  })

  it('retourne vide pour users null', () => {
    expect(filterEcouteUsers(null, '', false, alwaysOnline, 'ALL')).toEqual([])
  })

  it('gère users avec nom/prenom undefined', () => {
    const partial = [{ id: '5', status: 'ACTIF', userType: 'commercial' }]
    const result = filterEcouteUsers(partial, 'test', false, alwaysOnline, 'ALL')
    expect(result).toHaveLength(0)
  })
})
