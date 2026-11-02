import { describe, expect, it } from 'vitest'
import { parseBackupJson } from './backupFiles'
import { canAssignOperator } from './schedulerRules'
import { migrateSchedulerData, normalizeChannel } from './schedulerMigration'
import { emptySchedulerData, region4ExamplePositions, type SchedulerData } from './schedulerTypes'

const dw = region4ExamplePositions()[1]

const base = (positions = region4ExamplePositions()): SchedulerData => ({
  version: 2,
  regionName: '',
  setupComplete: true,
  backToBackPolicy: 'avoid',
  weekStartsOn: 1,
  maxShiftsPerMonth: 5,
  maxShiftsPerWeek: 2,
  operators: [
    {
      callsign: 'ALPHA',
      ale: true,
      unavailable: [],
      positionPermissions: { EXD: true, NET1: true, NET2: false },
    },
    {
      callsign: 'BRAVO',
      ale: false,
      unavailable: [],
      positionPermissions: { EXD: false, NET1: true, NET2: true },
    },
  ],
  positions,
  vacations: {},
  holidays: [],
  schedule: {
    '2026-04-01': { coverage: true, assignments: {} },
    '2026-04-02': { coverage: true, assignments: { EXD: 'ALPHA' } },
  },
})

describe('schema v2 migration', () => {
  it('keeps Region 4 assignments and maps ALE from requiresALE', () => {
    const migrated = migrateSchedulerData({
      version: 1,
      operators: [
        {
          callsign: 'n0call',
          ale: true,
          unavailable: [1],
          positionPermissions: { EXD: true, DW: true, DR: false },
        },
      ],
      positions: [
        { name: 'EXD', shortName: 'EXD', requiresALE: true },
        { name: 'DW', shortName: 'DW', requiresALE: false },
        { name: 'DR', shortName: 'DR', requiresALE: false },
      ],
      vacations: { n0call: [{ start: '2026-05-01', end: '2026-05-03' }] },
      holidays: [{ date: '2026-07-03', name: 'Office Closed', source: 'manual' }],
      schedule: {
        '2026-04-01': { coverage: true, assignments: { EXD: 'N0CALL', DW: 'N0CALL' } },
        '2026-04-02': { coverage: true, assignments: { DR: 'N0CALL' } },
      },
    })

    expect(migrated.migrated).toBe(true)
    expect(migrated.data.version).toBe(2)
    expect(migrated.data.setupComplete).toBe(true)
    expect(migrated.data.positions.map((position) => [position.name, position.type, position.channel, position.assignmentPeriod])).toEqual([
      ['EXD', 'ale', '', 'daily'],
      ['DW', 'fixed', '', 'daily'],
      ['DR', 'fixed', '', 'daily'],
    ])
    expect(migrated.data.backToBackPolicy).toBe('avoid')
    expect(migrated.data.weekStartsOn).toBe(1)
    expect(migrated.data.operators[0]).toMatchObject({ callsign: 'N0CALL', ale: true })
    expect(migrated.data.schedule['2026-04-01'].assignments).toEqual({ EXD: 'N0CALL', DW: 'N0CALL' })
    expect(migrated.data.schedule['2026-04-02'].assignments.DR).toBe('N0CALL')
    expect(migrated.data.vacations.N0CALL[0].start).toBe('2026-05-01')
    expect(migrated.data.holidays[0].name).toBe('Office Closed')
  })

  it('leaves channel empty when older data has no channel', () => {
    const migrated = migrateSchedulerData({
      version: 1,
      operators: [],
      positions: [{ name: 'DW', shortName: 'DW', requiresALE: false }],
      schedule: {},
    })

    expect(migrated.data.positions[0].channel).toBe('')
  })
})

describe('channel names', () => {
  it('accepts four letters or numbers and rejects anything else', () => {
    expect(normalizeChannel(' ab12 ')).toEqual({ channel: 'AB12' })
    expect(normalizeChannel('')).toEqual({ channel: '' })
    expect(normalizeChannel('ABC')).toEqual({
      channel: '',
      error: 'Channel name must be exactly 4 letters or numbers, such as AB12.',
    })
    expect(normalizeChannel('AB-1')).toEqual({
      channel: '',
      error: 'Channel name must be exactly 4 letters or numbers, such as AB12.',
    })
  })
})

describe('multiple ALE seats', () => {
  const aleSeats = [
    { name: 'EXD', shortName: 'EXD', displayName: 'EXD', type: 'ale' as const, assignmentPeriod: 'daily' as const, channel: '', sortOrder: 1 },
    { name: 'NET1', shortName: 'NET1', displayName: 'Net One', type: 'fixed' as const, assignmentPeriod: 'daily' as const, channel: 'A1B2', sortOrder: 2 },
    { name: 'ALE2', shortName: 'ALE2', displayName: 'Second ALE', type: 'ale' as const, assignmentPeriod: 'daily' as const, channel: '', sortOrder: 3 },
  ]

  it('requires ALE qualification for every ALE seat and still allows only one seat per day', () => {
    const data = base(aleSeats)

    expect(canAssignOperator(data, '2026-04-01', aleSeats[0], 'BRAVO').allowed).toBe(false)
    expect(canAssignOperator(data, '2026-04-01', aleSeats[2], 'BRAVO').allowed).toBe(false)
    expect(canAssignOperator(data, '2026-04-01', aleSeats[2], 'ALPHA').allowed).toBe(true)
    expect(canAssignOperator(data, '2026-04-01', aleSeats[1], 'BRAVO').allowed).toBe(true)

    const taken = {
      ...data,
      schedule: {
        ...data.schedule,
        '2026-04-01': { coverage: true, assignments: { NET1: 'ALPHA' } },
      },
    }
    expect(canAssignOperator(taken, '2026-04-01', aleSeats[0], 'ALPHA').allowed).toBe(false)
  })

  it('uses DW only as data, not as a special rule', () => {
    const data = base()
    expect(canAssignOperator(data, '2026-04-01', dw, 'BRAVO').allowed).toBe(true)
  })
})

