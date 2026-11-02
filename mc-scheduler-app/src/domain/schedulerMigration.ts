import { normalizeHolidays } from './holidayRules'
import {
  DEFAULT_MAX_SHIFTS_PER_MONTH,
  DEFAULT_MAX_SHIFTS_PER_WEEK,
  emptySchedulerData,
  MAX_SHIFTS_PER_MONTH_CAP,
  MAX_SHIFTS_PER_WEEK_CAP,
  region4ExamplePositions,
  type Operator,
  type BackToBackPolicy,
  type Position,
  type PositionType,
  type Schedule,
  type SchedulerData,
  type VacationMap,
  type Weekday,
} from './schedulerTypes'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeCode = (value: unknown) =>
  typeof value === 'string' ? value.trim().toUpperCase() : ''

export const CHANNEL_HELP = 'Channel name must be exactly 4 letters or numbers, such as AB12.'

export function normalizeChannel(value: unknown): { channel: string, error?: string } {
  if (typeof value !== 'string') return { channel: '' }

  const channel = value.trim().toUpperCase()
  if (!channel) return { channel: '' }
  if (!/^[A-Z0-9]{4}$/.test(channel)) return { channel: '', error: CHANNEL_HELP }

  return { channel }
}

const finiteSortOrder = (value: unknown, fallback: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.trunc(value)
}

const displayNameFrom = (value: unknown, code: string) => {
  if (typeof value !== 'string') return code
  const name = value.trim().replace(/\s+/g, ' ')
  return name || code
}

export function positionFromRaw(value: unknown, index: number): Position | null {
  if (!isRecord(value)) return null

  const name = normalizeCode(value.name || value.shortName)
  if (!name || name.length > 12) return null

  const explicitType: PositionType | null = value.type === 'ale' || value.type === 'fixed' ? value.type : null
  const type: PositionType = explicitType ?? (value.requiresALE === true ? 'ale' : 'fixed')
  const channel = normalizeChannel(value.channel).channel

  return {
    name,
    shortName: name,
    displayName: displayNameFrom(value.displayName, name),
    type,
    assignmentPeriod: value.assignmentPeriod === 'weekly' ? 'weekly' : 'daily',
    channel,
    sortOrder: finiteSortOrder(value.sortOrder, index + 1),
  }
}

const normalizeWeekdays = (value: unknown): Weekday[] => {
  if (!Array.isArray(value)) return []

  return value.filter((day): day is Weekday =>
    Number.isInteger(day) && day >= 0 && day <= 6,
  )
}

const operatorFromRaw = (value: unknown): Operator | null => {
  if (!isRecord(value)) return null

  const callsign = normalizeCode(value.callsign)
  if (!callsign) return null

  const listedQualifications = Array.isArray(value.qualifications)
    ? value.qualifications.filter((item): item is string => typeof item === 'string').map((item) => item.toUpperCase())
    : []
  const ale = value.ale === true
    || value.canEXD === true
    || value.canBIGTOPDELTA === true
    || listedQualifications.includes('ALE')
  const maxShiftsPerMonth = optionalShiftLimit(value.maxShiftsPerMonth, MAX_SHIFTS_PER_MONTH_CAP)
  const maxShiftsPerWeek = optionalShiftLimit(value.maxShiftsPerWeek, MAX_SHIFTS_PER_WEEK_CAP)
  const positionPermissions = isRecord(value.positionPermissions)
    ? Object.entries(value.positionPermissions).reduce<Record<string, boolean>>((permissions, [code, allowed]) => {
      const name = normalizeCode(code)
      if (name) permissions[name] = allowed !== false
      return permissions
    }, {})
    : {}

  return {
    callsign,
    ale,
    unavailable: normalizeWeekdays(value.unavailable),
    positionPermissions,
    ...(maxShiftsPerMonth === undefined ? {} : { maxShiftsPerMonth }),
    ...(maxShiftsPerWeek === undefined ? {} : { maxShiftsPerWeek }),
  }
}

const optionalShiftLimit = (value: unknown, cap: number): number | undefined => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > cap) return undefined
  return value
}

