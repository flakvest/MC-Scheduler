import ICAL from 'ical.js'
import { describe, expect, it } from 'vitest'
import { calendarExportFilename, generateScheduleIcs } from './calendarExport'
import { emptySchedulerData, region4ExamplePositions, type SchedulerData } from './schedulerTypes'

const now = new Date(Date.UTC(2026, 10, 3, 1, 6, 0))
const encoder = new TextEncoder()

const data = (overrides: Partial<SchedulerData> = {}): SchedulerData => ({
  ...emptySchedulerData(),
  setupComplete: true,
  regionName: 'Army MARS Region 4',
  positions: region4ExamplePositions().map((position) => (
    position.name === 'DW' ? { ...position, channel: 'AB12' } : position
  )),
  ...overrides,
})

const eventsOf = (ics: string) => {
  const component = new ICAL.Component(ICAL.parse(ics))
  return component.getAllSubcomponents('vevent').map((item) => new ICAL.Event(item))
}

describe('calendar export', () => {
  it('writes an empty but valid calendar', () => {
    const ics = generateScheduleIcs(data(), { now })

    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/)
    expect(ics.replaceAll('\r\n', '\n')).toContain('BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MARS Message Center//MC Scheduler//EN')
    expect(ics).toContain('METHOD:PUBLISH')
    expect(ics).toContain('X-WR-CALNAME:Army MARS Region 4 MC Schedule')
    expect(eventsOf(ics)).toEqual([])
  })

  it('writes one all-day event per assignment and keeps a stable UID', () => {
    const schedule = data({
      schedule: {
        '2026-04-01': { coverage: true, assignments: { EXD: 'ALPHA', DW: 'BRAVO', DR: '' } },
        '2026-04-02': { coverage: false, assignments: { EXD: 'ALPHA' } },
        '2026-03-31': { coverage: true, assignments: { EXD: 'ALPHA' } },
      },
    })

    const first = generateScheduleIcs(schedule, { now })
    const second = generateScheduleIcs(schedule, { now })
    const events = eventsOf(first)

    expect(first).toBe(second)
    expect(events.map((event) => event.uid)).toEqual([
      '2026-03-31-EXD-ALPHA@com.marsmessagecenter.scheduler',
      '2026-04-01-EXD-ALPHA@com.marsmessagecenter.scheduler',
      '2026-04-01-DW-BRAVO@com.marsmessagecenter.scheduler',
    ])
    expect(events[1].summary).toBe('EXD – ALPHA')
    expect(events[1].description).toContain('Position: EXD')
    expect(events[1].description).toContain('Region: Army MARS Region 4')
    expect(events[2].summary).toBe('DW – BRAVO')
    expect(events[2].description).toContain('Channel: AB12')
    expect(events[2].description).toContain('Position: DeltaWhite')
    expect(events[0].startDate.toString()).toContain('2026-03-31')
    expect(events[0].endDate.toString()).toContain('2026-04-01')
    expect(events[1].startDate.isDate).toBe(true)
  })

  it('expands a weekly seat into one event per stored coverage day', () => {
    const assignments = Object.fromEntries(
      ['2026-04-06', '2026-04-07', '2026-04-08', '2026-04-09', '2026-04-10'].map((date) => [
        date,
        { coverage: true, assignments: { EXD: 'ALPHA' } },
      ]),
    )
    const events = eventsOf(generateScheduleIcs(data({
      positions: region4ExamplePositions().map((position) => (
        position.name === 'EXD' ? { ...position, assignmentPeriod: 'weekly' as const } : position
      )),
      schedule: assignments,
    }), { now }))

    expect(events).toHaveLength(5)
    expect(events.map((event) => event.summary)).toEqual(Array(5).fill('EXD – ALPHA'))
    expect(new Set(events.map((event) => event.uid)).size).toBe(5)
  })

  it('escapes text and folds lines at 75 octets', () => {
    const region = `North, East; West\\Base\nDesk ${'A'.repeat(80)}`
    const ics = generateScheduleIcs(data({
      regionName: region,
      schedule: {
        '2026-04-01': { coverage: true, assignments: { EXD: 'ALPHA' } },
      },
    }), { now })

    ics.split('\r\n').forEach((line) => {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    })
    const event = eventsOf(ics)[0]
    expect(event.description).toContain('North, East; West\\Base')
    expect(event.description).toContain('Desk')
    expect(ics).toContain('\\,')
    expect(ics).toContain('\\;')
    expect(ics).toContain('\\\\')
    expect(ics).toContain('\\n')
  })

  it('can limit the file to one month or one operator', () => {
    const schedule = data({
      schedule: {
        '2026-04-01': { coverage: true, assignments: { EXD: 'ALPHA', DW: 'BRAVO' } },
        '2026-05-01': { coverage: true, assignments: { EXD: 'ALPHA' } },
      },
    })

    expect(eventsOf(generateScheduleIcs(schedule, { now, month: '2026-04' }))).toHaveLength(2)
    expect(eventsOf(generateScheduleIcs(schedule, { now, operator: 'bravo' })).map((event) => event.summary)).toEqual([
      'DW – BRAVO',
    ])
  })

  it('names the file from the region and the export date', () => {
    expect(calendarExportFilename('Army MARS Region 4', new Date(2026, 10, 3))).toBe('army-mars-region-4-schedule-2026-11-03.ics')
    expect(calendarExportFilename('   ', new Date(2026, 0, 2))).toBe('mars-schedule-2026-01-02.ics')
  })
})