describe('legacy Big Top Delta import', () => {
  it('maps Big Top Delta assignments and qualification onto EXD', () => {
    const parsed = parseBackupJson(JSON.stringify({
      operators: [{ callsign: 'alpha', canBIGTOPDELTA: true }],
      positions: [{ name: 'BIGTOPDELTA', shortName: 'BIGTOPDELTA', requiresALE: true }],
      schedule: {
        '2026-04-01': { coverage: true, bigtopdelta: 'alpha' },
      },
    }))

    expect(parsed.positions[0].name).toBe('EXD')
    expect(parsed.positions[0].type).toBe('ale')
    expect(parsed.positions[0].assignmentPeriod).toBe('daily')
    expect(parsed.operators[0].ale).toBe(true)
    expect(parsed.backToBackPolicy).toBe('avoid')
    expect(parsed.weekStartsOn).toBe(1)
    expect(parsed.schedule['2026-04-01'].assignments.EXD).toBe('ALPHA')
  })

  it('treats canEXD from the old HTML backup as ALE qualified when ale is missing', () => {
    const parsed = parseBackupJson(JSON.stringify({
      operators: [{ callsign: 'alpha', canEXD: true }],
      positions: [{ name: 'EXD', shortName: 'EXD', requiresALE: true }],
      schedule: {
        '2026-04-01': { coverage: true, exd: 'alpha' },
      },
    }))

    expect(parsed.operators[0].ale).toBe(true)
    expect(parsed.operators[0].positionPermissions.EXD).toBe(true)
    expect(parsed.maxShiftsPerMonth).toBe(5)
    expect(parsed.maxShiftsPerWeek).toBe(2)
  })
})

describe('scheduling rule defaults', () => {
  it('keeps an older file on daily seats, avoid back-to-back, and Monday even if it claims otherwise', () => {
    const migrated = migrateSchedulerData({
      version: 1,
      backToBackPolicy: 'allow',
      weekStartsOn: 0,
      operators: [],
      positions: [{ name: 'EXD', shortName: 'EXD', requiresALE: true, assignmentPeriod: 'weekly' }],
      schedule: {},
    })

    expect(migrated.data.backToBackPolicy).toBe('avoid')
    expect(migrated.data.weekStartsOn).toBe(1)
    expect(migrated.data.maxShiftsPerMonth).toBe(5)
    expect(migrated.data.maxShiftsPerWeek).toBe(2)
    expect(migrated.data.positions[0].assignmentPeriod).toBe('daily')
  })

  it('keeps a current file that turns the shift limits off', () => {
    const migrated = migrateSchedulerData({
      version: 2,
      maxShiftsPerMonth: 0,
      maxShiftsPerWeek: 0,
      operators: [{ callsign: 'ALPHA', ale: true, maxShiftsPerMonth: 1, maxShiftsPerWeek: 0 }],
      positions: [],
      schedule: {},
    })

    expect(migrated.data.maxShiftsPerMonth).toBe(0)
    expect(migrated.data.maxShiftsPerWeek).toBe(0)
    expect(migrated.data.operators[0]).toMatchObject({ maxShiftsPerMonth: 1, maxShiftsPerWeek: 0 })
  })

  it('keeps a current file that allows back-to-back and uses a weekly seat', () => {
    const migrated = migrateSchedulerData({
      version: 2,
      backToBackPolicy: 'allow',
      weekStartsOn: 0,
      setupComplete: true,
      operators: [],
      positions: [{
        name: 'EXD',
        shortName: 'EXD',
        displayName: 'EXD',
        type: 'ale',
        assignmentPeriod: 'weekly',
        channel: '',
        sortOrder: 1,
      }],
      schedule: {},
    })

    expect(migrated.migrated).toBe(false)
    expect(migrated.data.backToBackPolicy).toBe('allow')
    expect(migrated.data.weekStartsOn).toBe(0)
    expect(migrated.data.positions[0].assignmentPeriod).toBe('weekly')
  })

  it('fills a current month file that has no scheduling rules with daily, avoid, and Monday', () => {
    const parsed = parseBackupJson(JSON.stringify({
      version: 2,
      operators: [],
      positions: [{ name: 'DW', shortName: 'DW', displayName: 'DeltaWhite', type: 'fixed', channel: '', sortOrder: 2 }],
      schedule: { '2026-04-06': { coverage: true, assignments: { DW: 'ALPHA' } } },
    }))

    expect(parsed.backToBackPolicy).toBe('avoid')
    expect(parsed.weekStartsOn).toBe(1)
    expect(parsed.positions[0].assignmentPeriod).toBe('daily')
    expect(parsed.schedule['2026-04-06'].assignments.DW).toBe('ALPHA')
  })

  it('loads the Region 4 example as daily seats under the avoid and Monday defaults', () => {
    expect(region4ExamplePositions().map((position) => position.assignmentPeriod)).toEqual(['daily', 'daily', 'daily'])
    expect(emptySchedulerData()).toMatchObject({
      backToBackPolicy: 'avoid',
      weekStartsOn: 1,
  maxShiftsPerMonth: 5,
  maxShiftsPerWeek: 2,
      positions: [],
    })
  })
})
