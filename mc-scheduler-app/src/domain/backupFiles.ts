import { importLegacyBackup } from './legacyBackup'
import { emptySchedulerData, type LegacyBackupData, type SchedulerData } from './schedulerTypes'
import { applyHolidaysToData, normalizeHolidays } from './holidayRules'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function parseBackupJson(jsonText: string): SchedulerData {
  const parsed = JSON.parse(jsonText) as unknown

  if (!isRecord(parsed)) {
    throw new Error('Backup file is not a JSON object.')
  }

  if (parsed.version === 1 && Array.isArray(parsed.operators) && Array.isArray(parsed.positions)) {
    const fallback = emptySchedulerData()
    const backup = parsed as Partial<SchedulerData>

    return applyHolidaysToData({
      version: 1,
      operators: Array.isArray(backup.operators) ? backup.operators : fallback.operators,
      positions: Array.isArray(backup.positions) && backup.positions.length > 0 ? backup.positions : fallback.positions,
      vacations: backup.vacations && typeof backup.vacations === 'object' ? backup.vacations : fallback.vacations,
      holidays: normalizeHolidays(backup.holidays),
      schedule: backup.schedule && typeof backup.schedule === 'object' ? backup.schedule : fallback.schedule,
    })
  }

  return importLegacyBackup(parsed as LegacyBackupData)
}

export function backupToJson(data: SchedulerData) {
  return JSON.stringify(data, null, 2)
}
