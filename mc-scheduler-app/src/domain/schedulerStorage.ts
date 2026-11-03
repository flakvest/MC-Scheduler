import { getVersion } from '@tauri-apps/api/app'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { emptySchedulerData, type SchedulerData } from './schedulerTypes'
import { applyHolidaysToData } from './holidayRules'
import { migrateSchedulerData } from './schedulerMigration'

const STORAGE_KEY = 'mc-scheduler-data-v1'
const PREMIGRATION_KEY = 'mc-scheduler-data-v1-premigration'

export type SchedulerStorageMode = 'appdata' | 'browser'

export type SchedulerStorageInfo = {
  mode: SchedulerStorageMode
  location: string
  dataFile: string
  yearlyScheduleFolder: string
  backupFolder: string
  canOpenFolder: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const browserStorageInfo = (): SchedulerStorageInfo => ({
  mode: 'browser',
  location: 'Browser localStorage',
  dataFile: 'Browser localStorage',
  yearlyScheduleFolder: 'Browser localStorage',
  backupFolder: 'Manual exports only',
  canOpenFolder: false,
})

const fallbackSchedulerData = (): SchedulerData => emptySchedulerData()

const normalizeSchedulerData = (value: unknown): { data: SchedulerData, migrated: boolean } => {
  const prepared = migrateSchedulerData(value)
  return { data: applyHolidaysToData(prepared.data), migrated: prepared.migrated }
}

const rememberBrowserPremigration = (stored: string) => {
  if (!window.localStorage.getItem(PREMIGRATION_KEY)) {
    window.localStorage.setItem(PREMIGRATION_KEY, stored)
  }
}

const parseStoredBrowserData = (): { data: SchedulerData, migrated: boolean } => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return { data: fallbackSchedulerData(), migrated: false }

    const prepared = normalizeSchedulerData(JSON.parse(stored) as unknown)
    if (prepared.migrated) rememberBrowserPremigration(stored)
    return prepared
  } catch {
    return { data: fallbackSchedulerData(), migrated: false }
  }
}

const hasStoredWork = (data: SchedulerData): boolean =>
  data.operators.length > 0 ||
  data.positions.length > 0 ||
  data.regionName.trim() !== '' ||
  Object.keys(data.vacations).length > 0 ||
  data.holidays.length > 0 ||
  Object.keys(data.schedule).length > 0

const parseStoredJson = (value: unknown): { data: SchedulerData, migrated: boolean } => {
  if (typeof value === 'string') {
    try {
      return normalizeSchedulerData(JSON.parse(value) as unknown)
    } catch {
      return { data: fallbackSchedulerData(), migrated: false }
    }
  }

  return normalizeSchedulerData(value)
}

const normalizeStoragePaths = (value: unknown) => {
  if (Array.isArray(value)) {
    return {
      dataFile: typeof value[0] === 'string' ? value[0] : 'AppData scheduler.json',
      dataFolder: typeof value[1] === 'string' ? value[1] : 'AppData',
      backupFolder: typeof value[2] === 'string' ? value[2] : 'AppData backups',
      yearlyScheduleFolder: typeof value[3] === 'string' ? value[3] : 'AppData yearly schedules',
    }
  }

  if (isRecord(value)) {
    return {
      dataFile: typeof value.dataFile === 'string' ? value.dataFile : 'AppData scheduler.json',
      dataFolder: typeof value.dataFolder === 'string' ? value.dataFolder : 'AppData',
      backupFolder: typeof value.backupFolder === 'string' ? value.backupFolder : 'AppData backups',
      yearlyScheduleFolder: typeof value.yearlyScheduleFolder === 'string'
        ? value.yearlyScheduleFolder
        : 'AppData yearly schedules',
    }
  }

  return {
    dataFile: 'AppData scheduler.json',
    dataFolder: 'AppData',
    backupFolder: 'AppData backups',
    yearlyScheduleFolder: 'AppData yearly schedules',
  }
}

export async function loadSchedulerData(): Promise<{ data: SchedulerData, migrated: boolean }> {
  if (!isTauri()) {
    return parseStoredBrowserData()
  }

  try {
    const stored = await invoke<unknown>('load_scheduler_data')
    const appData = parseStoredJson(stored)
    const browserData = parseStoredBrowserData()

    if (!hasStoredWork(appData.data) && hasStoredWork(browserData.data)) {
      await saveSchedulerData(browserData.data)
      return browserData
    }

    return appData
  } catch {
    const browserData = parseStoredBrowserData()
    return hasStoredWork(browserData.data)
      ? browserData
      : { data: fallbackSchedulerData(), migrated: false }
  }
}

export async function saveSchedulerData(data: SchedulerData): Promise<boolean> {
  if (!isTauri()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  }

  try {
    await invoke('save_scheduler_data', { json: JSON.stringify(data, null, 2) })
    return true
  } catch {
    return false
  }
}

export async function getSchedulerStorageInfo(): Promise<SchedulerStorageInfo> {
  if (!isTauri()) {
    return browserStorageInfo()
  }

  try {
    const paths = normalizeStoragePaths(await invoke<unknown>('get_scheduler_storage_paths'))

    return {
      mode: 'appdata',
      location: paths.dataFolder,
      dataFile: paths.dataFile,
      yearlyScheduleFolder: paths.yearlyScheduleFolder,
      backupFolder: paths.backupFolder,
      canOpenFolder: true,
    }
  } catch {
    return {
      mode: 'appdata',
      location: 'AppData',
      dataFile: 'AppData scheduler.json',
      yearlyScheduleFolder: 'AppData yearly schedules',
      backupFolder: 'AppData backups',
      canOpenFolder: true,
    }
  }
}

export async function openSchedulerDataFolder(): Promise<boolean> {
  if (!isTauri()) return false

  try {
    await invoke('open_scheduler_data_folder')
    return true
  } catch {
    return false
  }
}

export async function getAppVersion(): Promise<string> {
  if (!isTauri()) return '0.2.0'

  try {
    return await getVersion()
  } catch {
    return '0.2.0'
  }
}
