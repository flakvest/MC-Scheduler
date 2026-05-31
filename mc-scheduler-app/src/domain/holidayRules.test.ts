import { describe, expect, it, vi } from 'vitest'
import {
  applyHolidaysToData,
  fetchFederalHolidays,
  generateFederalHolidays,
  normalizeHolidays,
  uniqueHolidays,
} from './holidayRules'
import { defaultPositions, type SchedulerData } from './schedulerTypes'

const schedulerData = (overrides: Partial<SchedulerData> = {}): SchedulerData => ({
  version: 1,
  operators: [],
  positions: defaultPositions,
  vacations: {},
  holidays: [],
  schedule: {},
  ...overrides,
})

describe('holiday rules', () => {
  it('generates federal holidays offline for a year', () => {
    const holidays = generateFederalHolidays(2026)

    expect(holidays).toContainEqual({
      date: '2026-01-01',
      name: "New Year's Day",
      source: 'generated',
    })
    expect(holidays).toContainEqual({
      date: '2026-07-03',
      name: 'Independence Day',
      source: 'generated',
    })
    expect(holidays).toHaveLength(11)
  })

  it('normalizes stored holiday data safely', () => {
    const holidays = normalizeHolidays([
      { date: '2026-07-04', name: '  Independence   Day  ', source: 'lookup' },
      { date: 'bad-date', name: 'Broken', source: 'lookup' },
      { date: '2026-12-25', name: '', source: 'generated' },
      { date: '2026-11-11', name: 'Veterans Day', source: 'unknown' },
    ])

    expect(holidays).toEqual([
      { date: '2026-07-04', name: 'Independence Day', source: 'lookup' },
      { date: '2026-11-11', name: 'Veterans Day', source: 'manual' },
    ])
  })

  it('prefers manual or lookup entries over generated entries for the same date', () => {
    const holidays = uniqueHolidays([
      { date: '2026-07-03', name: 'Independence Day', source: 'generated' },
      { date: '2026-07-03', name: 'Office Closed', source: 'manual' },
    ])

    expect(holidays).toEqual([
      { date: '2026-07-03', name: 'Office Closed', source: 'manual' },
    ])
  })

  it('turns holiday dates off and clears assignments in scheduler data', () => {
    const result = applyHolidaysToData(schedulerData({
      holidays: [{ date: '2026-07-03', name: 'Independence Day', source: 'manual' }],
      schedule: {
        '2026-07-03': { coverage: true, assignments: { EXD: 'ALPHA', DW: 'BRAVO' } },
      },
    }))

    expect(result.schedule['2026-07-03']).toEqual({
      coverage: false,
      assignments: {},
    })
  })

  it('parses internet lookup results into local holiday entries', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => [
        { date: '2026-01-01', localName: "New Year's Day", global: true },
        { date: '2026-07-04', localName: 'Independence Day', global: true },
        { date: '2026-01-19', name: 'Martin Luther King, Jr. Day', global: true },
        { date: '2026-02-01', localName: 'State Only', global: false },
      ],
    })))

    const holidays = await fetchFederalHolidays(2026)

    expect(holidays).toEqual([
      { date: '2026-01-01', name: "New Year's Day", source: 'lookup' },
      { date: '2026-01-19', name: 'Martin Luther King, Jr. Day', source: 'lookup' },
      { date: '2026-07-03', name: 'Independence Day', source: 'lookup' },
    ])
    expect(fetch).toHaveBeenCalledWith('https://date.nager.at/api/v3/PublicHolidays/2026/US')

    vi.unstubAllGlobals()
  })
})
