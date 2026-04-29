export interface SmartAssignSettings {
  version: 1
  maxShiftsPerMonth: number
  noBackToBack: boolean
  maxShiftsPerWeek: number
}

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const STORAGE_KEY = 'mc-scheduler-smart-assign-settings-v1'
const DEFAULT_MAX_SHIFTS_PER_MONTH = 5
const DEFAULT_MAX_SHIFTS_PER_WEEK = 2

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toPositiveInteger = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const normalized = Math.trunc(value)
  return normalized > 0 ? normalized : null
}

const fallbackSettings = (): SmartAssignSettings => ({
  version: 1,
  maxShiftsPerMonth: DEFAULT_MAX_SHIFTS_PER_MONTH,
  noBackToBack: true,
  maxShiftsPerWeek: DEFAULT_MAX_SHIFTS_PER_WEEK,
})

export function parseSmartAssignSettings(value: unknown): SmartAssignSettings {
  const fallback = fallbackSettings()
  if (!isRecord(value)) return fallback

  const maxShiftsPerMonth = toPositiveInteger(value.maxShiftsPerMonth)
    ?? toPositiveInteger(value.maxShifts)
    ?? fallback.maxShiftsPerMonth

  const noBackToBack = typeof value.noBackToBack === 'boolean'
    ? value.noBackToBack
    : typeof value.preventBackToBack === 'boolean'
      ? value.preventBackToBack
      : fallback.noBackToBack

  const maxShiftsPerWeek = toPositiveInteger(value.maxShiftsPerWeek)
    ?? (value.limitWeekly === true ? DEFAULT_MAX_SHIFTS_PER_WEEK : value.limitWeekly === false ? 7 : null)
    ?? fallback.maxShiftsPerWeek

  return {
    version: 1,
    maxShiftsPerMonth,
    noBackToBack,
    maxShiftsPerWeek,
  }
}

export function smartAssignSettingsToJson(settings: SmartAssignSettings) {
  return JSON.stringify(parseSmartAssignSettings(settings))
}

export function loadSmartAssignSettings(storage: StorageLike = window.localStorage): SmartAssignSettings {
  try {
    const stored = storage.getItem(STORAGE_KEY)
    if (!stored) return fallbackSettings()
    return parseSmartAssignSettings(JSON.parse(stored) as unknown)
  } catch {
    return fallbackSettings()
  }
}

export function saveSmartAssignSettings(
  settings: SmartAssignSettings,
  storage: StorageLike = window.localStorage,
) {
  storage.setItem(STORAGE_KEY, smartAssignSettingsToJson(settings))
}
