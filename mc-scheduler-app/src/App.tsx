import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { calendarExportFilename, generateScheduleIcs } from './domain/calendarExport'
import { backupToJson, fullBackupToJson, parseBackupJson, readSmartAssignSettingsFromBackup } from './domain/backupFiles'
import {
  describeBackupLocation,
  fullBackupFilename,
  isDesktopApp,
  lookForUpdate,
  type DesktopUpdate,
} from './domain/appUpdates'
import { UpdateDialog } from './UpdateDialog'
import { clearAssignmentsForMonth, createMonthSnapshot, monthHasAssignments } from './domain/monthTools'
import { deletePosition, editPosition } from './domain/positionManagement'
import { generateScheduleText } from './domain/scheduleOutput'
import { assignOperator, canAssignOperator, ensureMonthSchedule, findOpenAssignmentIssues, getShiftCount, handPickShiftLimitWarnings, operatorsReplacedByWeeklyAssign, setCoverage, smartAssign, type AssignmentIssue } from './domain/schedulerRules'
import { getAppVersion, getSchedulerStorageInfo, loadSchedulerData, openSchedulerDataFolder, saveSchedulerData, type SchedulerStorageInfo } from './domain/schedulerStorage'
import { applyHolidaysToData, fetchFederalHolidays, generateFederalHolidays, holidayForDate, normalizeHolidayName, uniqueHolidays } from './domain/holidayRules'
import { normalizeChannel } from './domain/schedulerMigration'
import { finishSetupBlocker, loadRegion4ExampleData, normalizePositionCode, parseOperatorShiftLimit } from './domain/regionSetup'
import { emptySchedulerData, MAX_SHIFTS_PER_MONTH_CAP, MAX_SHIFTS_PER_WEEK_CAP, sortedPositions, type Holiday, type PositionType, type SchedulerData, type VacationMap, type Weekday } from './domain/schedulerTypes'
import { loadSmartAssignSettings, saveSmartAssignSettings } from './domain/smartAssignSettings'

function shiftLimitChoices(maximum: number) {
  return Array.from({ length: maximum + 1 }, (_, value) => value)
}

function ShiftLimitFields({
  month,
  week,
  onMonth,
  onWeek,
}: {
  month: number
  week: number
  onMonth: (value: number) => void
  onWeek: (value: number) => void
}) {
  return (
    <>
      <label>
        Max shifts/month
        <select value={month} onChange={(event) => onMonth(Number(event.target.value))}>
          {shiftLimitChoices(MAX_SHIFTS_PER_MONTH_CAP).map((value) => (
            <option value={value} key={value}>{value === 0 ? 'No limit' : value}</option>
          ))}
        </select>
      </label>
      <label>
        Max daily shifts/week
        <select value={week} onChange={(event) => onWeek(Number(event.target.value))}>
          {shiftLimitChoices(MAX_SHIFTS_PER_WEEK_CAP).map((value) => (
            <option value={value} key={value}>{value === 0 ? 'No limit' : value}</option>
          ))}
        </select>
      </label>
    </>
  )
}

const weekdays: { label: string, value: Weekday }[] = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
]
const weekStartDays: { label: string, value: Weekday }[] = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
]
const today = new Date()
const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  label: new Date(2000, index, 1).toLocaleString('default', { month: 'long' }),
  value: index + 1,
}))

const monthName = (year: number, month: number) =>
  new Date(year, month - 1).toLocaleString('default', { month: 'long' })

