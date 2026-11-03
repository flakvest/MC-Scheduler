import { describe, expect, it } from 'vitest'
import { finishSetupBlocker, loadRegion4ExampleData, normalizePositionCode, parseOperatorShiftLimit } from './regionSetup'
import { emptySchedulerData, region4ExamplePositions, type SchedulerData } from './schedulerTypes'

const data = (overrides: Partial<SchedulerData> = {}): SchedulerData => ({
  ...emptySchedulerData(),
  setupComplete: false,
  ...overrides,
})

describe('finish setup validation', () => {
  it('requires a region name and at least one position', () => {
    expect(finishSetupBlocker(data())).toBe('Enter a region name and add at least one position before finishing setup.')
    expect(finishSetupBlocker(data({ regionName: 'Region 4' }))).toBe('Add at least one position, or load the Region 4 example, before finishing setup.')
    expect(finishSetupBlocker(data({ positions: region4ExamplePositions() }))).toBe('Enter a region name before finishing setup.')
    expect(finishSetupBlocker(data({
      regionName: ' Army MARS Region 4 ',
      positions: region4ExamplePositions(),
    }))).toBeNull()
  })

  it('rejects a position code that is not letters, numbers, or hyphens', () => {
    expect(normalizePositionCode(' dw-1 ')).toEqual({ code: 'DW-1' })
    expect(normalizePositionCode('DW:1').error).toBe('Position code must use only letters, numbers, or hyphens, up to 12 characters.')
    expect(normalizePositionCode('NET ONE').error).toBe('Position code must use only letters, numbers, or hyphens, up to 12 characters.')
  })
})

describe('operator shift limits', () => {
  it('treats a blank field as the region default and 0 as no limit', () => {
    expect(parseOperatorShiftLimit('', 31, 'Max shifts per month')).toEqual({})
    expect(parseOperatorShiftLimit('  ', 31, 'Max shifts per month')).toEqual({})
    expect(parseOperatorShiftLimit('0', 31, 'Max shifts per month')).toEqual({ limit: 0 })
    expect(parseOperatorShiftLimit('5', 31, 'Max shifts per month')).toEqual({ limit: 5 })
    expect(parseOperatorShiftLimit('32', 31, 'Max shifts per month').error).toBe('Max shifts per month must be a whole number from 0 to 31, or blank.')
    expect(parseOperatorShiftLimit('1.5', 14, 'Max daily shifts per rolling week').error).toBe('Max daily shifts per rolling week must be a whole number from 0 to 14, or blank.')
  })
})

describe('Region 4 example', () => {
  it('asks the caller to confirm by replacing seats and dropping orphaned assignments', () => {
    const loaded = loadRegion4ExampleData(data({
      regionName: 'Region 4',
      positions: [
        { name: 'NET', shortName: 'NET', displayName: 'Net', type: 'fixed', assignmentPeriod: 'daily', channel: '', sortOrder: 1 },
      ],
      operators: [{
        callsign: 'ALPHA',
        ale: true,
        unavailable: [],
        positionPermissions: { NET: true },
      }],
      schedule: {
        '2026-04-01': { coverage: true, assignments: { NET: 'ALPHA', EXD: 'ALPHA' } },
      },
    }))

    expect(loaded.positions.map((position) => position.name)).toEqual(['EXD', 'DW', 'DR'])
    expect(loaded.schedule['2026-04-01'].assignments).toEqual({ EXD: 'ALPHA' })
    expect(loaded.operators[0].positionPermissions).toEqual({ EXD: true, DW: true, DR: true })
    expect(loaded.maxShiftsPerMonth).toBe(5)
    expect(loaded.maxShiftsPerWeek).toBe(2)
  })
})