const regionShiftLimit = (value: unknown, fallback: number, cap: number) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > cap) return fallback
  return value
}

const scheduleFromRaw = (value: unknown): Schedule => {
  if (!isRecord(value)) return {}

  return Object.entries(value).reduce<Schedule>((schedule, [date, day]) => {
    if (!isRecord(day)) return schedule

    const assignments = isRecord(day.assignments)
      ? Object.entries(day.assignments).reduce<Record<string, string>>((next, [code, callsign]) => {
        const name = normalizeCode(code)
        const normalizedCallsign = normalizeCode(callsign)
        if (name && normalizedCallsign) next[name] = normalizedCallsign
        return next
      }, {})
      : {}

    schedule[date] = {
      coverage: day.coverage !== false,
      assignments,
    }
    return schedule
  }, {})
}

const vacationsFromRaw = (value: unknown): VacationMap => {
  if (!isRecord(value)) return {}

  return Object.entries(value).reduce<VacationMap>((vacations, [callsign, entries]) => {
    if (!Array.isArray(entries)) return vacations

    const cleanEntries = entries
      .filter(isRecord)
      .map((entry) => ({
        start: typeof entry.start === 'string' ? entry.start : '',
        end: typeof entry.end === 'string' ? entry.end : '',
      }))
      .filter((entry) => entry.start && entry.end)

    const name = normalizeCode(callsign)
    if (name && cleanEntries.length > 0) vacations[name] = cleanEntries
    return vacations
  }, {})
}

const hasScheduleWork = (schedule: Schedule) =>
  Object.values(schedule).some((day) => Object.keys(day.assignments).length > 0)

export function migrateSchedulerData(value: unknown): { data: SchedulerData, migrated: boolean } {
  if (!isRecord(value)) return { data: emptySchedulerData(), migrated: false }

  const sourceVersion = value.version === 2 ? 2 : 1
  const positions = (Array.isArray(value.positions)
    ? value.positions
      .map((position, index) => positionFromRaw(position, index))
      .filter((position): position is Position => position !== null)
    : sourceVersion === 1 ? region4ExamplePositions() : []
  ).map((position) => (
    sourceVersion === 1 ? { ...position, assignmentPeriod: 'daily' as const } : position
  ))
  const operators = Array.isArray(value.operators)
    ? value.operators
      .map((operator) => operatorFromRaw(operator))
      .filter((operator): operator is Operator => operator !== null)
    : []
  const schedule = scheduleFromRaw(value.schedule)
  const vacations = vacationsFromRaw(value.vacations)
  const holidays = normalizeHolidays(value.holidays)
  const regionName = typeof value.regionName === 'string' ? value.regionName.trim() : ''
  const setupComplete = typeof value.setupComplete === 'boolean'
    ? value.setupComplete
    : sourceVersion === 1 || positions.length > 0 || operators.length > 0 || hasScheduleWork(schedule)
  const backToBackPolicy: BackToBackPolicy = sourceVersion === 1
    ? 'avoid'
    : value.backToBackPolicy === 'allow' ? 'allow' : 'avoid'
  const weekStartsOn = sourceVersion === 1
    ? 1
    : normalizeWeekdays([value.weekStartsOn])[0] ?? 1
  const maxShiftsPerMonth = sourceVersion === 1
    ? DEFAULT_MAX_SHIFTS_PER_MONTH
    : regionShiftLimit(value.maxShiftsPerMonth, DEFAULT_MAX_SHIFTS_PER_MONTH, MAX_SHIFTS_PER_MONTH_CAP)
  const maxShiftsPerWeek = sourceVersion === 1
    ? DEFAULT_MAX_SHIFTS_PER_WEEK
    : regionShiftLimit(value.maxShiftsPerWeek, DEFAULT_MAX_SHIFTS_PER_WEEK, MAX_SHIFTS_PER_WEEK_CAP)

  return {
    migrated: sourceVersion === 1,
    data: {
      version: 2,
      regionName,
      setupComplete,
      backToBackPolicy,
      weekStartsOn,
      maxShiftsPerMonth,
      maxShiftsPerWeek,
      operators,
      positions,
      vacations,
      holidays,
      schedule,
    },
  }
}
