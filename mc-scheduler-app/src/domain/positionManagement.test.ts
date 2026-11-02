import { describe, expect, it } from 'vitest'
import { deletePosition, editPosition } from './positionManagement'
import { defaultPositions, type SchedulerData } from './schedulerTypes'

const schedulerData = (overrides: Partial<SchedulerData> = {}): SchedulerData => ({
  version: 2,
  regionName: '',
  setupComplete: true,
  operators: [
    {
      callsign: 'ALPHA',
      ale: true,
      unavailable: [],
      positionPermissions: { EXD: true, DW: true, DR: true },
    },
  ],
  positions: defaultPositions,
  vacations: {},
  holidays: [],
  schedule: {
    '2026-04-01': { coverage: true, assignments: { EXD: 'ALPHA', DW: 'ALPHA' } },
    '2026-04-02': { coverage: true, assignments: { DR: 'ALPHA' } },
  },
  ...overrides,
})

describe('position management', () => {
  it('blocks code/name changes without explicit confirmation', () => {
    const data = schedulerData()

    const result = editPosition(data, {
      positionCode: 'DW',
      updates: { name: 'DESK-WEST' },
    })

    expect(result.errors).toEqual(['Position code/name change requires explicit confirmation.'])
    expect(result.data).toBe(data)
  })

  it('allows code rename with explicit confirmation and remaps assignments/permissions', () => {
    const data = schedulerData()

    const result = editPosition(data, {
      positionCode: 'DW',
      updates: { name: 'DWC', displayName: 'DWC' },
      options: { allowCodeOrNameChange: true },
    })

    expect(result.errors).toEqual([])
    expect(result.data.positions.find((position) => position.name === 'DWC')).toBeTruthy()
    expect(result.data.schedule['2026-04-01'].assignments.DWC).toBe('ALPHA')
    expect(result.data.schedule['2026-04-01'].assignments.DW).toBeUndefined()
    expect(result.data.operators[0].positionPermissions.DWC).toBe(true)
    expect(result.data.operators[0].positionPermissions.DW).toBeUndefined()
  })

  it('blocks renaming a position to an existing code', () => {
    const data = schedulerData()

    const result = editPosition(data, {
      positionCode: 'DW',
      updates: { name: 'DR', displayName: 'DR' },
      options: { allowCodeOrNameChange: true },
    })

    expect(result.errors).toEqual(['Position already exists.'])
    expect(result.data).toBe(data)
  })

  it('rejects a channel name that is not four letters or numbers', () => {
    const data = schedulerData()

    const result = editPosition(data, {
      positionCode: 'DW',
      updates: { channel: '12' },
    })

    expect(result.errors).toEqual(['Channel name must be exactly 4 letters or numbers, such as AB12.'])
    expect(result.data).toBe(data)
  })

  it('stores a valid channel name in uppercase', () => {
    const data = schedulerData()

    const result = editPosition(data, {
      positionCode: 'DW',
      updates: { channel: 'ab12' },
    })

    expect(result.errors).toEqual([])
    expect(result.data.positions.find((position) => position.name === 'DW')?.channel).toBe('AB12')
  })

  it('returns error for unknown position edit/delete requests', () => {
    const data = schedulerData()

    const editResult = editPosition(data, {
      positionCode: 'NOPE',
      updates: { displayName: 'NOPE' },
    })
    const deleteResult = deletePosition(data, 'NOPE')

    expect(editResult.errors).toEqual(['Position does not exist.'])
    expect(deleteResult.errors).toEqual(['Position does not exist.'])
  })

  it('deletes a position and removes related assignments/permissions', () => {
    const data = schedulerData()

    const result = deletePosition(data, 'DR')

    expect(result.errors).toEqual([])
    expect(result.data.positions.some((position) => position.name === 'DR')).toBe(false)
    expect(result.data.schedule['2026-04-02'].assignments.DR).toBeUndefined()
    expect(result.data.operators[0].positionPermissions.DR).toBeUndefined()
  })
})
