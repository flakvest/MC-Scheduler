export type PositionCode = string
export type Callsign = string
export type IsoDate = string
export type PositionType = 'ale' | 'fixed'
export type AssignmentPeriod = 'daily' | 'weekly'
export type BackToBackPolicy = 'avoid' | 'allow'

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type Position = {
  name: PositionCode
  shortName: PositionCode
  displayName: string
  type: PositionType
  assignmentPeriod: AssignmentPeriod
  channel: string
  sortOrder: number
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

export type HolidaySource = 'manual' | 'generated' | 'lookup'

export type Holiday = {
  date: IsoDate
  name: string
  source: HolidaySource
}

export type ScheduleDay = {
  coverage: boolean
  assignments: Record<PositionCode, Callsign>
}

export type Schedule = Record<IsoDate, ScheduleDay>

export type SchedulerData = {
  version: 2
  regionName: string
  setupComplete: boolean
  backToBackPolicy: BackToBackPolicy
  weekStartsOn: Weekday
  operators: Operator[]
  positions: Position[]
  vacations: VacationMap
  holidays: Holiday[]
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
  holidays?: unknown
  schedule?: Record<IsoDate, LegacyScheduleDay>
}

export const POSITION_EXD = 'EXD'
export const POSITION_DW = 'DW'
export const POSITION_DR = 'DR'

export const region4ExamplePositions = (): Position[] => [
  { name: POSITION_EXD, shortName: POSITION_EXD, displayName: 'EXD', type: 'ale', assignmentPeriod: 'daily', channel: '', sortOrder: 1 },
  { name: POSITION_DW, shortName: POSITION_DW, displayName: 'DeltaWhite', type: 'fixed', assignmentPeriod: 'daily', channel: '', sortOrder: 2 },
  { name: POSITION_DR, shortName: POSITION_DR, displayName: 'DeltaRed', type: 'fixed', assignmentPeriod: 'daily', channel: '', sortOrder: 3 },
]

export const defaultPositions: Position[] = region4ExamplePositions()

export const emptySchedulerData = (): SchedulerData => ({
  version: 2,
  regionName: '',
  setupComplete: false,
  backToBackPolicy: 'avoid',
  weekStartsOn: 1,
  operators: [],
  positions: [],
  vacations: {},
  holidays: [],
  schedule: {},
})

export const isAleDuty = (position: Position) => position.type === 'ale'

export const sortedPositions = (positions: Position[]) =>
  [...positions].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
