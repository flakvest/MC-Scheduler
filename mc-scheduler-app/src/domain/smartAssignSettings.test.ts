import { describe, expect, it } from 'vitest'
import {
  loadSmartAssignSettings,
  parseSmartAssignSettings,
  saveSmartAssignSettings,
  smartAssignSettingsToJson,
  type SmartAssignSettings,
} from './smartAssignSettings'

describe('smart assign settings', () => {
  it('returns defaults for missing or invalid JSON data', () => {
    const emptyStorage = {
      getItem: () => null,
      setItem: () => {},
    }
    const brokenStorage = {
      getItem: () => '{bad json',
      setItem: () => {},
    }

    expect(loadSmartAssignSettings(emptyStorage)).toEqual({
      version: 1,
      maxShiftsPerMonth: 5,
      noBackToBack: true,
      maxShiftsPerWeek: 2,
    })
    expect(loadSmartAssignSettings(brokenStorage)).toEqual({
      version: 1,
      maxShiftsPerMonth: 5,
      noBackToBack: true,
      maxShiftsPerWeek: 2,
    })
  })

  it('round-trips settings through JSON and storage', () => {
    const memory = new Map<string, string>()
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value) },
    }
    const input: SmartAssignSettings = {
      version: 1,
      maxShiftsPerMonth: 7,
      noBackToBack: false,
      maxShiftsPerWeek: 3,
    }

    const json = smartAssignSettingsToJson(input)
    expect(parseSmartAssignSettings(JSON.parse(json) as unknown)).toEqual(input)

    saveSmartAssignSettings(input, storage)
    expect(loadSmartAssignSettings(storage)).toEqual(input)
  })

  it('handles partial and legacy-shaped input safely', () => {
    expect(parseSmartAssignSettings({
      maxShiftsPerMonth: 9,
    })).toEqual({
      version: 1,
      maxShiftsPerMonth: 9,
      noBackToBack: true,
      maxShiftsPerWeek: 2,
    })

    expect(parseSmartAssignSettings({
      maxShiftsPerMonth: -3,
      noBackToBack: 'yes',
      maxShiftsPerWeek: 0,
    })).toEqual({
      version: 1,
      maxShiftsPerMonth: 5,
      noBackToBack: true,
      maxShiftsPerWeek: 2,
    })

    expect(parseSmartAssignSettings({
      maxShifts: 6,
      preventBackToBack: false,
      limitWeekly: true,
    })).toEqual({
      version: 1,
      maxShiftsPerMonth: 6,
      noBackToBack: false,
      maxShiftsPerWeek: 2,
    })
  })
})
