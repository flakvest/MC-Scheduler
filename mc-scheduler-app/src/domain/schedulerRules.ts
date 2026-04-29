import {
  type Callsign,
  type IsoDate,
  type Operator,
  type Position,
  type PositionCode,
  type Schedule,
  type SchedulerData,
} from './schedulerTypes'

export type SmartAssignOptions = {
  year: number
  month: number
  maxShifts: number
  preventBackToBack: boolean
  limitWeekly?: boolean
  maxShiftsPerWeek?: number
}

export type SmartAssignResult = {
  data: SchedulerData
  assignedCount: number
  blockedCount: number
  issues: AssignmentIssue[]
}

export type AssignmentCheck = {
  allowed: boolean
  reason?: string
}

export type AssignmentIssue = {
  date: IsoDate
  position: PositionCode
  reason: string
}

const monthPrefix = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, '0')}`

const isoDateForMonthDay = (year: number, month: number, day: number): IsoDate =>
  `${monthPrefix(year, month)}-${String(day).padStart(2, '0')}`

const addDays = (dateStr: IsoDate, days: number): IsoDate => {
  const date = new Date(`${dateStr}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

const getOperator = (operators: Operator[], callsign: Callsign) =>
  operators.find((operator) => operator.callsign === callsign)

const getPositionPermission = (operator: Operator, position: Position) => {
  if (position.name === 'EXD') return operator.ale
  return operator.positionPermissions[position.name] !== false
}

const getAssignmentsForDay = (schedule: Schedule, dateStr: IsoDate) =>
  Object.values(schedule[dateStr]?.assignments ?? {})

const summarizeBlockedReasons = (
  data: SchedulerData,
  dateStr: IsoDate,
  position: Position,
  options: SmartAssignOptions,
) => {
  if (data.operators.length === 0) return 'No operators exist.'

  const reasons = data.operators.map((operator) =>
    canAssignOperator(data, dateStr, position, operator.callsign, options).reason ?? 'Unknown reason.',
  )

  const uniqueReasons = [...new Set(reasons)]
  return uniqueReasons.length === 1 ? uniqueReasons[0] : uniqueReasons.join(' ')
}

export function isCoverageDay(date: Date) {
  return date.getDay() % 6 !== 0
}

export function ensureMonthSchedule(schedule: Schedule, year: number, month: number): Schedule {
  const nextSchedule = structuredClone(schedule)
  const daysInMonth = new Date(year, month, 0).getDate()

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = isoDateForMonthDay(year, month, day)

    if (!nextSchedule[dateStr]) {
      nextSchedule[dateStr] = {
        coverage: isCoverageDay(new Date(year, month - 1, day)),
        assignments: {},
      }
    }
  }

  return nextSchedule
}

export function workedOnDate(schedule: Schedule, positions: Position[], callsign: Callsign, dateStr: IsoDate) {
  const assignments = schedule[dateStr]?.assignments
  if (!assignments) return false

  return positions.some((position) => assignments[position.name] === callsign)
}

export function getShiftCount(schedule: Schedule, positions: Position[], callsign: Callsign, prefix: string) {
  return Object.entries(schedule).reduce((count, [dateStr, day]) => {
    if (!dateStr.startsWith(prefix)) return count

    const dailyCount = positions.filter((position) => day.assignments[position.name] === callsign).length
    return count + dailyCount
  }, 0)
}

export function getWeeklyShiftCount(
  schedule: Schedule,
  positions: Position[],
  callsign: Callsign,
  dateStr: IsoDate,
) {
  let count = 0

  for (let dayOffset = -3; dayOffset <= 3; dayOffset += 1) {
    if (workedOnDate(schedule, positions, callsign, addDays(dateStr, dayOffset))) {
      count += 1
    }
  }

  return count
}

export function isOperatorAvailable(data: SchedulerData, callsign: Callsign, dateStr: IsoDate) {
  const operator = getOperator(data.operators, callsign)
  if (!operator) return false

  const date = new Date(`${dateStr}T00:00:00`)
  const weekday = date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6

  if (operator.unavailable.includes(weekday)) return false

  return !data.vacations[callsign]?.some((vacation) => dateStr >= vacation.start && dateStr <= vacation.end)
}

