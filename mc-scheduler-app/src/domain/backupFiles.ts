import { importLegacyBackup } from './legacyBackup'
import { type LegacyBackupData, type SchedulerData } from './schedulerTypes'
import { applyHolidaysToData } from './holidayRules'
import { migrateSchedulerData } from './schedulerMigration'
import { parseSmartAssignSettings, type SmartAssignSettings } from './smartAssignSettings'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function parseBackupJson(jsonText: string): SchedulerData {
  const parsed = JSON.parse(jsonText) as unknown

  if (!isRecord(parsed)) {
    throw new Error('Backup file is not a JSON object.')
  }

  if ((parsed.version === 1 || parsed.version === 2) && Array.isArray(parsed.operators) && Array.isArray(parsed.positions)) {
    return applyHolidaysToData(migrateSchedulerData(parsed).data)
  }

  return importLegacyBackup(parsed as LegacyBackupData)
}

export function backupToJson(data: SchedulerData) {
  return JSON.stringify(data, null, 2)
}

export function fullBackupToJson(data: SchedulerData, settings: SmartAssignSettings) {
  return JSON.stringify({
    ...data,
    smartAssignSettings: parseSmartAssignSettings(settings),
  }, null, 2)
}

export function readSmartAssignSettingsFromBackup(jsonText: string): SmartAssignSettings | null {
  const parsed = JSON.parse(jsonText) as unknown
  if (!isRecord(parsed) || !isRecord(parsed.smartAssignSettings)) return null

  return parseSmartAssignSettings(parsed.smartAssignSettings)
}
