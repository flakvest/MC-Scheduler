/// <reference types="node" />
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { defaultPositions, type Operator, type Schedule, type SchedulerData } from './schedulerTypes'
import { clearAssignmentsForMonth } from './monthTools'
import {
  assignOperator,
  canAssignOperator,
  ensureMonthSchedule,
  findOpenAssignmentIssues,
  getShiftCount,
  getWeeklyShiftCount,
  isOperatorAvailable,
  handPickShiftLimitWarnings,
  operatorsReplacedByWeeklyAssign,
  setCoverage,
  smartAssign,
  workedOnDate,
} from './schedulerRules'

const [exdPosition, dwPosition, drPosition] = defaultPositions

const operator = (callsign: string, ale = false): Operator => ({
  callsign,
  ale,
  unavailable: [],
  positionPermissions: {
    EXD: ale,
    DW: true,
    DR: true,
  },
})

const schedulerData = (overrides: Partial<SchedulerData> = {}): SchedulerData => ({
  version: 2,
  regionName: '',
  setupComplete: true,
  backToBackPolicy: 'avoid',
  weekStartsOn: 1,
  maxShiftsPerMonth: 5,
  maxShiftsPerWeek: 2,
  operators: [operator('ALPHA', true), operator('BRAVO'), operator('CHARLIE', true)],
  positions: defaultPositions,
  vacations: {},
  holidays: [],
  schedule: {
    '2026-04-01': { coverage: true, assignments: {} },
    '2026-04-02': { coverage: true, assignments: {} },
    '2026-04-03': { coverage: true, assignments: {} },
  },
  ...overrides,
})

describe('scheduler rules', () => {
  it('creates weekdays as coverage days and weekends as non-coverage days', () => {
    const schedule = ensureMonthSchedule({}, 2026, 4)

    expect(schedule['2026-04-01'].coverage).toBe(true)
    expect(schedule['2026-04-04'].coverage).toBe(false)
    expect(schedule['2026-04-05'].coverage).toBe(false)
  })

  it('turns holiday dates into non-coverage days and clears assignments', () => {
    const schedule = ensureMonthSchedule({
      '2026-04-03': { coverage: true, assignments: { EXD: 'ALPHA' } },
    }, 2026, 4, [
      { date: '2026-04-03', name: 'Test Holiday', source: 'manual' },
    ])

    expect(schedule['2026-04-03'].coverage).toBe(false)
    expect(schedule['2026-04-03'].assignments).toEqual({})
  })

  it('blocks operators on unavailable weekdays and vacation dates', () => {
    const data = schedulerData({
      operators: [{ ...operator('ALPHA', true), unavailable: [3] }, operator('BRAVO')],
      vacations: {
        BRAVO: [{ start: '2026-04-02', end: '2026-04-04' }],
      },
    })

    expect(isOperatorAvailable(data, 'ALPHA', '2026-04-01')).toBe(false)
    expect(isOperatorAvailable(data, 'BRAVO', '2026-04-03')).toBe(false)
    expect(isOperatorAvailable(data, 'BRAVO', '2026-04-06')).toBe(true)
  })

  it('enforces ALE and position permissions', () => {
    const data = schedulerData({
      operators: [
        operator('ALPHA', true),
        {
          ...operator('BRAVO'),
          positionPermissions: { EXD: false, DW: false, DR: true },
        },
      ],
    })

    expect(canAssignOperator(data, '2026-04-01', exdPosition, 'BRAVO').allowed).toBe(false)
    expect(canAssignOperator(data, '2026-04-01', dwPosition, 'BRAVO').allowed).toBe(false)
    expect(canAssignOperator(data, '2026-04-01', drPosition, 'BRAVO').allowed).toBe(true)
  })

  it('counts monthly shifts and detects work on a date', () => {
    const data = schedulerData({
      schedule: {
        '2026-04-01': { coverage: true, assignments: { EXD: 'ALPHA', DW: 'BRAVO' } },
        '2026-04-02': { coverage: true, assignments: { DR: 'ALPHA' } },
      },
    })

    expect(workedOnDate(data.schedule, data.positions, 'ALPHA', '2026-04-01')).toBe(true)
    expect(getShiftCount(data.schedule, data.positions, 'ALPHA', '2026-04')).toBe(2)
  })

  it('blocks back-to-back, duplicate same-day, monthly max, and weekly max assignments', () => {
    const baseData = schedulerData({
      schedule: {
        '2026-04-01': { coverage: true, assignments: { DW: 'ALPHA' } },
        '2026-04-02': { coverage: true, assignments: {} },
        '2026-04-03': { coverage: true, assignments: { DR: 'ALPHA' } },
      },
    })

    expect(canAssignOperator(baseData, '2026-04-01', drPosition, 'ALPHA').allowed).toBe(false)
    expect(canAssignOperator(baseData, '2026-04-02', dwPosition, 'ALPHA', {
      maxShifts: 10,
      preventBackToBack: true,
      limitWeekly: false,
    }).allowed).toBe(false)
    expect(canAssignOperator(baseData, '2026-04-02', dwPosition, 'ALPHA', {
      maxShifts: 2,
      preventBackToBack: false,
      limitWeekly: false,
    }).allowed).toBe(false)
    expect(canAssignOperator(baseData, '2026-04-02', dwPosition, 'ALPHA', {
      maxShifts: 10,
      preventBackToBack: false,
      maxShiftsPerWeek: 2,
    }).allowed).toBe(false)
    expect(getWeeklyShiftCount(baseData.schedule, baseData.positions, 'ALPHA', '2026-04-02')).toBe(2)
  })

  it('fills open shifts with eligible operators', () => {
    const data = schedulerData({
      schedule: {
        '2026-04-01': { coverage: true, assignments: {} },
      },
    })

    const result = smartAssign(data, {
      year: 2026,
      month: 4,
      maxShifts: 5,
      preventBackToBack: true,
      maxShiftsPerWeek: 2,
    })

    expect(result.assignedCount).toBeGreaterThan(0)
    expect(result.data.schedule['2026-04-01'].assignments.EXD).toBeTruthy()
    expect(result.data.schedule['2026-04-01'].assignments.DW).toBeTruthy()
    expect(result.data.schedule['2026-04-01'].assignments.DR).toBeTruthy()
    expect(result.issues.length).toBeGreaterThanOrEqual(0)
  })

  it('reports unfilled assignment issues when rules are too tight', () => {
    const data = schedulerData({
      operators: [operator('ALPHA', true)],
      schedule: {
        '2026-04-01': { coverage: true, assignments: { DW: 'ALPHA' } },
        '2026-04-02': { coverage: true, assignments: {} },
      },
    })

    const result = smartAssign(data, {
      year: 2026,
      month: 4,
      maxShifts: 1,
      preventBackToBack: true,
      maxShiftsPerWeek: 2,
    })

    expect(result.blockedCount).toBeGreaterThan(0)
    expect(result.issues[0].date).toBeTruthy()
    expect(result.issues[0].position).toBeTruthy()
    expect(result.issues[0].reason).toBeTruthy()
  })

  it('finds currently open assignment issues', () => {
    const data = schedulerData({
      operators: [],
      schedule: {
        '2026-04-01': { coverage: true, assignments: {} },
      },
    })

    const issues = findOpenAssignmentIssues(data, {
      year: 2026,
      month: 4,
      maxShifts: 5,
      preventBackToBack: true,
      maxShiftsPerWeek: 2,
    })

    expect(issues[0]).toEqual({
      date: '2026-04-01',
      position: 'EXD',
      reason: 'No operators exist.',
    })
  })

  it('can clear an existing manual assignment', () => {
    const data = schedulerData({
      schedule: {
        '2026-04-01': { coverage: true, assignments: { DW: 'ALPHA' } },
      },
    })

    const result = assignOperator(data, '2026-04-01', 'DW', '')

    expect(result.check.allowed).toBe(true)
    expect(result.data.schedule['2026-04-01'].assignments.DW).toBeUndefined()
  })

  it('clears assignments when coverage is turned off', () => {
    const data = schedulerData({
      schedule: {
        '2026-04-01': { coverage: true, assignments: { EXD: 'ALPHA', DW: 'BRAVO' } },
      },
    })

    const result = setCoverage(data, '2026-04-01', false)

    expect(result.schedule['2026-04-01'].coverage).toBe(false)
    expect(result.schedule['2026-04-01'].assignments).toEqual({})
  })
})