const monthPrefix = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, '0')}`

const dateKey = (year: number, month: number, day: number) =>
  `${monthPrefix(year, month)}-${String(day).padStart(2, '0')}`

type AdminPanel = 'operators' | 'positions' | 'vacations' | 'holidays'
type ConfirmAction = {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
}

function App() {
  const [data, setData] = useState<SchedulerData>(() => emptySchedulerData())
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [statusMessage, setStatusMessage] = useState('Loading scheduler data...')
  const [storageReady, setStorageReady] = useState(false)
  const [storageInfo, setStorageInfo] = useState<SchedulerStorageInfo>({
    mode: 'browser',
    location: 'Browser localStorage',
    dataFile: 'Browser localStorage',
    yearlyScheduleFolder: 'Browser localStorage',
    backupFolder: 'Manual exports only',
    canOpenFolder: false,
  })
  const [appVersion, setAppVersion] = useState('0.1.0')
  const [availableUpdate, setAvailableUpdate] = useState<DesktopUpdate | null>(null)
  const [updateBackupPath, setUpdateBackupPath] = useState<string | null>(null)
  const [updateBackupMessage, setUpdateBackupMessage] = useState<string | null>(null)
  const [updateSkipConfirmed, setUpdateSkipConfirmed] = useState(false)
  const [confirmingUpdateSkip, setConfirmingUpdateSkip] = useState(false)
  const [updateInstalling, setUpdateInstalling] = useState(false)
  const [updateProgress, setUpdateProgress] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [newCallsign, setNewCallsign] = useState('')
  const [newOperatorAle, setNewOperatorAle] = useState(false)
  const [newOperatorUnavailable, setNewOperatorUnavailable] = useState<Weekday[]>([])
  const [newOperatorPermissions, setNewOperatorPermissions] = useState<Record<string, boolean>>({})
  const [newOperatorMonthLimit, setNewOperatorMonthLimit] = useState('')
  const [newOperatorWeekLimit, setNewOperatorWeekLimit] = useState('')
  const [editingOperatorCallsign, setEditingOperatorCallsign] = useState<string | null>(null)
  const [newPositionCode, setNewPositionCode] = useState('')
  const [newPositionDisplayName, setNewPositionDisplayName] = useState('')
  const [newPositionType, setNewPositionType] = useState<PositionType>('fixed')
  const [newPositionPeriod, setNewPositionPeriod] = useState<'daily' | 'weekly'>('daily')
  const [newPositionChannel, setNewPositionChannel] = useState('')
  const [newPositionSort, setNewPositionSort] = useState('')
  const [editingPositionCode, setEditingPositionCode] = useState<string | null>(null)
  const [vacationCallsign, setVacationCallsign] = useState('')
  const [vacationStart, setVacationStart] = useState('')
  const [vacationEnd, setVacationEnd] = useState('')
  const [holidayName, setHolidayName] = useState('')
  const [holidayDate, setHolidayDate] = useState('')
  const [activeAdminPanel, setActiveAdminPanel] = useState<AdminPanel | null>(null)
  const [smartAssignSettings, setSmartAssignSettings] = useState(() => loadSmartAssignSettings())
  const [assignmentIssues, setAssignmentIssues] = useState<AssignmentIssue[]>([])
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [calendarExportOpen, setCalendarExportOpen] = useState(false)
  const [calendarExportMonthOnly, setCalendarExportMonthOnly] = useState(false)
  const [calendarExportOperator, setCalendarExportOperator] = useState('')
  const importInputRef = useRef<HTMLInputElement>(null)
  const finishSetupRef = useRef<HTMLParagraphElement>(null)
  const skipNextSaveRef = useRef(true)

  const scheduleData = useMemo(() => ({
    ...data,
    schedule: ensureMonthSchedule(data.schedule, year, month, data.holidays),
  }), [data, month, year])

  useEffect(() => {
    let active = true

    const hydrateStorage = async () => {
      const [loaded, loadedStorageInfo, loadedAppVersion] = await Promise.all([
        loadSchedulerData(),
        getSchedulerStorageInfo(),
        getAppVersion(),
      ])

      if (!active) return

      skipNextSaveRef.current = !loaded.migrated
      setData(loaded.data)
      setStorageInfo(loadedStorageInfo)
      setAppVersion(loadedAppVersion)
      setStorageReady(true)
      setStatusMessage(
        loadedStorageInfo.mode === 'appdata'
          ? `Loaded scheduler data from ${loadedStorageInfo.location}.`
          : 'Loaded scheduler data from browser localStorage.',
      )
    }

    void hydrateStorage()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!storageReady) return

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }

    const saveTimer = window.setTimeout(() => {
      void saveSchedulerData(data).then((saved) => {
        if (!saved) setStatusMessage('Automatic save failed. Export a backup before closing.')
      })
    }, 500)

    return () => window.clearTimeout(saveTimer)
  }, [data, storageReady])

  useEffect(() => {
    saveSmartAssignSettings(smartAssignSettings)
  }, [smartAssignSettings])

  useEffect(() => {
    let active = true

    const checkOnLaunch = async () => {
      try {
        const update = await lookForUpdate()
        if (!active || !update) return
        setAvailableUpdate(update)
        setUpdateBackupPath(null)
        setUpdateBackupMessage(null)
        setUpdateSkipConfirmed(false)
        setConfirmingUpdateSkip(false)
        setUpdateError(null)
        setUpdateProgress(null)
        setStatusMessage(`Update ${update.version} is available. Back up the full database before installing.`)
      } catch {
        // A failed launch check stays quiet. The manual check reports the problem.
      }
    }

    void checkOnLaunch()
    return () => {
      active = false
    }
  }, [])

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const trailingBlankDays = (7 - ((firstWeekday + daysInMonth) % 7)) % 7
  const currentPrefix = monthPrefix(year, month)
  const scheduleText = generateScheduleText(scheduleData, year, month)
  const openShiftCount = Object.entries(scheduleData.schedule)
    .filter(([date]) => date.startsWith(currentPrefix))
    .reduce((count, [, day]) => {
      if (!day.coverage) return count
      const openPositions = scheduleData.positions.filter((position) => !day.assignments[position.name]).length
      return count + openPositions
    }, 0)
  const currentMonthHolidayCount = scheduleData.holidays
    .filter((holiday) => holiday.date.startsWith(currentPrefix))
    .length

  const moveMonth = (offset: number) => {
    const next = new Date(year, month - 1 + offset, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth() + 1)
  }

  const jumpToNextMonth = () => {
    const next = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth() + 1)
  }

  const schedulingOptions = {
    year,
    month,
    maxShifts: data.maxShiftsPerMonth,
    preventBackToBack: data.backToBackPolicy !== 'allow',
    maxShiftsPerWeek: data.maxShiftsPerWeek,
  }

  const runSmartAssign = () => {
    const options = schedulingOptions
    const result = smartAssign(scheduleData, {
      ...options,
    })

    setData(result.data)
    setAssignmentIssues(result.issues)
    setStatusMessage(`Smart assign filled ${result.assignedCount} shifts; ${result.blockedCount} could not be filled.`)
  }

  const refreshAssignmentIssues = () => {
    const issues = findOpenAssignmentIssues(scheduleData, schedulingOptions)

    setAssignmentIssues(issues)
    setStatusMessage(issues.length === 0 ? 'No open assignment issues found.' : `${issues.length} open assignment issues found.`)
  }

  const toggleUnavailableDay = (weekday: Weekday) => {
    setNewOperatorUnavailable((current) =>
      current.includes(weekday) ? current.filter((day) => day !== weekday) : [...current, weekday],
    )
  }

  const togglePositionPermission = (positionName: string) => {
    setNewOperatorPermissions((current) => ({
      ...current,
      [positionName]: current[positionName] === false,
    }))
  }

  const resetOperatorForm = () => {
    setNewCallsign('')
    setNewOperatorAle(false)
    setNewOperatorUnavailable([])
    setNewOperatorPermissions({})
    setNewOperatorMonthLimit('')
    setNewOperatorWeekLimit('')
    setEditingOperatorCallsign(null)
  }

  const operatorLimitFields = () => {
    const month = parseOperatorShiftLimit(newOperatorMonthLimit, MAX_SHIFTS_PER_MONTH_CAP, 'Max shifts per month')
    const week = parseOperatorShiftLimit(newOperatorWeekLimit, MAX_SHIFTS_PER_WEEK_CAP, 'Max daily shifts per rolling week')
    if (month.error) return { error: month.error }
    if (week.error) return { error: week.error }
    return {
      limits: {
        ...(month.limit === undefined ? {} : { maxShiftsPerMonth: month.limit }),
        ...(week.limit === undefined ? {} : { maxShiftsPerWeek: week.limit }),
      },
    }
  }

  const startEditOperator = (callsign: string) => {
    const operator = data.operators.find((item) => item.callsign === callsign)
    if (!operator) return

    setEditingOperatorCallsign(operator.callsign)
    setNewCallsign(operator.callsign)
    setNewOperatorAle(operator.ale)
    setNewOperatorUnavailable(operator.unavailable)
    setNewOperatorPermissions(operator.positionPermissions)
    setNewOperatorMonthLimit(operator.maxShiftsPerMonth === undefined ? '' : String(operator.maxShiftsPerMonth))
    setNewOperatorWeekLimit(operator.maxShiftsPerWeek === undefined ? '' : String(operator.maxShiftsPerWeek))
  }

  const addOperator = () => {
    const callsign = newCallsign.trim().toUpperCase()

    if (!callsign) {
      setStatusMessage('Enter a callsign before adding an operator.')
      return
    }

    if (data.operators.some((operator) => operator.callsign === callsign)) {
      setStatusMessage(`${callsign} already exists.`)
      return
    }

    const parsedLimits = operatorLimitFields()
    if (parsedLimits.error) {
      setStatusMessage(parsedLimits.error)
      return
    }

    const positionPermissions = data.positions.reduce<Record<string, boolean>>((permissions, position) => {
      permissions[position.name] = position.type === 'ale'
        ? newOperatorAle
        : newOperatorPermissions[position.name] !== false
      return permissions
    }, {})

    setData((current) => ({
      ...current,
      operators: [
        ...current.operators,
        {
          callsign,
          ale: newOperatorAle,
          unavailable: [...newOperatorUnavailable].sort(),
          positionPermissions,
          ...parsedLimits.limits,
        },
      ],
    }))
    resetOperatorForm()
    setStatusMessage(`${callsign} added.`)
  }

  const saveOperatorEdit = () => {
    if (!editingOperatorCallsign) return

    const callsign = newCallsign.trim().toUpperCase()

    if (!callsign) {
      setStatusMessage('Enter a callsign before saving the operator.')
      return
    }

    if (data.operators.some((operator) => operator.callsign === callsign && operator.callsign !== editingOperatorCallsign)) {
      setStatusMessage(`${callsign} already exists.`)
      return
    }

    const parsedLimits = operatorLimitFields()
    if (parsedLimits.error) {
      setStatusMessage(parsedLimits.error)
      return
    }

    const positionPermissions = data.positions.reduce<Record<string, boolean>>((permissions, position) => {
      permissions[position.name] = position.type === 'ale'
        ? newOperatorAle
        : newOperatorPermissions[position.name] !== false
      return permissions
    }, {})

    setData((current) => ({
      ...current,
      operators: current.operators.map((operator) => operator.callsign === editingOperatorCallsign
        ? {
            callsign,
            ale: newOperatorAle,
            unavailable: [...newOperatorUnavailable].sort(),
            positionPermissions,
            ...parsedLimits.limits,
          }
        : operator),
      schedule: Object.entries(current.schedule).reduce<SchedulerData['schedule']>((schedule, [date, day]) => {
        schedule[date] = {
          ...day,
          assignments: Object.entries(day.assignments).reduce<Record<string, string>>((assignments, [position, assignedCallsign]) => {
            assignments[position] = assignedCallsign === editingOperatorCallsign ? callsign : assignedCallsign
            return assignments
          }, {}),
        }
        return schedule
      }, {}),
      vacations: callsign === editingOperatorCallsign || !current.vacations[editingOperatorCallsign]
        ? current.vacations
        : Object.entries(current.vacations).reduce<VacationMap>((vacations, [key, entries]) => {
            vacations[key === editingOperatorCallsign ? callsign : key] = entries
            return vacations
          }, {}),
    }))
    resetOperatorForm()
    setStatusMessage(`${callsign} updated. Existing assignments were left unchanged.`)
  }

  const deleteOperatorNow = (callsign: string) => {
    let clearedAssignments = 0

    setData((current) => {
      const vacations = { ...current.vacations }
      delete vacations[callsign]

      return {
        ...current,
        operators: current.operators.filter((operator) => operator.callsign !== callsign),
        vacations,
        schedule: Object.entries(current.schedule).reduce<SchedulerData['schedule']>((schedule, [date, day]) => {
          schedule[date] = {
            ...day,
            assignments: Object.entries(day.assignments).reduce<Record<string, string>>((assignments, [position, assignedCallsign]) => {
              if (assignedCallsign === callsign) {
                clearedAssignments += 1
                return assignments
              }

              assignments[position] = assignedCallsign
              return assignments
            }, {}),
          }
          return schedule
        }, {}),
      }
    })

    if (editingOperatorCallsign === callsign) resetOperatorForm()
    setStatusMessage(`${callsign} deleted. Cleared ${clearedAssignments} assignments and removed vacation entries.`)
  }

  const confirmDeleteOperator = (callsign: string) => {
    setConfirmAction({
      title: `Delete ${callsign}?`,
      message: 'This will remove the operator, clear their assignments, and remove their vacation entries.',
      confirmLabel: 'Delete Operator',
      onConfirm: () => deleteOperatorNow(callsign),
    })
  }

  const addPosition = () => {
    const codeResult = normalizePositionCode(newPositionCode)
    const positionCode = codeResult.code

    if (codeResult.error) {
      setStatusMessage(codeResult.error)
      return
    }

    if (data.positions.some((position) => position.name === positionCode)) {
      setStatusMessage(`${positionCode} already exists.`)
      return
    }

    const channelResult = normalizeChannel(newPositionChannel)
    if (channelResult.error) {
      setStatusMessage(channelResult.error)
      return
    }

    const sortOrder = newPositionSort.trim() === ''
      ? Math.max(0, ...data.positions.map((position) => position.sortOrder)) + 1
      : Number(newPositionSort)
    if (!Number.isInteger(sortOrder)) {
      setStatusMessage('Sort order must be a whole number.')
      return
    }

    const displayName = newPositionDisplayName.trim() || positionCode

    setData((current) => ({
      ...current,
      positions: [
        ...current.positions,
        {
          name: positionCode,
          shortName: positionCode,
          displayName,
          type: newPositionType,
          assignmentPeriod: newPositionPeriod,
          channel: channelResult.channel,
          sortOrder,
        },
      ],
      operators: current.operators.map((operator) => ({
        ...operator,
        positionPermissions: {
          ...operator.positionPermissions,
          [positionCode]: newPositionType === 'ale' ? operator.ale : true,
        },
      })),
    }))
    resetPositionForm()
    setStatusMessage(`${positionCode} position added.`)
  }

  const applyRegion4Example = () => {
    setData((current) => loadRegion4ExampleData(current))
    setStatusMessage('Loaded the Region 4 example: EXD, DeltaWhite, and DeltaRed.')
  }

  const loadRegion4Example = () => {
    if (data.positions.length === 0) {
      applyRegion4Example()
      return
    }

    setConfirmAction({
      title: 'Replace the current positions?',
      message: 'Load Region 4 example replaces the position list with EXD, DeltaWhite, and DeltaRed. Assignments for any other seat are removed so they cannot keep a person from taking a seat that day.',
      confirmLabel: 'Load Example',
      onConfirm: applyRegion4Example,
    })
  }

  const finishRegionSetup = () => {
    const blocker = finishSetupBlocker(data)
    if (blocker) {
      window.setTimeout(() => {
        finishSetupRef.current?.scrollIntoView({ block: 'center' })
        finishSetupRef.current?.focus()
      }, 0)
      return
    }

    setData((current) => ({ ...current, setupComplete: true }))
    setStatusMessage(`${data.regionName.trim()} is ready to schedule.`)
  }

  const resetPositionForm = () => {
    setNewPositionCode('')
    setNewPositionDisplayName('')
    setNewPositionType('fixed')
    setNewPositionPeriod('daily')
    setNewPositionChannel('')
    setNewPositionSort('')
    setEditingPositionCode(null)
  }

  const startEditPosition = (positionCode: string) => {
    const position = data.positions.find((item) => item.name === positionCode)
    if (!position) return

    setEditingPositionCode(position.name)
    setNewPositionCode(position.name)
    setNewPositionDisplayName(position.displayName)
    setNewPositionType(position.type)
    setNewPositionPeriod(position.assignmentPeriod)
    setNewPositionChannel(position.channel)
    setNewPositionSort(String(position.sortOrder))
  }

  const savePositionEdit = () => {
    if (!editingPositionCode) return

    const codeResult = normalizePositionCode(newPositionCode)
    const positionCode = codeResult.code

    if (codeResult.error) {
      setStatusMessage(codeResult.error === 'Enter a position code.'
        ? 'Enter a position code before saving the position.'
        : codeResult.error)
      return
    }

    const currentPosition = data.positions.find((position) => position.name === editingPositionCode)
    if (!currentPosition) {
      setStatusMessage('Position does not exist.')
      return
    }

    const codeChanged = positionCode !== currentPosition.name || positionCode !== currentPosition.shortName
    if (codeChanged) {
      setConfirmAction({
        title: `Rename ${currentPosition.shortName}?`,
        message: `Existing assignments and operator permissions will be updated to use ${positionCode}.`,
        confirmLabel: 'Rename Position',
        onConfirm: () => savePositionEditNow(positionCode, codeChanged),
      })
      return
    }

    savePositionEditNow(positionCode, codeChanged)
  }

  const savePositionEditNow = (positionCode: string, codeChanged: boolean) => {
    if (!editingPositionCode) return

    const channelResult = normalizeChannel(newPositionChannel)
    if (channelResult.error) {
      setStatusMessage(channelResult.error)
      return
    }

    const sortOrder = Number(newPositionSort)
    if (!Number.isInteger(sortOrder)) {
      setStatusMessage('Sort order must be a whole number.')
      return
    }

    const result = editPosition(data, {
      positionCode: editingPositionCode,
      updates: {
        name: positionCode,
        displayName: newPositionDisplayName.trim() || positionCode,
        type: newPositionType,
        assignmentPeriod: newPositionPeriod,
        channel: channelResult.channel,
        sortOrder,
      },
      options: { allowCodeOrNameChange: codeChanged },
    })

    if (result.errors.length > 0) {
      setStatusMessage(result.errors[0])
      return
    }

    setData(result.data)
    resetPositionForm()
    setStatusMessage(`${positionCode} position updated.`)
  }

  const removePositionNow = (positionCode: string) => {
    const result = deletePosition(data, positionCode)
    if (result.errors.length > 0) {
      setStatusMessage(result.errors[0])
      return
    }

    setData(result.data)
    if (editingPositionCode === positionCode) resetPositionForm()
    setStatusMessage(`${positionCode} position deleted.`)
  }

  const confirmRemovePosition = (positionCode: string) => {
    setConfirmAction({
      title: `Delete ${positionCode}?`,
      message: 'This will clear assignments for this position and remove related operator permissions.',
      confirmLabel: 'Delete Position',
      onConfirm: () => removePositionNow(positionCode),
    })
  }

  const describeAssignment = (dateStr: string, positionCode: string, callsign: string) => {
    const weekly = scheduleData.positions.find((position) => position.name === positionCode)?.assignmentPeriod === 'weekly'
    return callsign
      ? weekly
        ? `${callsign} assigned to ${positionCode} for every coverage day that week.`
        : `${callsign} assigned to ${positionCode} on ${dateStr}.`
      : weekly
        ? `${positionCode} cleared for every coverage day that week.`
        : `${positionCode} cleared on ${dateStr}.`
  }

  const changeAssignment = (dateStr: string, positionCode: string, callsign: string) => {
    const replaced = operatorsReplacedByWeeklyAssign(scheduleData, dateStr, positionCode, callsign)
    const limitWarnings = handPickShiftLimitWarnings(scheduleData, dateStr, positionCode, callsign)
    const result = assignOperator(scheduleData, dateStr, positionCode, callsign)

    if (!result.check.allowed) {
      setStatusMessage(result.check.reason || 'Assignment was blocked.')
      return
    }

    const apply = () => {
      setData(result.data)
      setStatusMessage(describeAssignment(dateStr, positionCode, callsign))
    }

    if (replaced.length === 0 && limitWarnings.length === 0) {
      apply()
      return
    }

    const names = replaced.join(' and ')
    const replacement = replaced.length === 0
      ? ''
      : `${names} already ${replaced.length === 1 ? 'holds' : 'hold'} ${positionCode} on coverage days this week, including any days in a neighboring month. Assigning ${callsign} replaces them for the whole week.`
    setConfirmAction({
      title: limitWarnings.length > 0 ? `Assign ${callsign} anyway?` : `Replace ${names}?`,
      message: [replacement, ...limitWarnings].filter(Boolean).join(' '),
      confirmLabel: 'Assign anyway',
      onConfirm: apply,
    })
  }

  const changeCoverage = (dateStr: string, coverage: boolean) => {
    setData(setCoverage(scheduleData, dateStr, coverage))
    setStatusMessage(coverage ? `Coverage turned on for ${dateStr}.` : `Coverage turned off for ${dateStr}; assignments cleared.`)
  }

  const clearCalendarAssignmentsNow = () => {
    if (!monthHasAssignments(scheduleData, currentPrefix)) {
      setStatusMessage(`No assignments to clear for ${monthName(year, month)} ${year}.`)
      return
    }

    setData((current) => clearAssignmentsForMonth(current, currentPrefix))
    setAssignmentIssues([])
    setStatusMessage(`Assignments cleared for ${monthName(year, month)} ${year}.`)
  }

  const confirmClearCalendarAssignments = () => {
    setConfirmAction({
      title: `Clear ${monthName(year, month)} ${year}?`,
      message: 'This removes every assignment in the selected month. A weekly seat also clears the rest of any week that crosses into the neighboring month. Daily seats in other months stay.',
      confirmLabel: 'Clear Assignments',
      onConfirm: clearCalendarAssignmentsNow,
    })
  }

  const zeroizeAllDataNow = () => {
    setData(emptySchedulerData())
    setAssignmentIssues([])
    setActiveAdminPanel(null)
    setStatusMessage('All scheduler data zeroized.')
  }

  const confirmReallyZeroizeAllData = () => {
    setConfirmAction({
      title: 'Are you REALLY sure?',
      message: 'This will permanently wipe every operator, position, vacation, assignment, and schedule entry from the app.',
      confirmLabel: 'Zeroize Everything',
      onConfirm: zeroizeAllDataNow,
    })
  }

  const confirmZeroizeAllData = () => {
    setConfirmAction({
      title: 'Are you sure?',
      message: 'Zeroize wipes ALL scheduler data. This includes operators, positions, vacations, assignments, and historical schedules.',
      confirmLabel: 'Yes, Continue',
      onConfirm: confirmReallyZeroizeAllData,
    })
  }

  const runConfirmAction = () => {
    const action = confirmAction
    if (!action) return

    setConfirmAction(null)
    action.onConfirm()
  }

  const openDataFolder = async () => {
    if (!storageInfo.canOpenFolder) {
      setStatusMessage('Data folder access is only available in the desktop app.')
      return
    }

    const opened = await openSchedulerDataFolder()
    setStatusMessage(opened ? `Opened ${storageInfo.location}.` : 'Could not open the data folder.')
  }

  const saveTextFile = async (contents: string, filename: string, mimeType: string, status: string) => {
    const isTauri = isDesktopApp(window)

    if (isTauri) {
      const [{ save }, { writeTextFile }] = await Promise.all([
        import('@tauri-apps/plugin-dialog'),
        import('@tauri-apps/plugin-fs'),
      ])
      const path = await save({ defaultPath: filename })

      if (!path) {
        setStatusMessage('Save canceled.')
        return null
      }

      await writeTextFile(path, contents)
      if (status) setStatusMessage(status)
      return path
    }

    const blob = new Blob([contents], { type: mimeType })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
    if (status) setStatusMessage(status)
    return filename
  }

  const exportFullBackup = async () => {
    const filename = fullBackupFilename()

    try {
      const saved = await saveTextFile(
        fullBackupToJson(scheduleData, smartAssignSettings),
        filename,
        'application/json',
        '',
      )
      if (!saved) return null

      const message = describeBackupLocation(saved, filename)
      setStatusMessage(message)
      return { saved, message }
    } catch {
      setStatusMessage('Full backup export failed.')
      return null
    }
  }

  const exportMonthBackup = async () => {
    try {
      await saveTextFile(
        backupToJson(createMonthSnapshot(scheduleData, currentPrefix)),
        `mc-scheduler-month-${currentPrefix}.json`,
        'application/json',
        `Month backup exported for ${monthName(year, month)} ${year}.`,
      )
    } catch {
      setStatusMessage('Month backup export failed.')
    }
  }

  const exportBackup = async () => {
    await exportFullBackup()
  }

  const downloadScheduleText = async () => {
    try {
      await saveTextFile(
        scheduleText,
        `mars-schedule-${currentPrefix}.txt`,
        'text/plain',
        'Text schedule downloaded.',
      )
    } catch {
      setStatusMessage('Text schedule download failed.')
    }
  }

  const printSchedule = () => {
    window.print()
  }

  const openCalendarExport = () => {
    setCalendarExportMonthOnly(false)
    setCalendarExportOperator('')
    setCalendarExportOpen(true)
  }

  const exportCalendar = async () => {
    const ics = generateScheduleIcs(data, {
      month: calendarExportMonthOnly ? currentPrefix : undefined,
      operator: calendarExportOperator || undefined,
    })
    const filename = calendarExportFilename(data.regionName)

    try {
      const saved = await saveTextFile(ics, filename, 'text/calendar', '')
      if (!saved) return
      setCalendarExportOpen(false)
      setStatusMessage(`Calendar file saved: ${filename}.`)
    } catch {
      setStatusMessage('Calendar export failed.')
    }
  }

  const presentUpdate = (update: DesktopUpdate) => {
    setAvailableUpdate(update)
    setUpdateBackupPath(null)
    setUpdateBackupMessage(null)
    setUpdateSkipConfirmed(false)
    setConfirmingUpdateSkip(false)
    setUpdateInstalling(false)
    setUpdateProgress(null)
    setUpdateError(null)
    setStatusMessage(`Update ${update.version} is available. Back up the full database before installing.`)
  }

  const checkForUpdates = async () => {
    if (!isDesktopApp(window)) {
      setStatusMessage('Update checks run in the installed desktop app.')
      return
    }

    setStatusMessage('Checking for updates...')
    try {
      const update = await lookForUpdate()
      if (!update) {
        setAvailableUpdate(null)
        setStatusMessage(`Version ${appVersion} is the latest.`)
        return
      }
      presentUpdate(update)
    } catch {
      setStatusMessage('Could not check for updates. Check the network and try again.')
    }
  }

  const backupBeforeUpdate = async () => {
    const result = await exportFullBackup()
    if (!result) return

    setUpdateBackupPath(result.saved)
    setUpdateBackupMessage(result.message)
    setUpdateSkipConfirmed(false)
    setConfirmingUpdateSkip(false)
  }

  const installAvailableUpdate = async () => {
    if (!availableUpdate) return

    setUpdateInstalling(true)
    setUpdateError(null)
    setUpdateProgress('Downloading update...')
    try {
      await availableUpdate.downloadAndInstall(setUpdateProgress)
      setUpdateProgress('Update installed. Restarting...')
      await availableUpdate.relaunch()
    } catch {
      setUpdateInstalling(false)
      setUpdateProgress(null)
      setUpdateError('The update could not be installed. This version is still running.')
    }
  }

  const importBackup = async (file: File | undefined) => {
    if (!file) return

    try {
      const text = await file.text()
      const imported = parseBackupJson(text)
      const importedSettings = readSmartAssignSettingsFromBackup(text)
      setData(imported)
      if (importedSettings) setSmartAssignSettings(importedSettings)
      setStatusMessage(`Imported ${imported.operators.length} operators and ${imported.positions.length} positions.`)
    } catch {
      setStatusMessage('Import failed. The selected file is not a valid scheduler backup.')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const addVacation = () => {
    const normalizedCallsign = vacationCallsign.trim().toUpperCase()

    if (!normalizedCallsign) {
      setStatusMessage('Select an operator before adding vacation.')
      return
    }

    if (!data.operators.some((operator) => operator.callsign === normalizedCallsign)) {
      setStatusMessage('Select an existing operator before adding vacation.')
      return
    }

    if (!vacationStart || !vacationEnd) {
      setStatusMessage('Enter both vacation start and end dates.')
      return
    }

    if (vacationEnd < vacationStart) {
      setStatusMessage('Vacation end date cannot be before the start date.')
      return
    }

    setData((current) => ({
      ...current,
      vacations: {
        ...current.vacations,
        [normalizedCallsign]: [
          ...(current.vacations[normalizedCallsign] ?? []),
          { start: vacationStart, end: vacationEnd },
        ],
      },
    }))
    setVacationCallsign(normalizedCallsign)
    setVacationStart('')
    setVacationEnd('')
    setStatusMessage(`Vacation added for ${normalizedCallsign}.`)
  }

  const deleteVacationNow = (callsign: string, index: number) => {
    setData((current) => {
      const remaining = (current.vacations[callsign] ?? []).filter((_, itemIndex) => itemIndex !== index)
      const vacations = { ...current.vacations }

      if (remaining.length > 0) vacations[callsign] = remaining
      else delete vacations[callsign]

      return {
        ...current,
        vacations,
      }
    })
    setStatusMessage(`Vacation removed for ${callsign}.`)
  }

  const confirmDeleteVacation = (callsign: string, index: number, start: string, end: string) => {
    setConfirmAction({
      title: `Remove vacation for ${callsign}?`,
      message: `This will remove the vacation entry from ${start} to ${end}.`,
      confirmLabel: 'Remove Vacation',
      onConfirm: () => deleteVacationNow(callsign, index),
    })
  }

  const countAssignmentsOnDate = (dateStr: string) =>
    Object.keys(scheduleData.schedule[dateStr]?.assignments ?? {}).length

  const addHolidayNow = (holiday: Holiday) => {
    const existingHoliday = scheduleData.holidays.find((item) => item.date === holiday.date)

    setData((current) => applyHolidaysToData({
      ...current,
      holidays: uniqueHolidays([
        ...current.holidays.filter((item) => item.date !== holiday.date),
        holiday,
      ]),
    }))
    setHolidayName('')
    setHolidayDate('')
    setAssignmentIssues([])
    setStatusMessage(
      existingHoliday
        ? `${holiday.name} updated for ${holiday.date}. Coverage is off and assignments were cleared.`
        : `${holiday.name} added for ${holiday.date}. Coverage is off and assignments were cleared.`,
    )
  }

  const confirmAddHoliday = () => {
    const normalizedName = normalizeHolidayName(holidayName)

    if (!normalizedName) {
      setStatusMessage('Enter a holiday name before adding it.')
      return
    }

    if (!holidayDate) {
      setStatusMessage('Enter a holiday date before adding it.')
      return
    }

    const holiday: Holiday = {
      date: holidayDate,
      name: normalizedName,
      source: 'manual',
    }
    const assignmentCount = countAssignmentsOnDate(holiday.date)

    if (assignmentCount > 0) {
      setConfirmAction({
        title: `Add ${holiday.name}?`,
        message: `This will turn off coverage for ${holiday.date} and clear ${assignmentCount} existing assignments on that date.`,
        confirmLabel: 'Add Holiday',
        onConfirm: () => addHolidayNow(holiday),
      })
      return
    }

    addHolidayNow(holiday)
  }

  const applyImportedHolidays = (holidays: Holiday[], sourceLabel: string) => {
    const assignmentCount = holidays.reduce((count, holiday) => count + countAssignmentsOnDate(holiday.date), 0)

    setData((current) => applyHolidaysToData({
      ...current,
      holidays: uniqueHolidays([
        ...current.holidays.filter((existing) => !holidays.some((holiday) => holiday.date === existing.date)),
        ...holidays,
      ]),
    }))
    setAssignmentIssues([])
    setStatusMessage(`${holidays.length} federal holidays imported for ${year} from ${sourceLabel}. Cleared ${assignmentCount} existing assignments.`)
  }

  const importFederalHolidays = async () => {
    let holidays = generateFederalHolidays(year)
    let sourceLabel = 'offline rules'

    try {
      holidays = await fetchFederalHolidays(year)
      sourceLabel = 'internet lookup'
    } catch {
      setStatusMessage('Internet lookup failed. Using built-in federal holiday rules instead.')
    }

    const preview = holidays.map((holiday) => `${holiday.date} ${holiday.name}`).join('\n')

    setConfirmAction({
      title: `Import federal holidays for ${year}?`,
      message: `This will add or update these holidays and turn off coverage on each date:\n${preview}`,
      confirmLabel: 'Import Holidays',
      onConfirm: () => applyImportedHolidays(holidays, sourceLabel),
    })
  }

  const deleteHolidayNow = (dateStr: string, name: string) => {
    setData((current) => ({
      ...current,
      holidays: current.holidays.filter((holiday) => holiday.date !== dateStr),
    }))
    setStatusMessage(`${name} removed. Coverage was not turned back on automatically.`)
  }

  const confirmDeleteHoliday = (holiday: Holiday) => {
    setConfirmAction({
      title: `Remove ${holiday.name}?`,
      message: `This removes the holiday marker for ${holiday.date}. Existing coverage settings for that date will be left unchanged.`,
      confirmLabel: 'Remove Holiday',
      onConfirm: () => deleteHolidayNow(holiday.date, holiday.name),
    })
  }

  const adminPanelTitle = activeAdminPanel
    ? activeAdminPanel.charAt(0).toUpperCase() + activeAdminPanel.slice(1)
    : 'Admin'
  const storageModeLabel = storageInfo.mode === 'appdata' ? 'AppData JSON' : 'Browser localStorage'

  return (
    <main className="app-shell">
      <section className="workspace" id="schedule">
        <header className="topbar">
          <div className="planning-month">
            <p className="eyebrow">Planning month</p>
            <h2>{monthName(year, month)} {year}</h2>
            <div className="month-picker" aria-label="Manual month selection">
              <label>
                Month
                <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
                  {monthOptions.map((option) => (
                    <option value={option.value} key={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Year
                <input
                  type="number"
                  min="1900"
                  max="2100"
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                />
              </label>
              <button type="button" className="secondary" onClick={jumpToNextMonth}>Next Month</button>
            </div>
          </div>
          <div className="toolbar" aria-label="Schedule actions">
            <button type="button" className="secondary" onClick={() => importInputRef.current?.click()}>Import</button>
            <button type="button" className="secondary" onClick={exportBackup}>Export</button>
            <button type="button" className="secondary" onClick={exportMonthBackup}>Export Month</button>
            <button type="button" className="secondary" onClick={downloadScheduleText}>Save Text</button>
            <button type="button" className="secondary" onClick={openCalendarExport}>Export to calendar (.ics)</button>
            <button type="button" className="secondary" onClick={printSchedule}>Print</button>
            <button type="button" className="secondary" onClick={refreshAssignmentIssues}>Check Issues</button>
            <button type="button" className="secondary" onClick={() => void checkForUpdates()}>Check for updates</button>
            <button type="button" className="secondary danger" onClick={confirmClearCalendarAssignments}>Clear Calendar</button>
            <button type="button" className="secondary danger" onClick={confirmZeroizeAllData}>Zeroize</button>
            <button type="button" className="primary" onClick={runSmartAssign}>Smart Assign</button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden-file-input"
              onChange={(event) => void importBackup(event.target.files?.[0])}
            />
          </div>
        </header>

        <section className="summary-grid" aria-label="Schedule summary">
          <article>
            <span>Operators</span>
            <strong>{scheduleData.operators.length}</strong>
          </article>
          <article>
            <span>Positions</span>
            <strong>{scheduleData.positions.length}</strong>
          </article>
          <article>
            <span>Open Shifts</span>
            <strong>{openShiftCount}</strong>
          </article>
          <article>
            <span>Holidays This Month</span>
            <strong>{currentMonthHolidayCount}</strong>
          </article>
          <article>
            <span>Storage</span>
            <strong>{storageModeLabel}</strong>
          </article>
          <article>
            <span>App Version</span>
            <strong>v{appVersion}</strong>
          </article>
        </section>

        <section className="storage-panel" aria-label="Data storage">
          <div className="storage-copy">
            <p className="eyebrow">Data location</p>
            <h3>{storageInfo.mode === 'appdata' ? 'AppData folder' : 'Browser localStorage'}</h3>
            <p>{storageInfo.mode === 'appdata' ? storageInfo.dataFile : storageInfo.location}</p>
            {storageInfo.mode === 'appdata' ? <p>Yearly schedules: {storageInfo.yearlyScheduleFolder}</p> : null}
            <p>Backups: {storageInfo.backupFolder}</p>
          </div>
          <div className="storage-actions">
            <button type="button" className="secondary" onClick={openDataFolder} disabled={!storageInfo.canOpenFolder}>
              Open Data Folder
            </button>
          </div>
        </section>

        <p className="status-line">{statusMessage}</p>
        {data.setupComplete ? null : (
          <section className="setup-panel" aria-label="Region setup">
            <p className="eyebrow">First-run setup</p>
            <h3>Set up this message center</h3>
            <p>Start with an empty position list. Add the seats this region uses, or load the Region 4 example.</p>
            <label>
              Region name
              <input
                type="text"
                value={data.regionName}
                onChange={(event) => setData((current) => ({ ...current, regionName: event.target.value }))}
                placeholder="Army MARS Region 4"
              />
            </label>
            <label>
              Back-to-back
              <select
                value={data.backToBackPolicy}
                onChange={(event) => setData((current) => ({
                  ...current,
                  backToBackPolicy: event.target.value === 'allow' ? 'allow' : 'avoid',
                }))}
              >
                <option value="avoid">Avoid back-to-back</option>
                <option value="allow">Allow back-to-back</option>
              </select>
            </label>
            <label>
              Week starts on
              <select
                value={data.weekStartsOn}
                onChange={(event) => setData((current) => ({
                  ...current,
                  weekStartsOn: Number(event.target.value) as Weekday,
                }))}
              >
                {weekStartDays.map((day) => (
                  <option value={day.value} key={day.value}>{day.label}</option>
                ))}
              </select>
            </label>
            <ShiftLimitFields
              month={data.maxShiftsPerMonth}
              week={data.maxShiftsPerWeek}
              onMonth={(value) => setData((current) => ({ ...current, maxShiftsPerMonth: value }))}
              onWeek={(value) => setData((current) => ({ ...current, maxShiftsPerWeek: value }))}
            />
            <form
              className="operator-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (editingPositionCode) savePositionEdit()
                else addPosition()
              }}
            >
              <label>
                Code
                <input
                  type="text"
                  maxLength={12}
                  value={newPositionCode}
                  onChange={(event) => setNewPositionCode(event.target.value.toUpperCase())}
                  placeholder="DW"
                />
              </label>
              <label>
                Name
                <input
                  type="text"
                  value={newPositionDisplayName}
                  onChange={(event) => setNewPositionDisplayName(event.target.value)}
                  placeholder="DeltaWhite"
                />
              </label>
              <label>
                Type
                <select value={newPositionType} onChange={(event) => setNewPositionType(event.target.value as PositionType)}>
                  <option value="fixed">Fixed-frequency / net</option>
                  <option value="ale">ALE duty</option>
                </select>
              </label>
              <label>
                Assignment
                <select
                  value={newPositionPeriod}
                  onChange={(event) => setNewPositionPeriod(event.target.value === 'weekly' ? 'weekly' : 'daily')}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>
              <label>
                Channel name (optional)
                <input
                  type="text"
                  maxLength={4}
                  value={newPositionChannel}
                  onChange={(event) => setNewPositionChannel(event.target.value.toUpperCase())}
                  placeholder="AB12"
                />
              </label>
              <label>
                Sort order
                <input
                  type="number"
                  value={newPositionSort}
                  onChange={(event) => setNewPositionSort(event.target.value)}
                  placeholder="1"
                />
              </label>
              <div className="form-actions">
                <button type="submit" className="primary">{editingPositionCode ? 'Save Position' : 'Add Position'}</button>
                {editingPositionCode ? <button type="button" onClick={resetPositionForm}>Cancel Edit</button> : null}
              </div>
            </form>
            {data.positions.length === 0 ? <p>No positions yet.</p> : (
              <div className="table-list">
                {sortedPositions(data.positions).map((position) => (
                  <div className="table-row" key={position.name}>
                    <strong>{position.name}</strong>
                    <span>{position.displayName}{position.channel ? ` · ${position.channel}` : ''}</span>
                    <span>{position.type === 'ale' ? 'ALE duty' : 'Fixed-frequency / net'}</span>
                    <span>{position.assignmentPeriod === 'weekly' ? 'Weekly' : 'Daily'}</span>
                    <button type="button" onClick={() => startEditPosition(position.name)}>Edit</button>
                    <button type="button" className="danger" onClick={() => confirmRemovePosition(position.name)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
            <div className="form-actions">
              <button type="button" onClick={loadRegion4Example}>Load Region 4 example</button>
              <button
                type="button"
                className="primary"
                aria-disabled={finishSetupBlocker(data) !== null}
                onClick={finishRegionSetup}
              >
                Finish setup
              </button>
            </div>
            {finishSetupBlocker(data) ? (
              <p className="setup-error" role="alert" tabIndex={-1} ref={finishSetupRef}>
                {finishSetupBlocker(data)}
              </p>
            ) : null}
          </section>
        )}

        <section className="admin-actions" aria-label="Administrative tools">
          <button type="button" onClick={() => setActiveAdminPanel('operators')}>Operators</button>
          <button type="button" onClick={() => setActiveAdminPanel('positions')}>Positions</button>
          <button type="button" onClick={() => setActiveAdminPanel('vacations')}>Vacations</button>
          <button type="button" onClick={() => setActiveAdminPanel('holidays')}>Holidays</button>
        </section>

        <section className="settings-panel" aria-label="Smart Assign settings">
          <div>
            <p className="eyebrow">Smart Assign</p>
            <h3>Global Settings</h3>
          </div>
          <label>
            Region name
            <input
              type="text"
              value={data.regionName}
              onChange={(event) => setData((current) => ({ ...current, regionName: event.target.value }))}
              placeholder="Army MARS Region 4"
            />
          </label>
          <ShiftLimitFields
            month={data.maxShiftsPerMonth}
            week={data.maxShiftsPerWeek}
            onMonth={(value) => setData((current) => ({ ...current, maxShiftsPerMonth: value }))}
            onWeek={(value) => setData((current) => ({ ...current, maxShiftsPerWeek: value }))}
          />
          <label>
            Back-to-back
            <select
              value={data.backToBackPolicy}
              onChange={(event) => setData((current) => ({
                ...current,
                backToBackPolicy: event.target.value === 'allow' ? 'allow' : 'avoid',
              }))}
            >
              <option value="avoid">Avoid back-to-back</option>
              <option value="allow">Allow back-to-back</option>
            </select>
          </label>
          <label>
            Week starts on
            <select
              value={data.weekStartsOn}
              onChange={(event) => setData((current) => ({
                ...current,
                weekStartsOn: Number(event.target.value) as Weekday,
              }))}
            >
              {weekStartDays.map((day) => (
                <option value={day.value} key={day.value}>{day.label}</option>
              ))}
            </select>
          </label>
          <p className="settings-note">Avoid back-to-back is the default. One person still holds only one seat per day. Each coverage day of a weekly seat counts toward the monthly maximum. No limit is 0. A weekly seat does not use the daily rolling-week maximum.</p>
        </section>

        {assignmentIssues.length > 0 ? (
          <section className="issues-panel" aria-label="Assignment issues">
            <div className="panel-heading">
              <h3>Unfilled Shifts</h3>
              <span>{assignmentIssues.length} open</span>
            </div>
            <div className="issues-list">
              {assignmentIssues.map((issue) => (
                <div className="issue-row" key={`${issue.date}-${issue.position}`}>
                  <strong>{issue.date} {issue.position}</strong>
                  <span>{issue.reason}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="content-grid">
          <div className="calendar-panel">
            <div className="panel-heading">
              <h3>Calendar</h3>
              <div className="month-controls" aria-label="Month controls">
                <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>&lt;</button>
                <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>&gt;</button>
              </div>
            </div>
            <h2 className="print-only print-calendar-title">{monthName(year, month)} {year}</h2>

            <div className="calendar-grid">
              {weekdays.map((day) => (
                <div className="weekday" key={day.label}>{day.label}</div>
              ))}
              {Array.from({ length: firstWeekday }).map((_, index) => (
                <div className="calendar-day muted" key={`empty-${index}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1
                const dateStr = dateKey(year, month, day)
                const scheduleDay = scheduleData.schedule[dateStr]
                const holiday = holidayForDate(scheduleData.holidays, dateStr)

                return (
                  <article className={`${scheduleDay.coverage ? 'calendar-day' : 'calendar-day no-coverage'}${holiday ? ' holiday-day' : ''}`} key={day}>
                    <div className="day-header">
                      <strong className="print-day-number">{day}</strong>
                      <label className="coverage-toggle screen-only">
                        <input
                          type="checkbox"
                          checked={scheduleDay.coverage}
                          disabled={Boolean(holiday)}
                          onChange={(event) => changeCoverage(dateStr, event.target.checked)}
                        />
                        {holiday ? 'Holiday' : scheduleDay.coverage ? 'Coverage' : 'Off'}
                      </label>
                    </div>
                    {holiday ? <p className="holiday-label">{holiday.name}</p> : null}
                    {scheduleDay.coverage ? sortedPositions(scheduleData.positions).map((position) => (
                      <div className="assignment-row" key={position.name}>
                        <span className="screen-only">{position.shortName}</span>
                        <select
                          className="screen-only"
                          value={scheduleDay.assignments[position.name] || ''}
                          title={position.assignmentPeriod === 'weekly' ? 'Weekly seat: this choice fills every coverage day in the week.' : undefined}
                          onChange={(event) => changeAssignment(dateStr, position.name, event.target.value)}
                        >
                          <option value="">Open</option>
                          {scheduleData.operators
                            .filter((operator) =>
                              operator.callsign === scheduleDay.assignments[position.name] ||
                              (position.assignmentPeriod === 'weekly'
                                ? assignOperator(scheduleData, dateStr, position.name, operator.callsign).check.allowed
                                : canAssignOperator(scheduleData, dateStr, position, operator.callsign).allowed),
                            )
                            .map((operator) => (
                              <option value={operator.callsign} key={operator.callsign}>{operator.callsign}</option>
                            ))}
                        </select>
                        <p className="print-only print-assignment-text">
                          {position.shortName}{position.channel ? ` ${position.channel}` : ''}: {scheduleDay.assignments[position.name] || 'Open'}
                        </p>
                      </div>
                    )) : null}
                  </article>
                )
              })}
              {Array.from({ length: trailingBlankDays }).map((_, index) => (
                <div className="calendar-day muted" key={`trailing-empty-${index}`} />
              ))}
            </div>
          </div>

          <section className="output-panel">
            <div className="panel-heading">
              <h3>Text Preview</h3>
            </div>
            <textarea value={scheduleText} readOnly aria-label="Text schedule preview" />
          </section>

          <aside className={`admin-drawer ${activeAdminPanel ? 'open' : ''}`} aria-hidden={!activeAdminPanel}>
            <div className="drawer-heading">
              <h3>{adminPanelTitle}</h3>
              <button type="button" onClick={() => setActiveAdminPanel(null)}>Close</button>
            </div>
            {activeAdminPanel === 'operators' ? (
            <section className="data-panel" id="operators">
              <div className="panel-heading">
                <h3>Operators</h3>
              </div>
              <form
                className="operator-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (editingOperatorCallsign) saveOperatorEdit()
                  else addOperator()
                }}
              >
                <label>
                  Callsign
                  <input
                    type="text"
                    value={newCallsign}
                    onChange={(event) => setNewCallsign(event.target.value)}
                    placeholder="NCS001"
                  />
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={newOperatorAle}
                    onChange={(event) => setNewOperatorAle(event.target.checked)}
                  />
                  ALE qualified
                </label>

                <fieldset>
                  <legend>Unavailable days</legend>
                  <div className="chip-grid">
                    {weekdays.map((day) => (
                      <label className="chip-check" key={day.label}>
                        <input
                          type="checkbox"
                          checked={newOperatorUnavailable.includes(day.value)}
                          onChange={() => toggleUnavailableDay(day.value)}
                        />
                        {day.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend>Allowed positions</legend>
                  <div className="chip-grid">
                    {sortedPositions(scheduleData.positions).map((position) => {
                      const aleDuty = position.type === 'ale'
                      const checked = aleDuty ? newOperatorAle : newOperatorPermissions[position.name] !== false

                      return (
                        <label className="chip-check" key={position.name}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={aleDuty}
                            onChange={() => togglePositionPermission(position.name)}
                          />
                          {position.displayName}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                <label>
                  Max shifts per month
                  <input
                    type="number"
                    min={0}
                    max={MAX_SHIFTS_PER_MONTH_CAP}
                    value={newOperatorMonthLimit}
                    onChange={(event) => setNewOperatorMonthLimit(event.target.value)}
                    placeholder={data.maxShiftsPerMonth === 0 ? 'No limit' : String(data.maxShiftsPerMonth)}
                  />
                </label>
                <label>
                  Max daily shifts per rolling week
                  <input
                    type="number"
                    min={0}
                    max={MAX_SHIFTS_PER_WEEK_CAP}
                    value={newOperatorWeekLimit}
                    onChange={(event) => setNewOperatorWeekLimit(event.target.value)}
                    placeholder={data.maxShiftsPerWeek === 0 ? 'No limit' : String(data.maxShiftsPerWeek)}
                  />
                </label>
                <p className="settings-note">Leave a limit blank to use the region default shown in the box. Enter 0 for no limit.</p>

                <div className="form-actions">
                  <button type="submit" className="primary">{editingOperatorCallsign ? 'Save Operator' : 'Add Operator'}</button>
                  {editingOperatorCallsign ? <button type="button" onClick={resetOperatorForm}>Cancel Edit</button> : null}
                </div>
              </form>
              <div className="table-list">
                {scheduleData.operators.length === 0 ? (
                  <p className="empty-state">No operators yet.</p>
                ) : scheduleData.operators.map((operator) => (
                  <div className="table-row" key={operator.callsign}>
                    <strong>{operator.callsign}</strong>
                    <span>{operator.ale ? 'ALE' : 'Standard'}</span>
                    <span>{getShiftCount(scheduleData.schedule, scheduleData.positions, operator.callsign, currentPrefix)} shifts</span>
                    <span>
                      {operator.maxShiftsPerMonth === undefined ? 'Region month' : operator.maxShiftsPerMonth === 0 ? 'No monthly limit' : `${operator.maxShiftsPerMonth}/month`}
                      {' · '}
                      {operator.maxShiftsPerWeek === undefined ? 'Region week' : operator.maxShiftsPerWeek === 0 ? 'No weekly limit' : `${operator.maxShiftsPerWeek}/week`}
                    </span>
                    <button type="button" onClick={() => startEditOperator(operator.callsign)}>Edit</button>
                    <button type="button" className="danger" onClick={() => confirmDeleteOperator(operator.callsign)}>Delete</button>
                  </div>
                ))}
              </div>
            </section>
            ) : null}

            {activeAdminPanel === 'vacations' ? (
            <section className="data-panel" id="vacations">
              <div className="panel-heading">
                <h3>Vacations</h3>
              </div>
              <form className="operator-form" onSubmit={(event) => { event.preventDefault(); addVacation() }}>
                <label>
                  Operator
                  <input
                    type="text"
                    list="vacation-operator-options"
                    value={vacationCallsign}
                    onChange={(event) => setVacationCallsign(event.target.value.toUpperCase())}
                    placeholder="Type callsign"
                  />
                  <datalist id="vacation-operator-options">
                    {scheduleData.operators.map((operator) => (
                      <option value={operator.callsign} key={operator.callsign} />
                    ))}
                  </datalist>
                </label>
                <label>
                  Start
                  <input type="date" value={vacationStart} onChange={(event) => setVacationStart(event.target.value)} />
                </label>
                <label>
                  End
                  <input type="date" value={vacationEnd} onChange={(event) => setVacationEnd(event.target.value)} />
                </label>
                <button type="submit" className="primary">Add Vacation</button>
              </form>

              <div className="table-list">
                {Object.entries(scheduleData.vacations).length === 0 ? (
                  <p className="empty-state">No vacations entered.</p>
                ) : Object.entries(scheduleData.vacations).map(([callsign, vacations]) => (
                  vacations.map((vacation, index) => (
                    <div className="table-row vacation-row" key={`${callsign}-${vacation.start}-${vacation.end}-${index}`}>
                      <strong>{callsign}</strong>
                      <span>{vacation.start} to {vacation.end}</span>
                      <button type="button" onClick={() => confirmDeleteVacation(callsign, index, vacation.start, vacation.end)}>Remove</button>
                    </div>
                  ))
                ))}
              </div>
            </section>
            ) : null}

            {activeAdminPanel === 'holidays' ? (
            <section className="data-panel" id="holidays">
              <div className="panel-heading">
                <h3>Holidays</h3>
              </div>
              <form className="operator-form" onSubmit={(event) => { event.preventDefault(); confirmAddHoliday() }}>
                <label>
                  Holiday name
                  <input
                    type="text"
                    value={holidayName}
                    onChange={(event) => setHolidayName(event.target.value)}
                    placeholder="Independence Day"
                  />
                </label>
                <label>
                  Date
                  <input type="date" value={holidayDate} onChange={(event) => setHolidayDate(event.target.value)} />
                </label>
                <div className="form-actions">
                  <button type="submit" className="primary">Add Holiday</button>
                  <button type="button" onClick={() => void importFederalHolidays()}>US federal holidays (optional)</button>
                </div>
              </form>

              <div className="table-list">
                {scheduleData.holidays.length === 0 ? (
                  <p className="empty-state">No holidays entered.</p>
                ) : scheduleData.holidays.map((holiday) => (
                  <div className="table-row holiday-row" key={holiday.date}>
                    <strong>{holiday.name}</strong>
                    <span>{holiday.date}</span>
                    <span>{holiday.source}</span>
                    <button type="button" onClick={() => confirmDeleteHoliday(holiday)}>Remove</button>
                  </div>
                ))}
              </div>
            </section>
            ) : null}

            {activeAdminPanel === 'positions' ? (
            <section className="data-panel" id="positions">
              <div className="panel-heading">
                <h3>Positions</h3>
              </div>
              <form
                className="operator-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (editingPositionCode) savePositionEdit()
                  else addPosition()
                }}
              >
                <label>
                  Code
                  <input
                    type="text"
                    maxLength={12}
                    value={newPositionCode}
                    onChange={(event) => setNewPositionCode(event.target.value.toUpperCase())}
                    placeholder="DW"
                  />
                </label>
                <label>
                  Name
                  <input
                    type="text"
                    value={newPositionDisplayName}
                    onChange={(event) => setNewPositionDisplayName(event.target.value)}
                    placeholder="DeltaWhite"
                  />
                </label>
                <label>
                  Type
                  <select value={newPositionType} onChange={(event) => setNewPositionType(event.target.value as PositionType)}>
                    <option value="fixed">Fixed-frequency / net</option>
                    <option value="ale">ALE duty</option>
                  </select>
                </label>
                <label>
                  Assignment
                  <select
                    value={newPositionPeriod}
                    onChange={(event) => setNewPositionPeriod(event.target.value === 'weekly' ? 'weekly' : 'daily')}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </label>
                <label>
                  Channel name (optional)
                  <input
                    type="text"
                    maxLength={4}
                    value={newPositionChannel}
                    onChange={(event) => setNewPositionChannel(event.target.value.toUpperCase())}
                    placeholder="AB12"
                  />
                </label>
                <label>
                  Sort order
                  <input
                    type="number"
                    value={newPositionSort}
                    onChange={(event) => setNewPositionSort(event.target.value)}
                    placeholder="1"
                  />
                </label>
                <div className="form-actions">
                  <button type="submit" className="primary">{editingPositionCode ? 'Save Position' : 'Add Position'}</button>
                  {editingPositionCode ? <button type="button" onClick={resetPositionForm}>Cancel Edit</button> : null}
                </div>
              </form>
              <div className="table-list">
                {sortedPositions(scheduleData.positions).map((position) => (
                  <div className="table-row" key={position.name}>
                    <strong>{position.name}</strong>
                    <span>{position.displayName}{position.channel ? ` · ${position.channel}` : ''}</span>
                    <span>{position.type === 'ale' ? 'ALE duty' : 'Fixed-frequency / net'}</span>
                    <span>{position.assignmentPeriod === 'weekly' ? 'Weekly' : 'Daily'}</span>
                    <button type="button" onClick={() => startEditPosition(position.name)}>Edit</button>
                    <button type="button" className="danger" onClick={() => confirmRemovePosition(position.name)}>Delete</button>
                  </div>
                ))}
              </div>
            </section>
            ) : null}
          </aside>
          {activeAdminPanel ? <button type="button" className="drawer-backdrop" aria-label="Close admin drawer" onClick={() => setActiveAdminPanel(null)} /> : null}
          {availableUpdate ? (
            <UpdateDialog
              currentVersion={appVersion}
              version={availableUpdate.version}
              notes={availableUpdate.notes}
              backupPath={updateBackupPath}
              backupMessage={updateBackupMessage}
              skipConfirmed={updateSkipConfirmed}
              confirmingSkip={confirmingUpdateSkip}
              installing={updateInstalling}
              progress={updateProgress}
              error={updateError}
              onBackup={() => void backupBeforeUpdate()}
              onAskSkip={() => setConfirmingUpdateSkip(true)}
              onConfirmSkip={() => {
                setUpdateSkipConfirmed(true)
                setConfirmingUpdateSkip(false)
              }}
              onCancelSkip={() => setConfirmingUpdateSkip(false)}
              onInstall={() => void installAvailableUpdate()}
              onClose={() => {
                if (updateInstalling) return
                setAvailableUpdate(null)
              }}
            />
          ) : null}
          {calendarExportOpen ? (
            <div className="confirm-backdrop" role="presentation">
              <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-export-title">
                <h3 id="calendar-export-title">Export to calendar</h3>
                <p>The file lists every assigned coverage day. A weekly seat is one all-day event per day. Import it into its own calendar.</p>
                <label>
                  Scope
                  <select
                    value={calendarExportMonthOnly ? 'month' : 'all'}
                    onChange={(event) => setCalendarExportMonthOnly(event.target.value === 'month')}
                  >
                    <option value="all">Full calendar</option>
                    <option value="month">This month only</option>
                  </select>
                </label>
                <label>
                  Operator
                  <select value={calendarExportOperator} onChange={(event) => setCalendarExportOperator(event.target.value)}>
                    <option value="">All operators</option>
                    {data.operators.map((operator) => (
                      <option value={operator.callsign} key={operator.callsign}>{operator.callsign}</option>
                    ))}
                  </select>
                </label>
                <div className="confirm-actions">
                  <button type="button" onClick={() => setCalendarExportOpen(false)}>Cancel</button>
                  <button type="button" className="primary" onClick={() => void exportCalendar()}>Export</button>
                </div>
              </section>
            </div>
          ) : null}
          {confirmAction ? (
            <div className="confirm-backdrop" role="presentation">
              <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
                <h3 id="confirm-title">{confirmAction.title}</h3>
                <p>{confirmAction.message}</p>
                <div className="confirm-actions">
                  <button type="button" onClick={() => setConfirmAction(null)}>Cancel</button>
                  <button type="button" className="danger" onClick={runConfirmAction}>{confirmAction.confirmLabel}</button>
                </div>
              </section>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  )
}

export default App
