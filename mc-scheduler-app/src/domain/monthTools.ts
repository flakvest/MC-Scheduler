import type { IsoDate, Schedule, SchedulerData } from './schedulerTypes'

const isIsoDateInMonth = (isoDate: IsoDate, month: string): boolean => isoDate.startsWith(`${month}-`)

const cloneScheduleWithClearedMonthAssignments = (schedule: Schedule, month: string): Schedule => {
  const nextSchedule: Schedule = {}

  for (const [isoDate, day] of Object.entries(schedule)) {
    if (isIsoDateInMonth(isoDate, month)) {
      nextSchedule[isoDate] = {
        ...day,
        assignments: {},
      }
      continue
    }

    nextSchedule[isoDate] = day
  }

  return nextSchedule
}

const pickScheduleMonth = (schedule: Schedule, month: string): Schedule => {
  const monthSchedule: Schedule = {}

  for (const [isoDate, day] of Object.entries(schedule)) {
    if (isIsoDateInMonth(isoDate, month)) {
      monthSchedule[isoDate] = day
    }
  }

  return monthSchedule
}

export function clearAssignmentsForMonth(data: SchedulerData, month: string): SchedulerData {
  return {
    ...data,
    schedule: cloneScheduleWithClearedMonthAssignments(data.schedule, month),
  }
}

export function monthHasAssignments(data: SchedulerData, month: string): boolean {
  for (const [isoDate, day] of Object.entries(data.schedule)) {
    if (isIsoDateInMonth(isoDate, month) && Object.keys(day.assignments).length > 0) {
      return true
    }
  }

  return false
}

export function createMonthSnapshot(data: SchedulerData, month: string): SchedulerData {
  return {
    version: 1,
    operators: data.operators,
    positions: data.positions,
    vacations: data.vacations,
    schedule: pickScheduleMonth(data.schedule, month),
  }
}
