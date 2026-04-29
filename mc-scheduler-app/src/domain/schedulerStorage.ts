import { emptySchedulerData, type SchedulerData } from './schedulerTypes'

const STORAGE_KEY = 'mc-scheduler-data-v1'

export function loadSchedulerData(): SchedulerData {
  const fallback = emptySchedulerData()

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return fallback

    const parsed = JSON.parse(stored) as Partial<SchedulerData>

    return {
      version: 1,
      operators: Array.isArray(parsed.operators) ? parsed.operators : fallback.operators,
      positions: Array.isArray(parsed.positions) && parsed.positions.length > 0 ? parsed.positions : fallback.positions,
      vacations: parsed.vacations && typeof parsed.vacations === 'object' ? parsed.vacations : fallback.vacations,
      schedule: parsed.schedule && typeof parsed.schedule === 'object' ? parsed.schedule : fallback.schedule,
    }
  } catch {
    return fallback
  }
}

export function saveSchedulerData(data: SchedulerData) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
