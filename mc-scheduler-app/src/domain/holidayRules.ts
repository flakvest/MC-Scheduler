import {
  type Holiday,
  type HolidaySource,
  type IsoDate,
  type Schedule,
  type SchedulerData,
} from './schedulerTypes'

type HolidayLookupItem = {
  date?: unknown
  localName?: unknown
  name?: unknown
  global?: unknown
}

const fixedHolidayNames: Record<string, string> = {
  '01-01': "New Year's Day",
  '06-19': 'Juneteenth National Independence Day',
  '07-04': 'Independence Day',
  '11-11': 'Veterans Day',
  '12-25': 'Christmas Day',
}

const fixedHolidayMonthDaysByName: Record<string, [number, number]> = {
  "new year's day": [0, 1],
  'juneteenth national independence day': [5, 19],
  'independence day': [6, 4],
  'veterans day': [10, 11],
  'christmas day': [11, 25],
}

const isIsoDate = (value: unknown): value is IsoDate =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

const dateKey = (date: Date): IsoDate => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const observedDate = (year: number, monthIndex: number, day: number): IsoDate => {
  const date = new Date(year, monthIndex, day)

  if (date.getDay() === 0) date.setDate(date.getDate() + 1)
  if (date.getDay() === 6) date.setDate(date.getDate() - 1)

  return dateKey(date)
}

const nthWeekdayOfMonth = (year: number, monthIndex: number, weekday: number, nth: number): IsoDate => {
  const date = new Date(year, monthIndex, 1)
  const offset = (weekday - date.getDay() + 7) % 7
  date.setDate(1 + offset + ((nth - 1) * 7))

  return dateKey(date)
}

const lastWeekdayOfMonth = (year: number, monthIndex: number, weekday: number): IsoDate => {
  const date = new Date(year, monthIndex + 1, 0)
  const offset = (date.getDay() - weekday + 7) % 7
  date.setDate(date.getDate() - offset)

  return dateKey(date)
}

export const normalizeHolidayName = (name: string) =>
  name.trim().replace(/\s+/g, ' ')

export const normalizeHolidays = (value: unknown): Holiday[] => {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item),
    )
    .map((item): Holiday | null => {
      const name = typeof item.name === 'string' ? normalizeHolidayName(item.name) : ''

      if (!isIsoDate(item.date) || !name) return null

      const source: HolidaySource = item.source === 'generated' || item.source === 'lookup'
        ? item.source
        : 'manual'

      return {
        date: item.date,
        name,
        source,
      }
    })
    .filter((holiday): holiday is Holiday => holiday !== null)
}

export const uniqueHolidays = (holidays: Holiday[]): Holiday[] => {
  const byDate = new Map<IsoDate, Holiday>()

  holidays.forEach((holiday) => {
    const existing = byDate.get(holiday.date)
    if (!existing || existing.source === 'generated') {
      byDate.set(holiday.date, holiday)
    }
  })

  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date))
}

export const generateFederalHolidays = (year: number): Holiday[] =>
  uniqueHolidays([
    { date: observedDate(year, 0, 1), name: fixedHolidayNames['01-01'], source: 'generated' },
    { date: nthWeekdayOfMonth(year, 0, 1, 3), name: 'Birthday of Martin Luther King, Jr.', source: 'generated' },
    { date: nthWeekdayOfMonth(year, 1, 1, 3), name: "Washington's Birthday", source: 'generated' },
    { date: lastWeekdayOfMonth(year, 4, 1), name: 'Memorial Day', source: 'generated' },
    { date: observedDate(year, 5, 19), name: fixedHolidayNames['06-19'], source: 'generated' },
    { date: observedDate(year, 6, 4), name: fixedHolidayNames['07-04'], source: 'generated' },
    { date: nthWeekdayOfMonth(year, 8, 1, 1), name: 'Labor Day', source: 'generated' },
    { date: nthWeekdayOfMonth(year, 9, 1, 2), name: 'Columbus Day', source: 'generated' },
    { date: observedDate(year, 10, 11), name: fixedHolidayNames['11-11'], source: 'generated' },
    { date: nthWeekdayOfMonth(year, 10, 4, 4), name: 'Thanksgiving Day', source: 'generated' },
    { date: observedDate(year, 11, 25), name: fixedHolidayNames['12-25'], source: 'generated' },
  ])

const observedFederalDateFromLookup = (date: IsoDate, name: string): IsoDate => {
  const fixedDate = fixedHolidayMonthDaysByName[name.toLowerCase()]
  if (!fixedDate) return date

  const year = Number(date.slice(0, 4))
  if (!Number.isInteger(year)) return date

  return observedDate(year, fixedDate[0], fixedDate[1])
}

export const fetchFederalHolidays = async (year: number): Promise<Holiday[]> => {
  const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/US`)

  if (!response.ok) {
    throw new Error(`Holiday lookup failed with status ${response.status}.`)
  }

  const items = await response.json() as HolidayLookupItem[]

  return uniqueHolidays(items
    .filter((item) => item.global !== false)
    .map((item): Holiday | null => {
      const name = typeof item.localName === 'string' ? item.localName : item.name
      if (!isIsoDate(item.date) || typeof name !== 'string') return null

      const normalizedName = normalizeHolidayName(name)
      if (!normalizedName) return null

      return {
        date: observedFederalDateFromLookup(item.date, normalizedName),
        name: normalizedName,
        source: 'lookup',
      }
    })
    .filter((holiday): holiday is Holiday => holiday !== null))
}

export const holidayForDate = (holidays: Holiday[], date: IsoDate) =>
  holidays.find((holiday) => holiday.date === date)

export const applyHolidaysToSchedule = (schedule: Schedule, holidays: Holiday[]): Schedule => {
  const nextSchedule = structuredClone(schedule)

  holidays.forEach((holiday) => {
    nextSchedule[holiday.date] = {
      coverage: false,
      assignments: {},
    }
  })

  return nextSchedule
}

export const applyHolidaysToData = (data: SchedulerData): SchedulerData => ({
  ...data,
  holidays: uniqueHolidays(data.holidays),
  schedule: applyHolidaysToSchedule(data.schedule, data.holidays),
})
