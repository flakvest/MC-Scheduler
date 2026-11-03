import { ensureMonthSchedule } from './schedulerRules'
import { sortedPositions, type SchedulerData } from './schedulerTypes'

const monthName = (year: number, month: number) =>
  new Date(year, month - 1).toLocaleString('default', { month: 'long' })

const dateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

export function generateScheduleText(data: SchedulerData, year: number, month: number) {
  const schedule = ensureMonthSchedule(data.schedule, year, month, data.holidays)
  const daysInMonth = new Date(year, month, 0).getDate()
  const title = data.regionName.trim()
    ? `${data.regionName.trim().toUpperCase()} SCHEDULE:`
    : 'MARS SCHEDULE:'
  const lines = [
    `${title} ${monthName(year, month).toUpperCase()} ${year}`,
    '='.repeat(30),
  ]

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = dateKey(year, month, day)
    const scheduleDay = schedule[key]

    if (!scheduleDay?.coverage) {
      lines.push(`${String(day).padStart(2, '0')}: --- NO COVERAGE ---`)
      continue
    }

    const assignments = sortedPositions(data.positions).map((position) => {
      const seat = position.channel ? `${position.shortName} ${position.channel}` : position.shortName
      return `${seat}:${scheduleDay.assignments[position.name] || 'OPEN'}`
    })

    lines.push(`${String(day).padStart(2, '0')}: ${assignments.join(' | ')}`)
  }

  return `${lines.join('\n')}\n`
}