const backToBackOptions = {
  maxShifts: 10,
  preventBackToBack: true,
  maxShiftsPerWeek: 10,
}

const coveredMonth = (year: number, month: number, coverage = false): Schedule => {
  const days = new Date(year, month, 0).getDate()
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const schedule: Schedule = {}

  for (let day = 1; day <= days; day += 1) {
    schedule[`${prefix}-${String(day).padStart(2, '0')}`] = { coverage, assignments: {} }
  }

  return schedule
}

const namesOnDate = (data: SchedulerData, date: string) =>
  data.positions
    .map((position) => data.schedule[date]?.assignments[position.name])
    .filter((callsign): callsign is string => Boolean(callsign))

describe('no back-to-back looks at both neighboring days', () => {
  it('blocks the day before and the day after an existing shift', () => {
    const data = schedulerData({
      schedule: {
        '2026-04-01': { coverage: true, assignments: {} },
        '2026-04-02': { coverage: true, assignments: { DW: 'ALPHA' } },
        '2026-04-03': { coverage: true, assignments: {} },
      },
    })

    expect(canAssignOperator(data, '2026-04-01', dwPosition, 'ALPHA', backToBackOptions)).toEqual({
      allowed: false,
      reason: 'ALPHA already works the next day.',
    })
    expect(canAssignOperator(data, '2026-04-03', dwPosition, 'ALPHA', backToBackOptions)).toEqual({
      allowed: false,
      reason: 'Operator worked the previous day.',
    })
    expect(canAssignOperator(data, '2026-04-01', dwPosition, 'ALPHA').allowed).toBe(true)

    const manual = assignOperator(data, '2026-04-01', 'DW', 'ALPHA')
    expect(manual.check.allowed).toBe(true)
    expect(manual.data.schedule['2026-04-01'].assignments.DW).toBe('ALPHA')
  })

  it('leaves the only eligible seat open when that operator works the next day', () => {
    const data = schedulerData({
      operators: [operator('ALPHA', true), operator('BRAVO'), operator('CHARLIE')],
      schedule: {
        ...coveredMonth(2026, 4),
        '2026-04-01': { coverage: true, assignments: {} },
        '2026-04-02': { coverage: true, assignments: { EXD: 'ALPHA' } },
      },
    })

    const result = smartAssign(data, { year: 2026, month: 4, ...backToBackOptions })

    expect(result.data.schedule['2026-04-01'].assignments.EXD).toBeUndefined()
    expect(result.data.schedule['2026-04-02'].assignments.EXD).toBe('ALPHA')
    expect(namesOnDate(result.data, '2026-04-01')).not.toContain('ALPHA')
    expect(result.issues).toContainEqual(expect.objectContaining({
      date: '2026-04-01',
      position: 'EXD',
      reason: expect.stringContaining('ALPHA already works the next day.'),
    }))
  })

  it('does not give the last seat of a full day to the operator already working tomorrow', () => {
    const data = schedulerData({
      operators: [operator('ALPHA', true), operator('BRAVO', true), operator('CHARLIE', true)],
      schedule: {
        ...coveredMonth(2026, 4),
        '2026-04-01': { coverage: true, assignments: {} },
        '2026-04-02': { coverage: true, assignments: { EXD: 'ALPHA' } },
      },
    })

    const result = smartAssign(data, { year: 2026, month: 4, ...backToBackOptions })
    const aprilFirst = result.data.schedule['2026-04-01'].assignments

    expect(namesOnDate(result.data, '2026-04-01')).not.toContain('ALPHA')
    expect(aprilFirst.EXD).toBe('BRAVO')
    expect(aprilFirst.DW).toBe('CHARLIE')
    expect(aprilFirst.DR).toBeUndefined()
    expect(result.data.schedule['2026-04-02'].assignments.EXD).toBe('ALPHA')
    expect(result.issues).toContainEqual(expect.objectContaining({
      date: '2026-04-01',
      position: 'DR',
      reason: expect.stringContaining('ALPHA already works the next day.'),
    }))
  })

  it('does not schedule an operator on the day they return, directly before an existing shift', () => {
    const data = schedulerData({
      operators: [operator('ALPHA', true), operator('BRAVO', true), operator('CHARLIE', true)],
      vacations: { ALPHA: [{ start: '2026-04-01', end: '2026-04-13' }] },
      schedule: {
        '2026-04-14': { coverage: true, assignments: {} },
        '2026-04-15': { coverage: true, assignments: { DW: 'ALPHA' } },
      },
    })

    const result = smartAssign(data, {
      year: 2026,
      month: 4,
      maxShifts: 10,
      preventBackToBack: true,
      maxShiftsPerWeek: 2,
    })

    expect(result.data.schedule['2026-04-15'].assignments.DW).toBe('ALPHA')
    expect(namesOnDate(result.data, '2026-04-14')).not.toContain('ALPHA')
    expect(canAssignOperator(data, '2026-04-14', exdPosition, 'ALPHA', {
      maxShifts: 10,
      preventBackToBack: true,
      maxShiftsPerWeek: 2,
    }).reason).toBe('ALPHA already works the next day.')
  })

  it('still refuses the neighboring day after an unavailable day is cleared and Smart Assign runs again', () => {
    const wednesday = new Date('2026-04-01T00:00:00').getDay() as Operator['unavailable'][number]
    const data = schedulerData({
      operators: [
        { ...operator('ALPHA', true), unavailable: [wednesday] },
        operator('BRAVO', true),
        operator('CHARLIE', true),
      ],
      schedule: {
        ...coveredMonth(2026, 4),
        '2026-04-01': { coverage: true, assignments: {} },
        '2026-04-02': { coverage: true, assignments: { EXD: 'ALPHA' } },
      },
    })

    const first = smartAssign(data, { year: 2026, month: 4, ...backToBackOptions })
    expect(namesOnDate(first.data, '2026-04-01')).not.toContain('ALPHA')

    const availableAgain = {
      ...first.data,
      operators: first.data.operators.map((person) => (
        person.callsign === 'ALPHA' ? { ...person, unavailable: [] } : person
      )),
    }
    const second = smartAssign(availableAgain, { year: 2026, month: 4, ...backToBackOptions })

    expect(second.data.schedule['2026-04-02'].assignments.EXD).toBe('ALPHA')
    expect(namesOnDate(second.data, '2026-04-01')).not.toContain('ALPHA')
    expect(second.issues).toContainEqual(expect.objectContaining({
      date: '2026-04-01',
      reason: expect.stringContaining('ALPHA already works the next day.'),
    }))
  })

  it('keeps the month boundary clear when the later month was built first', () => {
    const operators = [operator('ALPHA', true), operator('BRAVO'), operator('CHARLIE')]
    const limits = { maxShifts: 23, preventBackToBack: true, maxShiftsPerWeek: 10 }
    const september = smartAssign(schedulerData({ operators, schedule: {} }), {
      year: 2026,
      month: 9,
      ...limits,
    })
    const august = smartAssign(september.data, {
      year: 2026,
      month: 8,
      ...limits,
    })

    expect(august.data.schedule['2026-09-01'].assignments.EXD).toBe('ALPHA')
    expect(august.data.schedule['2026-08-31'].assignments.EXD).toBeUndefined()
    expect(namesOnDate(august.data, '2026-08-31')).not.toContain('ALPHA')
    expect(august.issues).toContainEqual(expect.objectContaining({
      date: '2026-08-31',
      position: 'EXD',
      reason: expect.stringContaining('ALPHA already works the next day.'),
    }))
  })

  it('uses the same neighboring dates in US time zones and in time zones ahead of UTC', () => {
    const appRoot = fileURLToPath(new URL('../..', import.meta.url))
    const tempDir = mkdtempSync(join(tmpdir(), 'mc-scheduler-tz-'))
    const probePath = join(tempDir, 'probe.ts')
    const registerPath = join(tempDir, 'register.mjs')

    writeFileSync(join(tempDir, 'hooks.mjs'), timezoneResolveHook)
    writeFileSync(registerPath, "import { register } from 'node:module'\nregister('./hooks.mjs', import.meta.url)\n")
    writeFileSync(probePath, timezoneProbeSource.replaceAll('APP_ROOT', appRoot.replaceAll('\\', '/')))

    const zones = [
      'America/New_York',
      'America/Chicago',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Berlin',
      'Pacific/Auckland',
    ]

    try {
      for (const zone of zones) {
        const result = spawnSync(process.execPath, ['--experimental-strip-types', '--import', registerPath, probePath], {
          env: { ...process.env, TZ: zone },
          encoding: 'utf8',
        })

        expect(result.status, `${zone}\n${result.stdout}\n${result.stderr}`).toBe(0)
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})

const weekdaySchedule = (...months: number[]) =>
  months.reduce<Schedule>((schedule, month) => ensureMonthSchedule(schedule, 2026, month), {})

const weeklyExd = { ...exdPosition, assignmentPeriod: 'weekly' as const }

const openLimits = {
  maxShifts: 20,
  preventBackToBack: false,
  maxShiftsPerWeek: 10,
}

describe('back-to-back policy', () => {
  it('allows consecutive days when the policy is off and still keeps one seat per person per day', () => {
    const data = schedulerData({
      operators: [operator('ALPHA', true)],
      positions: [dwPosition],
      backToBackPolicy: 'allow',
      schedule: weekdaySchedule(4),
    })

    const allowed = smartAssign(data, { year: 2026, month: 4, ...openLimits })
    expect(allowed.data.schedule['2026-04-01'].assignments.DW).toBe('ALPHA')
    expect(allowed.data.schedule['2026-04-02'].assignments.DW).toBe('ALPHA')

    const blocked = smartAssign(data, { year: 2026, month: 4, ...openLimits, preventBackToBack: true })
    expect(blocked.data.schedule['2026-04-01'].assignments.DW).toBe('ALPHA')
    expect(blocked.data.schedule['2026-04-02'].assignments.DW).toBeUndefined()

    const sameDay = schedulerData({
      schedule: { '2026-04-01': { coverage: true, assignments: { EXD: 'ALPHA' } } },
    })
    expect(canAssignOperator(sameDay, '2026-04-01', dwPosition, 'ALPHA', openLimits)).toEqual({
      allowed: false,
      reason: 'Operator is already assigned that day.',
    })
  })

  it('still allows Friday and the following Monday when consecutive days are avoided', () => {
    const data = schedulerData({
      schedule: { '2026-04-03': { coverage: true, assignments: { DW: 'ALPHA' } } },
    })

    expect(canAssignOperator(data, '2026-04-06', dwPosition, 'ALPHA', {
      ...openLimits,
      preventBackToBack: true,
    }).allowed).toBe(true)
  })

  it('stops Check Issues from treating consecutive days as a problem when back-to-back is allowed', () => {
    const data = schedulerData({
      operators: [operator('ALPHA', true)],
      schedule: {
        '2026-04-01': { coverage: true, assignments: { DW: 'ALPHA' } },
        '2026-04-02': { coverage: true, assignments: {} },
      },
    })
    const limits = { year: 2026, month: 4, maxShifts: 10, maxShiftsPerWeek: 10 }

    const avoided = findOpenAssignmentIssues(data, { ...limits, preventBackToBack: true })
    const allowed = findOpenAssignmentIssues(data, { ...limits, preventBackToBack: false })
    const reasonFor = (issues: { date: string, position: string, reason: string }[]) =>
      issues.find((issue) => issue.date === '2026-04-02' && issue.position === 'DW')?.reason

    expect(reasonFor(avoided)).toContain('previous day')
    expect(reasonFor(allowed)).not.toContain('previous day')
  })
})

describe('weekly assignment', () => {
  it('gives one operator every coverage day in the week, including the days in the previous month', () => {
    const data = schedulerData({
      positions: [weeklyExd],
      weekStartsOn: 1,
  maxShiftsPerMonth: 5,
  maxShiftsPerWeek: 2,
      schedule: weekdaySchedule(3, 4),
    })

    const result = assignOperator(data, '2026-04-01', 'EXD', 'ALPHA')

    expect(result.check.allowed).toBe(true)
    expect(result.data.schedule['2026-03-30'].assignments.EXD).toBe('ALPHA')
    expect(result.data.schedule['2026-03-31'].assignments.EXD).toBe('ALPHA')
    expect(result.data.schedule['2026-04-01'].assignments.EXD).toBe('ALPHA')
    expect(result.data.schedule['2026-04-03'].assignments.EXD).toBe('ALPHA')
    expect(result.data.schedule['2026-04-04'].assignments.EXD).toBeUndefined()
    expect(result.data.schedule['2026-04-06'].assignments.EXD).toBeUndefined()

    const cleared = assignOperator(result.data, '2026-04-02', 'EXD', '')
    expect(cleared.data.schedule['2026-03-30'].assignments.EXD).toBeUndefined()
    expect(cleared.data.schedule['2026-04-03'].assignments.EXD).toBeUndefined()
  })

  it('groups a coverage Sunday with the previous week or the next week based on the week start', () => {
    const schedule = weekdaySchedule(3, 4)
    schedule['2026-04-05'] = { coverage: true, assignments: {} }
    const monday = assignOperator(schedulerData({
      positions: [weeklyExd],
      weekStartsOn: 1,
  maxShiftsPerMonth: 5,
  maxShiftsPerWeek: 2,
      schedule,
    }), '2026-04-03', 'EXD', 'ALPHA')
    const sunday = assignOperator(schedulerData({
      positions: [weeklyExd],
      weekStartsOn: 0,
      schedule,
    }), '2026-04-06', 'EXD', 'ALPHA')

    expect(monday.data.schedule['2026-04-05'].assignments.EXD).toBe('ALPHA')
    expect(monday.data.schedule['2026-04-06'].assignments.EXD).toBeUndefined()
    expect(sunday.data.schedule['2026-04-05'].assignments.EXD).toBe('ALPHA')
    expect(sunday.data.schedule['2026-04-10'].assignments.EXD).toBe('ALPHA')
    expect(sunday.data.schedule['2026-04-03'].assignments.EXD).toBeUndefined()
  })

  it('skips a holiday and a day marked off without splitting the rest of the week', () => {
    const schedule = weekdaySchedule(3, 4)
    schedule['2026-04-02'] = { coverage: false, assignments: {} }
    const offDay = assignOperator(schedulerData({
      positions: [weeklyExd],
      schedule,
    }), '2026-04-01', 'EXD', 'ALPHA')

    expect(offDay.data.schedule['2026-04-01'].assignments.EXD).toBe('ALPHA')
    expect(offDay.data.schedule['2026-04-02'].assignments.EXD).toBeUndefined()
    expect(offDay.data.schedule['2026-04-03'].assignments.EXD).toBe('ALPHA')

    const holiday = smartAssign(schedulerData({
      positions: [weeklyExd],
      operators: [operator('ALPHA', true)],
      holidays: [{ date: '2026-04-08', name: 'Office Closed', source: 'manual' }],
      backToBackPolicy: 'allow',
      schedule: weekdaySchedule(4),
    }), { year: 2026, month: 4, ...openLimits })

    expect(holiday.data.schedule['2026-04-06'].assignments.EXD).toBe('ALPHA')
    expect(holiday.data.schedule['2026-04-07'].assignments.EXD).toBe('ALPHA')
    expect(holiday.data.schedule['2026-04-08'].coverage).toBe(false)
    expect(holiday.data.schedule['2026-04-08'].assignments).toEqual({})
    expect(holiday.data.schedule['2026-04-09'].assignments.EXD).toBe('ALPHA')
    expect(holiday.data.schedule['2026-04-10'].assignments.EXD).toBe('ALPHA')
  })

  it('treats back-to-back as the previous or next week and leaves a split week alone', () => {
    const schedule = weekdaySchedule(3, 4)
    for (const date of ['2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27']) {
      schedule[date] = { coverage: true, assignments: { EXD: 'ALPHA' } }
    }
    const data = schedulerData({
      positions: [weeklyExd],
      operators: [operator('ALPHA', true), operator('BRAVO', true)],
      schedule,
    })

    const manual = assignOperator(data, '2026-04-01', 'EXD', 'ALPHA')
    expect(manual.check.allowed).toBe(true)
    expect(manual.data.schedule['2026-04-01'].assignments.EXD).toBe('ALPHA')

    const avoided = smartAssign(data, {
      year: 2026,
      month: 4,
      maxShifts: 20,
      preventBackToBack: true,
      maxShiftsPerWeek: 2,
    })
    expect(avoided.data.schedule['2026-04-01'].assignments.EXD).toBe('BRAVO')
    expect(avoided.data.schedule['2026-04-03'].assignments.EXD).toBe('BRAVO')
    expect(avoided.data.schedule['2026-04-06'].assignments.EXD).toBe('ALPHA')

    const allowed = smartAssign({ ...data, operators: [operator('ALPHA', true)] }, {
      year: 2026,
      month: 4,
      ...openLimits,
    })
    expect(allowed.data.schedule['2026-04-01'].assignments.EXD).toBe('ALPHA')
    expect(allowed.data.schedule['2026-04-06'].assignments.EXD).toBe('ALPHA')

    const splitSchedule = weekdaySchedule(4)
    splitSchedule['2026-04-01'] = { coverage: true, assignments: { EXD: 'ALPHA' } }
    splitSchedule['2026-04-02'] = { coverage: true, assignments: { EXD: 'BRAVO' } }
    const split = smartAssign(schedulerData({
      positions: [weeklyExd],
      schedule: splitSchedule,
    }), { year: 2026, month: 4, ...openLimits })

    expect(split.data.schedule['2026-04-01'].assignments.EXD).toBe('ALPHA')
    expect(split.data.schedule['2026-04-02'].assignments.EXD).toBe('BRAVO')
    expect(split.data.schedule['2026-04-03'].assignments.EXD).toBeUndefined()
    expect(split.issues).toContainEqual(expect.objectContaining({
      position: 'EXD',
      reason: 'This week is split between more than one operator.',
    }))
    expect(findOpenAssignmentIssues(split.data, { year: 2026, month: 4, ...openLimits })).toContainEqual(
      expect.objectContaining({ reason: 'This week is split between more than one operator.' }),
    )
  })

  it('refuses a weekly hand pick that would put someone on two seats, and does not change the week', () => {
    const schedule = weekdaySchedule(3, 4)
    schedule['2026-04-02'] = { coverage: true, assignments: { DW: 'ALPHA' } }
    const data = schedulerData({ positions: [weeklyExd, dwPosition], schedule })

    const result = assignOperator(data, '2026-04-01', 'EXD', 'ALPHA')

    expect(result.check.allowed).toBe(false)
    expect(result.data.schedule['2026-04-01'].assignments.EXD).toBeUndefined()
    expect(result.data.schedule['2026-04-03'].assignments.EXD).toBeUndefined()
    expect(result.data.schedule['2026-03-30'].assignments.EXD).toBeUndefined()
    expect(result.data.schedule['2026-04-02'].assignments.DW).toBe('ALPHA')
  })

  it('counts weekly coverage days toward the monthly maximum and not the rolling weekly maximum', () => {
    const schedule = weekdaySchedule(4)
    for (const date of Object.keys(schedule)) {
      if (date < '2026-04-06' || date > '2026-04-10') {
        schedule[date] = { coverage: false, assignments: {} }
      }
    }
    const data = schedulerData({
      positions: [weeklyExd],
      operators: [operator('ALPHA', true)],
      schedule,
    })

    const overMonth = smartAssign(data, { year: 2026, month: 4, ...openLimits, maxShifts: 4 })
    expect(overMonth.data.schedule['2026-04-06'].assignments.EXD).toBeUndefined()
    expect(overMonth.issues[0].reason).toContain('monthly')

    const underWeeklyCap = smartAssign(data, {
      year: 2026,
      month: 4,
      maxShifts: 5,
      preventBackToBack: false,
      maxShiftsPerWeek: 2,
    })
    expect(underWeeklyCap.data.schedule['2026-04-06'].assignments.EXD).toBe('ALPHA')
    expect(underWeeklyCap.data.schedule['2026-04-10'].assignments.EXD).toBe('ALPHA')
    expect(underWeeklyCap.assignedCount).toBe(5)
  })

  it('fills open days of a split week with the majority operator and leaves a tie alone', () => {
    const schedule = weekdaySchedule(3, 4)
    schedule['2026-03-30'] = { coverage: true, assignments: { EXD: 'ALPHA' } }
    schedule['2026-03-31'] = { coverage: true, assignments: { EXD: 'ALPHA' } }
    schedule['2026-04-01'] = { coverage: true, assignments: { EXD: 'BRAVO' } }
    const majority = smartAssign(schedulerData({
      positions: [weeklyExd],
      operators: [operator('ALPHA', true), operator('BRAVO', true)],
      schedule,
    }), { year: 2026, month: 4, ...openLimits })

    expect(majority.data.schedule['2026-04-01'].assignments.EXD).toBe('BRAVO')
    expect(majority.data.schedule['2026-04-02'].assignments.EXD).toBe('ALPHA')
    expect(majority.data.schedule['2026-04-03'].assignments.EXD).toBe('ALPHA')

    const tieSchedule = weekdaySchedule(4)
    tieSchedule['2026-04-06'] = { coverage: true, assignments: { EXD: 'ALPHA' } }
    tieSchedule['2026-04-07'] = { coverage: true, assignments: { EXD: 'BRAVO' } }
    const tie = smartAssign(schedulerData({
      positions: [weeklyExd],
      schedule: tieSchedule,
    }), { year: 2026, month: 4, ...openLimits })

    expect(tie.data.schedule['2026-04-08'].assignments.EXD).toBeUndefined()
    expect(tie.issues).toContainEqual(expect.objectContaining({
      reason: 'This week is split between more than one operator.',
    }))
  })

  it('names the operator a weekly hand pick would replace, including the previous month', () => {
    const schedule = weekdaySchedule(3, 4)
    schedule['2026-03-30'] = { coverage: true, assignments: { EXD: 'BRAVO' } }
    const data = schedulerData({ positions: [weeklyExd], schedule })

    expect(operatorsReplacedByWeeklyAssign(data, '2026-04-01', 'EXD', 'ALPHA')).toEqual(['BRAVO'])
    expect(operatorsReplacedByWeeklyAssign(data, '2026-04-01', 'EXD', 'BRAVO')).toEqual([])
  })

  it('does not copy a cleared weekly hold back from the previous month', () => {
    const schedule = weekdaySchedule(3, 4)
    schedule['2026-03-30'] = { coverage: true, assignments: { EXD: 'ALPHA' } }
    schedule['2026-03-31'] = { coverage: true, assignments: { EXD: 'ALPHA' } }
    const data = schedulerData({
      positions: [weeklyExd],
      operators: [
        { ...operator('ALPHA', true), unavailable: [3] },
        operator('BRAVO', true),
      ],
      schedule,
    })

    const cleared = clearAssignmentsForMonth(data, '2026-04')
    expect(cleared.schedule['2026-03-30'].assignments.EXD).toBeUndefined()

    const filled = smartAssign(cleared, { year: 2026, month: 4, ...openLimits })
    expect(filled.data.schedule['2026-04-01'].assignments.EXD).toBe('BRAVO')
    expect(filled.data.schedule['2026-03-30'].assignments.EXD).toBe('BRAVO')
  })

  it('keeps a weekly seat together across New Year and skips the holiday', () => {
    const holidays = [{ date: '2027-01-01', name: "New Year's Day", source: 'manual' as const }]
    const data = schedulerData({
      positions: [weeklyExd],
      operators: [operator('ALPHA', true), operator('BRAVO', true)],
      holidays,
      schedule: {
        ...ensureMonthSchedule({}, 2026, 12, holidays),
        ...ensureMonthSchedule({}, 2027, 1, holidays),
      },
    })

    const manual = assignOperator(data, '2026-12-30', 'EXD', 'ALPHA')
    expect(manual.data.schedule['2026-12-28'].assignments.EXD).toBe('ALPHA')
    expect(manual.data.schedule['2026-12-31'].assignments.EXD).toBe('ALPHA')
    expect(manual.data.schedule['2027-01-01'].coverage).toBe(false)
    expect(manual.data.schedule['2027-01-01'].assignments.EXD).toBeUndefined()
    expect(manual.data.schedule['2027-01-04'].assignments.EXD).toBeUndefined()

    const nextWeek = smartAssign(manual.data, {
      year: 2027,
      month: 1,
      maxShifts: 20,
      preventBackToBack: true,
      maxShiftsPerWeek: 2,
    })
    expect(nextWeek.data.schedule['2026-12-31'].assignments.EXD).toBe('ALPHA')
    expect(nextWeek.data.schedule['2027-01-04'].assignments.EXD).toBe('BRAVO')
  })
})

describe('region shift limits', () => {
  it('treats 0 as no limit and lets an operator override the region default', () => {
    const limited = schedulerData({
      positions: [dwPosition],
      operators: [{ ...operator('ALPHA'), maxShiftsPerMonth: 1 }],
      maxShiftsPerMonth: 0,
      maxShiftsPerWeek: 0,
      schedule: {
        '2026-04-01': { coverage: true, assignments: { DW: 'ALPHA' } },
        '2026-04-03': { coverage: true, assignments: {} },
      },
    })

    expect(canAssignOperator(limited, '2026-04-03', dwPosition, 'ALPHA', {
      maxShifts: 0,
      preventBackToBack: false,
      maxShiftsPerWeek: 0,
    })).toEqual({ allowed: false, reason: 'Operator reached the monthly shift limit.' })

    const open = smartAssign(schedulerData({
      positions: [dwPosition],
      operators: [operator('ALPHA')],
      maxShiftsPerMonth: 0,
      maxShiftsPerWeek: 0,
      schedule: weekdaySchedule(4),
    }), { year: 2026, month: 4, maxShifts: 0, preventBackToBack: false, maxShiftsPerWeek: 0 })

    expect(open.data.schedule['2026-04-01'].assignments.DW).toBe('ALPHA')
    expect(open.data.schedule['2026-04-10'].assignments.DW).toBe('ALPHA')
    expect(open.assignedCount).toBeGreaterThan(5)
  })

  it('warns about a hand pick that would pass a monthly or rolling-week limit, and still allows it', () => {
    const monthData = schedulerData({
      positions: [dwPosition],
      maxShiftsPerMonth: 1,
      maxShiftsPerWeek: 0,
      schedule: {
        '2026-04-01': { coverage: true, assignments: { DW: 'ALPHA' } },
        '2026-04-03': { coverage: true, assignments: {} },
      },
    })

    expect(handPickShiftLimitWarnings(monthData, '2026-04-03', 'DW', 'ALPHA')).toEqual([
      'ALPHA would go over the region monthly limit of 1.',
    ])
    expect(assignOperator(monthData, '2026-04-03', 'DW', 'ALPHA').check.allowed).toBe(true)
    expect(handPickShiftLimitWarnings(monthData, '2026-04-01', 'DW', 'ALPHA')).toEqual([])

    const personal = schedulerData({
      positions: [dwPosition],
      operators: [{ ...operator('ALPHA'), maxShiftsPerWeek: 1 }],
      maxShiftsPerMonth: 0,
      maxShiftsPerWeek: 0,
      schedule: {
        '2026-04-01': { coverage: true, assignments: { DW: 'ALPHA' } },
        '2026-04-02': { coverage: true, assignments: {} },
      },
    })
    expect(handPickShiftLimitWarnings(personal, '2026-04-02', 'DW', 'ALPHA')).toEqual([
      'ALPHA would go over their daily rolling-week limit of 1.',
    ])

    const weekly = schedulerData({
      positions: [weeklyExd],
      operators: [operator('ALPHA', true)],
      maxShiftsPerMonth: 4,
      maxShiftsPerWeek: 2,
      schedule: weekdaySchedule(4),
    })
    for (const date of Object.keys(weekly.schedule)) {
      if (date < '2026-04-06' || date > '2026-04-10') weekly.schedule[date] = { coverage: false, assignments: {} }
    }
    expect(handPickShiftLimitWarnings(weekly, '2026-04-06', 'EXD', 'ALPHA')).toEqual([
      'ALPHA would go over the region monthly limit of 4.',
    ])
    expect(handPickShiftLimitWarnings(weekly, '2026-04-06', 'EXD', 'ALPHA').some((warning) => warning.includes('rolling-week'))).toBe(false)
  })
})

const timezoneResolveHook = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    for (const suffix of ['.ts', '.tsx', '.js', '.mjs']) {
      try {
        return await nextResolve(specifier + suffix, context)
      } catch {
        // Try the next suffix.
      }
    }
  }

  return nextResolve(specifier, context)
}
`

const timezoneProbeSource = `
import { canAssignOperator, getWeeklyShiftCount, smartAssign } from 'APP_ROOT/src/domain/schedulerRules.ts'
import { defaultPositions } from 'APP_ROOT/src/domain/schedulerTypes.ts'

const dw = defaultPositions[1]
const limits = { maxShifts: 10, preventBackToBack: true, maxShiftsPerWeek: 10 }
const failures = []

const person = (callsign, ale = true) => ({
  callsign,
  ale,
  unavailable: [],
  positionPermissions: { EXD: ale, DW: true, DR: true },
})

const make = (operators, schedule) => ({
  version: 1,
  operators,
  positions: defaultPositions,
  vacations: {},
  holidays: [],
  schedule,
})

const check = (label, actual, expected) => {
  if (actual !== expected) {
    failures.push(label + ': expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual))
  }
}

const assignable = (workedDate, targetDate) => {
  const data = make([person('ALPHA'), person('BRAVO')], {
    [workedDate]: { coverage: true, assignments: { DW: 'ALPHA' } },
    [targetDate]: { coverage: true, assignments: {} },
  })
  return canAssignOperator(data, targetDate, dw, 'ALPHA', limits).allowed
}

const expectBlocked = (worked, target) => check(worked + ' blocks ' + target, assignable(worked, target), false)
const expectAllowed = (worked, target) => check(worked + ' allows ' + target, assignable(worked, target), true)

expectBlocked('2026-04-01', '2026-04-02')
expectAllowed('2026-04-01', '2026-04-03')
expectBlocked('2026-04-01', '2026-03-31')
expectAllowed('2026-04-01', '2026-03-30')
expectBlocked('2026-03-31', '2026-04-01')
expectAllowed('2026-03-31', '2026-04-02')
expectBlocked('2026-05-01', '2026-04-30')
expectAllowed('2026-05-01', '2026-04-29')
expectBlocked('2026-03-09', '2026-03-08')
expectBlocked('2026-03-09', '2026-03-10')
expectAllowed('2026-03-09', '2026-03-07')
expectAllowed('2026-03-09', '2026-03-11')
expectBlocked('2026-03-30', '2026-03-29')
expectBlocked('2026-03-30', '2026-03-31')
expectAllowed('2026-03-30', '2026-03-28')
expectAllowed('2026-03-30', '2026-04-01')
expectBlocked('2026-01-15', '2026-01-14')
expectBlocked('2026-01-15', '2026-01-16')
expectAllowed('2026-01-15', '2026-01-13')
expectAllowed('2026-01-15', '2026-01-17')
expectBlocked('2026-11-02', '2026-11-01')
expectBlocked('2026-11-02', '2026-11-03')
expectAllowed('2026-11-02', '2026-10-31')
expectAllowed('2026-11-02', '2026-11-04')

const weeklyData = make([person('ALPHA')], {
  '2026-04-01': { coverage: true, assignments: { DW: 'ALPHA' } },
  '2026-04-03': { coverage: true, assignments: { DR: 'ALPHA' } },
})
check(
  'weekly window',
  getWeeklyShiftCount(weeklyData.schedule, weeklyData.positions, 'ALPHA', '2026-04-02'),
  2,
)
check(
  'weekly window sees the next month',
  getWeeklyShiftCount(make([person('ALPHA')], {
    '2026-05-01': { coverage: true, assignments: { DW: 'ALPHA' } },
  }).schedule, defaultPositions, 'ALPHA', '2026-04-30'),
  1,
)

const crew = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT'].map((callsign) => person(callsign))
const filled = smartAssign(make(crew, {}), {
  year: 2026,
  month: 4,
  maxShifts: 10,
  preventBackToBack: true,
  maxShiftsPerWeek: 2,
})
const shiftDate = (dateStr, days) => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}
const pairs = []
for (const date of Object.keys(filled.data.schedule)) {
  const previous = shiftDate(date, -1)
  for (const operator of crew) {
    const onDate = (day) => defaultPositions.some((position) => filled.data.schedule[day]?.assignments[position.name] === operator.callsign)
    if (onDate(date) && onDate(previous)) pairs.push(operator.callsign + ' ' + previous + ' ' + date)
  }
}
check('clean April pairs', pairs.length, 0)

if (failures.length > 0) {
  console.error(failures.join('\\n'))
  process.exit(1)
}
console.log('ok')
`