export function canAssignOperator(
  data: SchedulerData,
  dateStr: IsoDate,
  position: Position,
  callsign: Callsign,
  options?: Pick<SmartAssignOptions, 'maxShifts' | 'preventBackToBack' | 'limitWeekly' | 'maxShiftsPerWeek'>,
): AssignmentCheck {
  const operator = getOperator(data.operators, callsign)
  if (!operator) return { allowed: false, reason: 'Operator does not exist.' }

  const scheduleDay = data.schedule[dateStr]
  if (!scheduleDay?.coverage) return { allowed: false, reason: 'Date does not have coverage.' }

  if (!isOperatorAvailable(data, callsign, dateStr)) {
    return { allowed: false, reason: 'Operator is unavailable.' }
  }

  if (position.requiresALE && !operator.ale) {
    return { allowed: false, reason: 'Position requires ALE.' }
  }

  if (!getPositionPermission(operator, position)) {
    return { allowed: false, reason: 'Operator is not allowed for this position.' }
  }

  if (getAssignmentsForDay(data.schedule, dateStr).includes(callsign)) {
    return { allowed: false, reason: 'Operator is already assigned that day.' }
  }

  if (!options) return { allowed: true }

  const prefix = dateStr.slice(0, 7)

  if (getShiftCount(data.schedule, data.positions, callsign, prefix) >= options.maxShifts) {
    return { allowed: false, reason: 'Operator reached the monthly shift limit.' }
  }

  if (options.preventBackToBack && workedOnDate(data.schedule, data.positions, callsign, addDays(dateStr, -1))) {
    return { allowed: false, reason: 'Operator worked the previous day.' }
  }

  const weeklyLimit = options.maxShiftsPerWeek ?? (options.limitWeekly ? 2 : Number.POSITIVE_INFINITY)

  if (getWeeklyShiftCount(data.schedule, data.positions, callsign, dateStr) >= weeklyLimit) {
    return { allowed: false, reason: 'Operator reached the weekly shift limit.' }
  }

  return { allowed: true }
}

export function smartAssign(data: SchedulerData, options: SmartAssignOptions): SmartAssignResult {
  const schedule = ensureMonthSchedule(data.schedule, options.year, options.month)
  const nextData = structuredClone({ ...data, schedule })
  const prefix = monthPrefix(options.year, options.month)
  const rankedPositions = [...nextData.positions].sort((a, b) => Number(b.requiresALE) - Number(a.requiresALE))
  const daysInMonth = new Date(options.year, options.month, 0).getDate()

  let assignedCount = 0
  let blockedCount = 0
  const issues: AssignmentIssue[] = []

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = isoDateForMonthDay(options.year, options.month, day)
    const scheduleDay = nextData.schedule[dateStr]

    if (!scheduleDay?.coverage) continue

    rankedPositions.forEach((position) => {
      if (scheduleDay.assignments[position.name]) return

      const candidates = nextData.operators
        .filter((operator) => canAssignOperator(nextData, dateStr, position, operator.callsign, options).allowed)
        .sort((a, b) =>
          getShiftCount(nextData.schedule, nextData.positions, a.callsign, prefix) -
          getShiftCount(nextData.schedule, nextData.positions, b.callsign, prefix),
        )

      if (candidates.length === 0) {
        blockedCount += 1
        issues.push({
          date: dateStr,
          position: position.shortName,
          reason: summarizeBlockedReasons(nextData, dateStr, position, options),
        })
        return
      }

      scheduleDay.assignments[position.name] = candidates[0].callsign
      assignedCount += 1
    })
  }

  return {
    data: nextData,
    assignedCount,
    blockedCount,
    issues,
  }
}

export function findOpenAssignmentIssues(data: SchedulerData, options: SmartAssignOptions): AssignmentIssue[] {
  const schedule = ensureMonthSchedule(data.schedule, options.year, options.month)
  const nextData = { ...data, schedule }
  const daysInMonth = new Date(options.year, options.month, 0).getDate()
  const issues: AssignmentIssue[] = []

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = isoDateForMonthDay(options.year, options.month, day)
    const scheduleDay = nextData.schedule[dateStr]

    if (!scheduleDay?.coverage) continue

    nextData.positions.forEach((position) => {
      if (scheduleDay.assignments[position.name]) return

      issues.push({
        date: dateStr,
        position: position.shortName,
        reason: summarizeBlockedReasons(nextData, dateStr, position, options),
      })
    })
  }

  return issues
}

export function assignOperator(data: SchedulerData, dateStr: IsoDate, positionCode: PositionCode, callsign: Callsign) {
  const position = data.positions.find((item) => item.name === positionCode)
  if (!position) return { data, check: { allowed: false, reason: 'Position does not exist.' } }

  if (!callsign) {
    const nextData = structuredClone(data)
    delete nextData.schedule[dateStr].assignments[positionCode]
    return { data: nextData, check: { allowed: true } }
  }

  const check = canAssignOperator(data, dateStr, position, callsign)
  if (!check.allowed) return { data, check }

  const nextData = structuredClone(data)
  nextData.schedule[dateStr].assignments[positionCode] = callsign

  return { data: nextData, check }
}

export function setCoverage(data: SchedulerData, dateStr: IsoDate, coverage: boolean) {
  const nextData = structuredClone(data)

  nextData.schedule[dateStr] = {
    coverage,
    assignments: coverage ? nextData.schedule[dateStr]?.assignments ?? {} : {},
  }

  return nextData
}
