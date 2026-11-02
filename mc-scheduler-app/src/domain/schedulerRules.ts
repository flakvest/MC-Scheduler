import {
  type Callsign,
  type IsoDate,
  type Operator,
  type Position,
  type PositionCode,
  type Schedule,
  type SchedulerData,
  type Holiday,
  type Weekday,
} from './schedulerTypes'
import { holidayForDate } from './holidayRules'

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
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  const monthNumber = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dayNumber = String(date.getUTCDate()).padStart(2, '0')

  return `${date.getUTCFullYear()}-${monthNumber}-${dayNumber}`
}

const weekdayOf = (dateStr: IsoDate): Weekday => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() as Weekday
}

const startOfWeek = (dateStr: IsoDate, weekStartsOn: Weekday): IsoDate => {
  const delta = (weekdayOf(dateStr) - weekStartsOn + 7) % 7
  return addDays(dateStr, -delta)
}

const weekDates = (dateStr: IsoDate, weekStartsOn: Weekday): IsoDate[] => {
  const start = startOfWeek(dateStr, weekStartsOn)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

const dateHasCoverage = (data: SchedulerData, dateStr: IsoDate) => {
  if (holidayForDate(data.holidays, dateStr)) return false
  const existing = data.schedule[dateStr]
  if (existing) return existing.coverage
  return weekdayOf(dateStr) % 6 !== 0
}

const ensureScheduleDate = (data: SchedulerData, dateStr: IsoDate) => {
  if (!data.schedule[dateStr]) {
    data.schedule[dateStr] = {
      coverage: dateHasCoverage(data, dateStr),
      assignments: {},
    }
  }
  if (holidayForDate(data.holidays, dateStr)) {
    data.schedule[dateStr] = { coverage: false, assignments: {} }
  }
}

const coverageDatesInWeek = (data: SchedulerData, dateStr: IsoDate, createMissing: boolean) => {
  const dates = weekDates(dateStr, data.weekStartsOn)
  if (createMissing) dates.forEach((date) => ensureScheduleDate(data, date))
  return dates.filter((date) => dateHasCoverage(data, date))
}

const workedInWeekStarting = (data: SchedulerData, callsign: Callsign, weekStart: IsoDate) =>
  weekDates(weekStart, data.weekStartsOn).some((date) => workedOnDate(data.schedule, data.positions, callsign, date))

const worksAdjacentWeek = (data: SchedulerData, callsign: Callsign, dateStr: IsoDate) => {
  const start = startOfWeek(dateStr, data.weekStartsOn)
  return workedInWeekStarting(data, callsign, addDays(start, -7))
    || workedInWeekStarting(data, callsign, addDays(start, 7))
}

const finiteShiftLimit = (value: number) => value > 0 ? value : Number.POSITIVE_INFINITY

const shiftLimitFor = (override: number | undefined, regionLimit: number) =>
  finiteShiftLimit(typeof override === 'number' ? override : regionLimit)

const holderCounts = (data: SchedulerData, dates: IsoDate[], positionName: PositionCode) => {
  const counts = new Map<Callsign, number>()
  dates.forEach((date) => {
    const callsign = data.schedule[date]?.assignments[positionName]
    if (!callsign) return
    counts.set(callsign, (counts.get(callsign) ?? 0) + 1)
  })
  return counts
}

const strictMajorityHolder = (counts: Map<Callsign, number>): Callsign | null => {
  let best = ''
  let bestCount = 0
  let tied = false

  counts.forEach((count, callsign) => {
    if (count > bestCount) {
      best = callsign
      bestCount = count
      tied = false
      return
    }
    if (count === bestCount) tied = true
  })

  return best && !tied ? best : null
}

export function operatorsReplacedByWeeklyAssign(
  data: SchedulerData,
  dateStr: IsoDate,
  positionCode: PositionCode,
  callsign: Callsign,
): Callsign[] {
  const position = data.positions.find((item) => item.name === positionCode)
  if (!position || position.assignmentPeriod !== 'weekly' || !callsign) return []

  const replaced = new Set<Callsign>()
  coverageDatesInWeek(data, dateStr, false).forEach((date) => {
    const existing = data.schedule[date]?.assignments[position.name]
    if (existing && existing !== callsign) replaced.add(existing)
  })
  return [...replaced]
}

export function clearWeeklyHoldsTouchingMonth(data: SchedulerData, month: string): SchedulerData {
  const weekly = data.positions.filter((position) => position.assignmentPeriod === 'weekly')
  if (weekly.length === 0) return data

  const [year, monthNumber] = month.split('-').map(Number)
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const starts = new Set<IsoDate>()
  for (let day = 1; day <= daysInMonth; day += 1) {
    starts.add(startOfWeek(isoDateForMonthDay(year, monthNumber, day), data.weekStartsOn))
  }

  const nextData = structuredClone(data)
  starts.forEach((start) => {
    weekDates(start, nextData.weekStartsOn).forEach((date) => {
      const day = nextData.schedule[date]
      if (!day) return
      weekly.forEach((position) => {
        delete day.assignments[position.name]
      })
    })
  })
  return nextData
}

const getOperator = (operators: Operator[], callsign: Callsign) =>
  operators.find((operator) => operator.callsign === callsign)

const getPositionPermission = (operator: Operator, position: Position) => {
  if (position.type === 'ale') return operator.ale
  return operator.positionPermissions[position.name] !== false
}

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

export function ensureMonthSchedule(schedule: Schedule, year: number, month: number, holidays: Holiday[] = []): Schedule {
  const nextSchedule = structuredClone(schedule)
  const daysInMonth = new Date(year, month, 0).getDate()

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = isoDateForMonthDay(year, month, day)

    if (!nextSchedule[dateStr]) {
      nextSchedule[dateStr] = {
        coverage: !holidayForDate(holidays, dateStr) && isCoverageDay(new Date(year, month - 1, day)),
        assignments: {},
      }
    }

    if (holidayForDate(holidays, dateStr)) {
      nextSchedule[dateStr] = {
        coverage: false,
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

function canHoldWeeklyPosition(
  data: SchedulerData,
  dateStr: IsoDate,
  position: Position,
  callsign: Callsign,
  options: Pick<SmartAssignOptions, 'maxShifts' | 'preventBackToBack' | 'limitWeekly' | 'maxShiftsPerWeek'>,
): AssignmentCheck {
  const dates = coverageDatesInWeek(data, dateStr, false)
  const counts = holderCounts(data, dates, position.name)
  const majority = strictMajorityHolder(counts)
  const otherHolders = [...counts.keys()].filter((holder) => holder !== callsign)

  if (otherHolders.length > 0 && majority !== callsign) {
    return {
      allowed: false,
      reason: otherHolders.length === 1 && counts.size === 1
        ? 'This week is already assigned to someone else.'
        : 'This week is split between more than one operator.',
    }
  }

  for (const date of dates) {
    const existing = data.schedule[date]?.assignments[position.name]
    if (existing) continue
    if (date === dateStr) continue

    const check = canAssignOperator(data, date, position, callsign)
    if (!check.allowed) return check
  }

  if (options.preventBackToBack && worksAdjacentWeek(data, callsign, dateStr)) {
    return { allowed: false, reason: `${callsign} already works an adjacent week.` }
  }

  const holder = getOperator(data.operators, callsign)
  if (!holder) return { allowed: false, reason: 'Operator does not exist.' }
  const monthLimit = shiftLimitFor(holder.maxShiftsPerMonth, options.maxShifts)
  const prefixes = new Set(dates.map((date) => date.slice(0, 7)))
  for (const prefix of prefixes) {
    const extra = dates.filter((date) =>
      date.startsWith(prefix) && !data.schedule[date]?.assignments[position.name],
    ).length
    if (getShiftCount(data.schedule, data.positions, callsign, prefix) + extra > monthLimit) {
      return { allowed: false, reason: 'Operator reached the monthly shift limit.' }
    }
  }

  return { allowed: true }
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

  if (!dateHasCoverage(data, dateStr)) return { allowed: false, reason: 'Date does not have coverage.' }

  if (!isOperatorAvailable(data, callsign, dateStr)) {
    return { allowed: false, reason: 'Operator is unavailable.' }
  }

  if (position.type === 'ale' && !operator.ale) {
    return { allowed: false, reason: 'Position requires ALE.' }
  }

  if (!getPositionPermission(operator, position)) {
    return { allowed: false, reason: 'Operator is not allowed for this position.' }
  }

  const assignedToAnotherSeat = Object.entries(data.schedule[dateStr]?.assignments ?? {})
    .some(([code, assigned]) => assigned === callsign && code !== position.name)
  if (assignedToAnotherSeat) {
    return { allowed: false, reason: 'Operator is already assigned that day.' }
  }

  if (!options) return { allowed: true }

  if (position.assignmentPeriod === 'weekly') {
    return canHoldWeeklyPosition(data, dateStr, position, callsign, options)
  }

  const prefix = dateStr.slice(0, 7)
  const monthLimit = shiftLimitFor(operator.maxShiftsPerMonth, options.maxShifts)
  const regionWeek = typeof options.maxShiftsPerWeek === 'number'
    ? options.maxShiftsPerWeek
    : options.limitWeekly ? 2 : 0
  const weeklyLimit = shiftLimitFor(operator.maxShiftsPerWeek, regionWeek)

  if (getShiftCount(data.schedule, data.positions, callsign, prefix) >= monthLimit) {
    return { allowed: false, reason: 'Operator reached the monthly shift limit.' }
  }

  if (options.preventBackToBack && workedOnDate(data.schedule, data.positions, callsign, addDays(dateStr, -1))) {
    return { allowed: false, reason: 'Operator worked the previous day.' }
  }

  if (options.preventBackToBack && workedOnDate(data.schedule, data.positions, callsign, addDays(dateStr, 1))) {
    return { allowed: false, reason: `${callsign} already works the next day.` }
  }

  if (getWeeklyShiftCount(data.schedule, data.positions, callsign, dateStr) >= weeklyLimit) {
    return { allowed: false, reason: 'Operator reached the weekly shift limit.' }
  }

  return { allowed: true }
}

export function smartAssign(data: SchedulerData, options: SmartAssignOptions): SmartAssignResult {
  const schedule = ensureMonthSchedule(data.schedule, options.year, options.month, data.holidays)
  const nextData = structuredClone({ ...data, schedule })
  const prefix = monthPrefix(options.year, options.month)
  const rankedPositions = [...nextData.positions]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
    .sort((left, right) => Number(right.type === 'ale') - Number(left.type === 'ale'))
  const daysInMonth = new Date(options.year, options.month, 0).getDate()

  let assignedCount = 0
  let blockedCount = 0
  const issues: AssignmentIssue[] = []
  const handledWeeks = new Set<string>()

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = isoDateForMonthDay(options.year, options.month, day)
    const scheduleDay = nextData.schedule[dateStr]

    if (!scheduleDay?.coverage) continue

    rankedPositions.forEach((position) => {
      if (position.assignmentPeriod === 'weekly') {
        const weekStart = startOfWeek(dateStr, nextData.weekStartsOn)
        const token = `${position.name}|${weekStart}`
        if (handledWeeks.has(token)) return
        handledWeeks.add(token)

        const dates = coverageDatesInWeek(nextData, dateStr, true)
        const openDates = dates.filter((date) => !nextData.schedule[date]?.assignments[position.name])
        if (openDates.length === 0) return

        const counts = holderCounts(nextData, dates, position.name)
        const majority = strictMajorityHolder(counts)
        const holders = [...counts.keys()]
        if (holders.length > 1 && !majority) {
          blockedCount += 1
          issues.push({
            date: dateStr,
            position: position.shortName,
            reason: 'This week is split between more than one operator.',
          })
          return
        }

        const candidates = (majority
          ? nextData.operators.filter((operator) => operator.callsign === majority)
          : holders.length === 1
            ? nextData.operators.filter((operator) => operator.callsign === holders[0])
            : nextData.operators
        )
          .filter((operator) => canAssignOperator(nextData, dateStr, position, operator.callsign, options).allowed)
          .sort((left, right) =>
            getShiftCount(nextData.schedule, nextData.positions, left.callsign, prefix) -
            getShiftCount(nextData.schedule, nextData.positions, right.callsign, prefix),
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

        openDates.forEach((date) => {
          nextData.schedule[date].assignments[position.name] = candidates[0].callsign
          assignedCount += 1
        })
        return
      }

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
  const schedule = ensureMonthSchedule(data.schedule, options.year, options.month, data.holidays)
  const nextData = { ...data, schedule }
  const daysInMonth = new Date(options.year, options.month, 0).getDate()
  const monthKey = monthPrefix(options.year, options.month)
  const issues: AssignmentIssue[] = []
  const seenWeeks = new Set<string>()

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = isoDateForMonthDay(options.year, options.month, day)
    const scheduleDay = nextData.schedule[dateStr]

    if (!scheduleDay?.coverage) continue

    nextData.positions.forEach((position) => {
      if (position.assignmentPeriod === 'weekly') {
        const token = `${position.name}|${startOfWeek(dateStr, nextData.weekStartsOn)}`
        if (seenWeeks.has(token)) return
        seenWeeks.add(token)

        const dates = coverageDatesInWeek(nextData, dateStr, false)
        const counts = holderCounts(nextData, dates, position.name)
        const majority = strictMajorityHolder(counts)
        if (counts.size > 1 && !majority) {
          issues.push({
            date: dateStr,
            position: position.shortName,
            reason: 'This week is split between more than one operator.',
          })
          return
        }

        dates
          .filter((date) => date.startsWith(monthKey) && !nextData.schedule[date]?.assignments[position.name])
          .forEach((date) => {
            issues.push({
              date,
              position: position.shortName,
              reason: summarizeBlockedReasons(nextData, date, position, options),
            })
          })
        return
      }

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

  if (position.assignmentPeriod === 'weekly') {
    const dates = coverageDatesInWeek(data, dateStr, false)
    if (!callsign) {
      const nextData = structuredClone(data)
      dates.forEach((date) => {
        if (nextData.schedule[date]?.assignments) delete nextData.schedule[date].assignments[positionCode]
      })
      return { data: nextData, check: { allowed: true } }
    }

    for (const date of dates) {
      if (data.schedule[date]?.assignments[positionCode] === callsign) continue
      const check = canAssignOperator(data, date, position, callsign)
      if (!check.allowed) return { data, check }
    }

    const nextData = structuredClone(data)
    dates.forEach((date) => {
      ensureScheduleDate(nextData, date)
      if (nextData.schedule[date].coverage) nextData.schedule[date].assignments[positionCode] = callsign
    })
    return { data: nextData, check: { allowed: true } }
  }

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
