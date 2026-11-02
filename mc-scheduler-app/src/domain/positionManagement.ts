import { normalizePositionCode } from './regionSetup'
import { normalizeChannel } from './schedulerMigration'
import { isAleDuty, type Position, type PositionCode, type PositionType, type SchedulerData } from './schedulerTypes'

export type PositionManagementResult = {
  data: SchedulerData
  errors: string[]
}

export type EditPositionOptions = {
  allowCodeOrNameChange?: boolean
}

export type EditPositionInput = {
  positionCode: PositionCode
  updates: Partial<Pick<Position, 'name' | 'displayName' | 'type' | 'assignmentPeriod' | 'channel' | 'sortOrder'>>
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
  let nextName = currentPosition.name
  if (updates.name !== undefined) {
    const codeResult = normalizePositionCode(updates.name)
    if (codeResult.error) return withError(data, codeResult.error)
    nextName = codeResult.code
  }
  const nextType: PositionType = updates.type ?? currentPosition.type
  const nextDisplayName = updates.displayName?.trim() || currentPosition.displayName || nextName
  const nextSortOrder = updates.sortOrder ?? currentPosition.sortOrder
  const channelResult = updates.channel === undefined
    ? { channel: currentPosition.channel }
    : normalizeChannel(updates.channel)

  if (channelResult.error) return withError(data, channelResult.error)

  const changingCode = nextName !== currentPosition.name

  if (changingCode && !options?.allowCodeOrNameChange) {
    return withError(data, 'Position code/name change requires explicit confirmation.')
  }

  if (
    changingCode &&
    data.positions.some((position) => position.name === nextName)
  ) {
    return withError(data, 'Position already exists.')
  }

  const nextData = structuredClone(data)
  nextData.positions[positionIndex] = {
    ...currentPosition,
    name: nextName,
    shortName: nextName,
    displayName: nextDisplayName,
    type: nextType,
    assignmentPeriod: updates.assignmentPeriod ?? currentPosition.assignmentPeriod,
    channel: channelResult.channel,
    sortOrder: nextSortOrder,
  }

  if (changingCode) {
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
        permissions[nextName] = nextType === 'ale' ? operator.ale : permissions[currentPosition.name]
        delete permissions[currentPosition.name]
      }

      return { ...operator, positionPermissions: permissions }
    })
  }

  if (nextType === 'ale' || (currentPosition.type === 'ale' && nextType === 'fixed')) {
    nextData.operators = nextData.operators.map((operator) => ({
      ...operator,
      positionPermissions: {
        ...operator.positionPermissions,
        [nextName]: nextType === 'ale' ? operator.ale : true,
      },
    }))
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

export function isAleDutyPosition(position: Position) {
  return isAleDuty(position)
}
