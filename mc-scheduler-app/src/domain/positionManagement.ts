import { POSITION_EXD, type Position, type PositionCode, type SchedulerData } from './schedulerTypes'

export type PositionManagementResult = {
  data: SchedulerData
  errors: string[]
}

export type EditPositionOptions = {
  allowCodeOrNameChange?: boolean
}

export type EditPositionInput = {
  positionCode: PositionCode
  updates: Partial<Pick<Position, 'name' | 'shortName' | 'requiresALE'>>
  options?: EditPositionOptions
}

const findPositionIndex = (positions: Position[], positionCode: PositionCode) =>
  positions.findIndex((position) => position.name === positionCode)

const withError = (data: SchedulerData, message: string): PositionManagementResult => ({
  data,
  errors: [message],
})

export function editPosition(data: SchedulerData, input: EditPositionInput): PositionManagementResult {
  const { positionCode, updates, options } = input
  const positionIndex = findPositionIndex(data.positions, positionCode)

  if (positionIndex === -1) return withError(data, 'Position does not exist.')

  const currentPosition = data.positions[positionIndex]
  const nextName = updates.name ?? currentPosition.name
  const nextShortName = updates.shortName ?? currentPosition.shortName
  const nextRequiresALE = updates.requiresALE ?? currentPosition.requiresALE
  const changingCodeOrName =
    nextName !== currentPosition.name || nextShortName !== currentPosition.shortName

  if (changingCodeOrName && !options?.allowCodeOrNameChange) {
    return withError(data, 'Position code/name change requires explicit confirmation.')
  }

  if (
    nextName !== currentPosition.name &&
    data.positions.some((position) => position.name === nextName)
  ) {
    return withError(data, 'Position already exists.')
  }

  if (nextName === POSITION_EXD && !nextRequiresALE) {
    return withError(data, 'EXD requires ALE.')
  }

  const nextData = structuredClone(data)
  nextData.positions[positionIndex] = {
    ...currentPosition,
    name: nextName,
    shortName: nextShortName,
    requiresALE: nextRequiresALE,
  }

  if (nextName !== currentPosition.name) {
    nextData.schedule = Object.fromEntries(
      Object.entries(nextData.schedule).map(([date, scheduleDay]) => {
        const assignments = { ...scheduleDay.assignments }

        if (currentPosition.name in assignments) {
          assignments[nextName] = assignments[currentPosition.name]
          delete assignments[currentPosition.name]
        }

        return [date, { ...scheduleDay, assignments }]
      }),
    )

    nextData.operators = nextData.operators.map((operator) => {
      const permissions = { ...operator.positionPermissions }
      if (currentPosition.name in permissions) {
        permissions[nextName] = permissions[currentPosition.name]
        delete permissions[currentPosition.name]
      }

      return { ...operator, positionPermissions: permissions }
    })
  }

  return { data: nextData, errors: [] }
}

export function deletePosition(data: SchedulerData, positionCode: PositionCode): PositionManagementResult {
  const positionIndex = findPositionIndex(data.positions, positionCode)
  if (positionIndex === -1) return withError(data, 'Position does not exist.')

  const nextData = structuredClone(data)
  nextData.positions = nextData.positions.filter((position) => position.name !== positionCode)

  nextData.schedule = Object.fromEntries(
    Object.entries(nextData.schedule).map(([date, scheduleDay]) => {
      const assignments = { ...scheduleDay.assignments }
      delete assignments[positionCode]
      return [date, { ...scheduleDay, assignments }]
    }),
  )

  nextData.operators = nextData.operators.map((operator) => {
    const permissions = { ...operator.positionPermissions }
    delete permissions[positionCode]
    return { ...operator, positionPermissions: permissions }
  })

  return { data: nextData, errors: [] }
}
