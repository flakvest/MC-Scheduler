import { describe, expect, it } from 'vitest'
import { defaultPositions, type Operator, type SchedulerData } from './schedulerTypes'
import {
  assignOperator,
  canAssignOperator,
  ensureMonthSchedule,
  findOpenAssignmentIssues,
  getShiftCount,
  getWeeklyShiftCount,
  isOperatorAvailable,
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
  version: 1,
  operators: [operator('ALPHA', true), operator('BRAVO'), operator('CHARLIE', true)],
  positions: defaultPositions,
  vacations: {},
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
      limitWeekly: true,
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
      limitWeekly: true,
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
      limitWeekly: true,
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
      limitWeekly: true,
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
