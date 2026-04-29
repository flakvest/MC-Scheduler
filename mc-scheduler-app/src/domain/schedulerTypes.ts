export type PositionCode = string
export type Callsign = string
export type IsoDate = string

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type Position = {
  name: PositionCode
  shortName: PositionCode
  requiresALE: boolean
}

export type Operator = {
  callsign: Callsign
  ale: boolean
  unavailable: Weekday[]
  positionPermissions: Record<PositionCode, boolean>
}

export type Vacation = {
  start: IsoDate
  end: IsoDate
}

export type VacationMap = Record<Callsign, Vacation[]>

export type ScheduleDay = {
  coverage: boolean
  assignments: Record<PositionCode, Callsign>
}

export type Schedule = Record<IsoDate, ScheduleDay>

export type SchedulerData = {
  version: 1
  operators: Operator[]
  positions: Position[]
  vacations: VacationMap
  schedule: Schedule
}

export type LegacyScheduleDay = {
  coverage?: boolean
  [positionCode: string]: string | boolean | undefined
}

export type LegacyBackupData = {
  operators?: unknown[]
  positions?: unknown[]
  vacations?: unknown
  schedule?: Record<IsoDate, LegacyScheduleDay>
}

export const POSITION_EXD = 'EXD'
export const POSITION_DW = 'DW'
export const POSITION_DR = 'DR'

export const defaultPositions: Position[] = [
  { name: POSITION_EXD, shortName: POSITION_EXD, requiresALE: true },
  { name: POSITION_DW, shortName: POSITION_DW, requiresALE: false },
  { name: POSITION_DR, shortName: POSITION_DR, requiresALE: false },
]

export const emptySchedulerData = (): SchedulerData => ({
  version: 1,
  operators: [],
  positions: defaultPositions,
  vacations: {},
  schedule: {},
})
