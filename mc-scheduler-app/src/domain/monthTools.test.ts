import { describe, expect, it } from 'vitest'
import { clearAssignmentsForMonth, createMonthSnapshot, monthHasAssignments } from './monthTools'
import { parseBackupJson } from './backupFiles'
import { defaultPositions, type SchedulerData } from './schedulerTypes'

const baseData: SchedulerData = {
  version: 2,
  regionName: '',
  setupComplete: true,
  backToBackPolicy: 'avoid',
  weekStartsOn: 1,
  operators: [
    {
      callsign: 'ALPHA',
      ale: true,
      unavailable: [1],
      positionPermissions: { EXD: true, DW: true, DR: false },
    },
  ],
  positions: defaultPositions,
  vacations: {
    ALPHA: [{ start: '2026-04-10', end: '2026-04-12' }],
  },
  holidays: [],
  schedule: {
    '2026-04-01': {
      coverage: true,
      assignments: { EXD: 'ALPHA', DW: 'ALPHA' },
    },
    '2026-04-15': {
      coverage: false,
      assignments: { DR: 'ALPHA' },
    },
    '2026-05-01': {
      coverage: true,
      assignments: { EXD: 'ALPHA' },
    },
  },
}

describe('month tools', () => {
  it('clears assignments only for the selected month', () => {
    const cleared = clearAssignmentsForMonth(baseData, '2026-04')

    expect(cleared.operators).toBe(baseData.operators)
    expect(cleared.positions).toBe(baseData.positions)
    expect(cleared.vacations).toBe(baseData.vacations)
    expect(cleared.schedule['2026-04-01'].coverage).toBe(true)
    expect(cleared.schedule['2026-04-15'].coverage).toBe(false)
    expect(cleared.schedule['2026-04-01'].assignments).toEqual({})
    expect(cleared.schedule['2026-04-15'].assignments).toEqual({})
    expect(cleared.schedule['2026-05-01'].assignments).toEqual({ EXD: 'ALPHA' })
  })

  it('detects assignments only in the selected month', () => {
    expect(monthHasAssignments(baseData, '2026-04')).toBe(true)
    expect(monthHasAssignments(baseData, '2026-05')).toBe(true)
    expect(monthHasAssignments(baseData, '2026-06')).toBe(false)
  })

  it('handles empty month behavior for clear and snapshot', () => {
    const cleared = clearAssignmentsForMonth(baseData, '2026-06')
    const snapshot = createMonthSnapshot(baseData, '2026-06')

    expect(cleared).toEqual(baseData)
    expect(snapshot.schedule).toEqual({})
  })

  it('creates a JSON-compatible month snapshot/archive object', () => {
    const snapshot = createMonthSnapshot(baseData, '2026-04')
    const json = JSON.stringify(snapshot)
    const parsed = parseBackupJson(json)

    expect(parsed.version).toBe(2)
    expect(parsed.schedule).toEqual({
      '2026-04-01': { coverage: true, assignments: { EXD: 'ALPHA', DW: 'ALPHA' } },
      '2026-04-15': { coverage: false, assignments: { DR: 'ALPHA' } },
    })
    expect(parsed.operators).toEqual(baseData.operators)
    expect(parsed.positions).toEqual(baseData.positions)
    expect(parsed.vacations).toEqual(baseData.vacations)
    expect(parsed.backToBackPolicy).toBe('avoid')
    expect(parsed.weekStartsOn).toBe(1)
  })

  it('keeps a weekly seat and an allow back-to-back rule in a month snapshot', () => {
    const weekly = {
      ...baseData,
      backToBackPolicy: 'allow' as const,
      weekStartsOn: 0 as const,
      positions: baseData.positions.map((position) => (
        position.name === 'EXD' ? { ...position, assignmentPeriod: 'weekly' as const } : position
      )),
    }
    const parsed = parseBackupJson(JSON.stringify(createMonthSnapshot(weekly, '2026-04')))

    expect(parsed.backToBackPolicy).toBe('allow')
    expect(parsed.weekStartsOn).toBe(0)
    expect(parsed.positions.find((position) => position.name === 'EXD')?.assignmentPeriod).toBe('weekly')
    expect(parsed.schedule['2026-05-01']).toBeUndefined()
    expect(parsed.schedule['2026-04-01'].assignments.EXD).toBe('ALPHA')
  })
})
