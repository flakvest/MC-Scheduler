import { positionFromRaw } from './schedulerMigration'
import {
  type LegacyBackupData,
  type Operator,
  type Position,
  type Schedule,
  type SchedulerData,
  type VacationMap,
  type Weekday,
  region4ExamplePositions,
} from './schedulerTypes'

type LegacyOperator = {
  callsign?: unknown
  ale?: unknown
  unavailable?: unknown
  [permission: string]: unknown
}

type LegacyPosition = {
  name?: unknown
  shortName?: unknown
  requiresALE?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeCode = (value: unknown) =>
  typeof value === 'string' ? value.trim().toUpperCase() : ''

const normalizeWeekdays = (value: unknown): Weekday[] => {
  if (!Array.isArray(value)) return []

  return value.filter((day): day is Weekday =>
    Number.isInteger(day) && day >= 0 && day <= 6,
  )
}

const normalizePositions = (value: unknown): Position[] => {
  if (!Array.isArray(value)) return region4ExamplePositions()

  const positions = value
    .filter(isRecord)
    .map((position, index): Position | null => {
      const legacy = position as LegacyPosition
      const rawName = normalizeCode(legacy.shortName || legacy.name)
      const name = rawName === 'BIGTOPDELTA' ? 'EXD' : rawName
      if (!name) return null

      return positionFromRaw({
        ...legacy,
        name,
        shortName: name,
        requiresALE: legacy.requiresALE === true || name === 'EXD',
      }, index)
    })
    .filter((position): position is Position => position !== null)

  return positions.length > 0 ? positions : region4ExamplePositions()
}

const normalizeOperators = (value: unknown, positions: Position[]): Operator[] => {
  if (!Array.isArray(value)) return []

  return value
    .filter(isRecord)
    .map((operator): Operator | null => {
      const legacy = operator as LegacyOperator
      const callsign = normalizeCode(legacy.callsign)

      if (!callsign) return null

      const ale = legacy.ale === true || legacy.canBIGTOPDELTA === true
      const positionPermissions = positions.reduce<Record<string, boolean>>((permissions, position) => {
        const legacyKey = `can${position.name}`
        permissions[position.name] = position.type === 'ale' ? ale : legacy[legacyKey] !== false
        return permissions
      }, {})

      return {
        callsign,
        ale,
        unavailable: normalizeWeekdays(legacy.unavailable),
        positionPermissions,
      }
    })
    .filter((operator): operator is Operator => operator !== null)
}

const normalizeVacations = (value: unknown): VacationMap => {
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

    if (cleanEntries.length > 0) vacations[normalizeCode(callsign)] = cleanEntries
    return vacations
  }, {})
}

const normalizeSchedule = (value: unknown, positions: Position[]): Schedule => {
  if (!isRecord(value)) return {}

  return Object.entries(value).reduce<Schedule>((schedule, [date, legacyDay]) => {
    if (!isRecord(legacyDay)) return schedule

    const assignments = positions.reduce<Record<string, string>>((dayAssignments, position) => {
      const assigned = legacyDay[position.name.toLowerCase()]
        ?? (position.name === 'EXD' ? legacyDay.bigtopdelta : undefined)
      if (typeof assigned === 'string' && assigned.trim()) {
        dayAssignments[position.name] = normalizeCode(assigned)
      }
      return dayAssignments
    }, {})

    schedule[date] = {
      coverage: legacyDay.coverage !== false,
      assignments,
    }

    return schedule
  }, {})
}

export function importLegacyBackup(backup: LegacyBackupData): SchedulerData {
  const positions = normalizePositions(backup.positions)

  return {
    version: 2,
    regionName: '',
    setupComplete: true,
    backToBackPolicy: 'avoid',
    weekStartsOn: 1,
    operators: normalizeOperators(backup.operators, positions),
    positions,
    vacations: normalizeVacations(backup.vacations),
    holidays: [],
    schedule: normalizeSchedule(backup.schedule, positions),
  }
}
