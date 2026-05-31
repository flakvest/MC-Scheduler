import { describe, expect, it } from 'vitest'
import { backupToJson, parseBackupJson } from './backupFiles'
import { defaultPositions, type SchedulerData } from './schedulerTypes'

const data: SchedulerData = {
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
  vacations: {},
  holidays: [],
  schedule: {
    '2026-04-01': {
      coverage: true,
      assignments: { EXD: 'ALPHA' },
    },
  },
}

describe('backup files', () => {
  it('round-trips the current backup format', () => {
    const parsed = parseBackupJson(backupToJson(data))

    expect(parsed).toEqual(data)
  })

  it('imports the legacy prototype backup format', () => {
    const parsed = parseBackupJson(JSON.stringify({
      operators: [
        {
          callsign: 'alpha',
          ale: true,
          unavailable: [2],
          canEXD: true,
          canDW: false,
          canDR: true,
        },
      ],
      positions: defaultPositions,
      vacations: {
        alpha: [{ start: '2026-04-03', end: '2026-04-05' }],
      },
      schedule: {
        '2026-04-01': {
          coverage: true,
          exd: 'alpha',
          dw: 'bravo',
        },
      },
    }))

    expect(parsed.operators[0].callsign).toBe('ALPHA')
    expect(parsed.operators[0].positionPermissions.DW).toBe(false)
    expect(parsed.vacations.ALPHA[0].start).toBe('2026-04-03')
    expect(parsed.schedule['2026-04-01'].assignments.EXD).toBe('ALPHA')
    expect(parsed.schedule['2026-04-01'].assignments.DW).toBe('BRAVO')
  })

  it('rejects non-object JSON', () => {
    expect(() => parseBackupJson('[]')).toThrow('Backup file is not a JSON object.')
  })
})
