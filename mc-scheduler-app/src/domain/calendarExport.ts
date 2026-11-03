import { sortedPositions, type IsoDate, type SchedulerData } from './schedulerTypes'

const PRODID = '-//MARS Message Center//MC Scheduler//EN'
const UID_DOMAIN = 'com.marsmessagecenter.scheduler'
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export type CalendarExportOptions = {
  month?: string
  operator?: string
  now?: Date
}

const addDays = (dateStr: IsoDate, days: number): IsoDate => {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  const monthNumber = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dayNumber = String(date.getUTCDate()).padStart(2, '0')
  return `${date.getUTCFullYear()}-${monthNumber}-${dayNumber}`
}

const compactDate = (dateStr: IsoDate) => dateStr.replaceAll('-', '')

const stamp = (date: Date) => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

const escapeText = (value: string) => value
  .replaceAll('\\', '\\\\')
  .replaceAll('\r\n', '\n')
  .replaceAll('\r', '\n')
  .replaceAll('\n', '\\n')
  .replaceAll(';', '\\;')
  .replaceAll(',', '\\,')

const foldLine = (line: string) => {
  const bytes = encoder.encode(line)
  if (bytes.length <= 75) return line

  const parts: string[] = []
  let start = 0
  let budget = 75
  while (start < bytes.length) {
    let end = Math.min(start + budget, bytes.length)
    while (end > start && (bytes[end] & 0b1100_0000) === 0b1000_0000) end -= 1
    if (end === start) end = Math.min(start + budget, bytes.length)
    parts.push(decoder.decode(bytes.subarray(start, end)))
    start = end
    budget = 74
  }

  return parts.map((part, index) => (index === 0 ? part : ` ${part}`)).join('\r\n')
}

const property = (name: string, value: string) => foldLine(`${name}:${escapeText(value)}`)

const uidToken = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '-')

const calendarName = (regionName: string) => {
  const region = regionName.trim()
  return region ? `${region} MC Schedule` : 'MARS MC Schedule'
}

export function calendarExportFilename(regionName: string, now = new Date()) {
  const slug = regionName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'mars'
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${slug}-schedule-${year}-${month}-${day}.ics`
}

export function generateScheduleIcs(data: SchedulerData, options: CalendarExportOptions = {}) {
  const now = options.now ?? new Date()
  const operatorFilter = options.operator?.trim().toUpperCase() ?? ''
  const positions = new Map(data.positions.map((position) => [position.name, position]))
  const events: string[] = []

  Object.keys(data.schedule)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()
    .forEach((date) => {
      if (options.month && !date.startsWith(`${options.month}-`)) return
      const day = data.schedule[date]
      if (!day?.coverage) return

      const ordered = sortedPositions(
        Object.keys(day.assignments)
          .map((code) => positions.get(code))
          .filter((position) => position !== undefined),
      )
      const known = new Set(ordered.map((position) => position.name))
      const extras = Object.keys(day.assignments)
        .filter((code) => !known.has(code))
        .sort()

      ;[...ordered.map((position) => position.name), ...extras].forEach((code) => {
        const callsign = day.assignments[code]?.trim()
        if (!callsign) return
        if (operatorFilter && callsign.toUpperCase() !== operatorFilter) return

        const position = positions.get(code)
        const positionName = position?.displayName || code
        const channel = position?.channel?.trim() ?? ''
        const region = data.regionName.trim()
        const description = [
          `Position: ${positionName}`,
          channel ? `Channel: ${channel}` : '',
          region ? `Region: ${region}` : '',
        ].filter(Boolean).join('\n')
        const nextDay = addDays(date, 1)
        const lines = [
          'BEGIN:VEVENT',
          property('UID', `${date}-${uidToken(code)}-${uidToken(callsign)}@${UID_DOMAIN}`),
          property('DTSTAMP', stamp(now)),
          `DTSTART;VALUE=DATE:${compactDate(date)}`,
          `DTEND;VALUE=DATE:${compactDate(nextDay)}`,
          property('SUMMARY', `${code} – ${callsign}`),
          property('DESCRIPTION', description),
          'END:VEVENT',
        ]
        events.push(lines.join('\r\n'))
      })
    })

  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    property('X-WR-CALNAME', calendarName(data.regionName)),
    ...events,
    'END:VCALENDAR',
    '',
  ]

  return calendar.join('\r\n')
}
