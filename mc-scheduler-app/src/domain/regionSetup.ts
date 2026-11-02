import { region4ExamplePositions, type SchedulerData } from './schedulerTypes'

export const POSITION_CODE_HELP = 'Position code must use only letters, numbers, or hyphens, up to 12 characters.'

export function normalizePositionCode(value: string): { code: string, error?: string } {
  const code = value.trim().toUpperCase()
  if (!code) return { code: '', error: 'Enter a position code.' }
  if (!/^[A-Z0-9-]{1,12}$/.test(code)) return { code: '', error: POSITION_CODE_HELP }
  return { code }
}

export function finishSetupBlocker(data: Pick<SchedulerData, 'regionName' | 'positions'>): string | null {
  const needsName = data.regionName.trim() === ''
  const needsPosition = data.positions.length === 0
  if (!needsName && !needsPosition) return null
  if (needsName && needsPosition) {
    return 'Enter a region name and add at least one position before finishing setup.'
  }
  if (needsName) return 'Enter a region name before finishing setup.'
  return 'Add at least one position, or load the Region 4 example, before finishing setup.'
}

export function loadRegion4ExampleData(data: SchedulerData): SchedulerData {
  const positions = region4ExamplePositions()
  const allowed = new Set(positions.map((position) => position.name))
  const schedule = Object.fromEntries(Object.entries(data.schedule).map(([date, day]) => {
    const assignments = Object.fromEntries(
      Object.entries(day.assignments).filter(([code]) => allowed.has(code)),
    )
    return [date, { ...day, assignments }]
  }))

  return {
    ...data,
    positions,
    schedule,
    operators: data.operators.map((operator) => ({
      ...operator,
      positionPermissions: {
        EXD: operator.ale,
        DW: true,
        DR: true,
      },
    })),
  }
}
