import { describe, expect, it } from 'vitest'
import { clearAssignmentsForMonth, createMonthSnapshot, monthHasAssignments } from './monthTools'
import { parseBackupJson } from './backupFiles'
import { defaultPositions, type SchedulerData } from './schedulerTypes'

const baseData: SchedulerData = {
  version: 1,
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

    expect(parsed.version).toBe(1)
    expect(parsed.schedule).toEqual({
      '2026-04-01': { coverage: true, assignments: { EXD: 'ALPHA', DW: 'ALPHA' } },
      '2026-04-15': { coverage: false, assignments: { DR: 'ALPHA' } },
    })
    expect(parsed.operators).toEqual(baseData.operators)
    expect(parsed.positions).toEqual(baseData.positions)
    expect(parsed.vacations).toEqual(baseData.vacations)
  })
})
