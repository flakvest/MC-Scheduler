import { describe, expect, it } from 'vitest'
import { generateScheduleText } from './scheduleOutput'
import { defaultPositions, type SchedulerData } from './schedulerTypes'

const data: SchedulerData = {
  version: 1,
  operators: [],
  positions: defaultPositions,
  vacations: {},
  holidays: [],
  schedule: {
    '2026-04-01': {
      coverage: true,
      assignments: { EXD: 'ALPHA', DW: 'BRAVO' },
    },
    '2026-04-02': {
      coverage: false,
      assignments: {},
    },
  },
}

describe('schedule output', () => {
  it('generates text output for the selected month', () => {
    const output = generateScheduleText(data, 2026, 4)

    expect(output).toContain('MARS SCHEDULE: APRIL 2026')
    expect(output).toContain('01: EXD:ALPHA | DW:BRAVO | DR:OPEN')
    expect(output).toContain('02: --- NO COVERAGE ---')
  })
})
