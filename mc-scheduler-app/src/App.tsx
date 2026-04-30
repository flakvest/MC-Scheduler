import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { backupToJson, parseBackupJson } from './domain/backupFiles'
import { clearAssignmentsForMonth, createMonthSnapshot, monthHasAssignments } from './domain/monthTools'
import { deletePosition, editPosition } from './domain/positionManagement'
import { generateScheduleText } from './domain/scheduleOutput'
import { assignOperator, canAssignOperator, ensureMonthSchedule, findOpenAssignmentIssues, getShiftCount, setCoverage, smartAssign, type AssignmentIssue } from './domain/schedulerRules'
import { loadSmartAssignSettings, saveSmartAssignSettings } from './domain/smartAssignSettings'
import { loadSchedulerData, saveSchedulerData } from './domain/schedulerStorage'
import { type SchedulerData, type VacationMap, type Weekday } from './domain/schedulerTypes'

const weekdays: { label: string, value: Weekday }[] = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
]
const today = new Date()

const monthName = (year: number, month: number) =>
  new Date(year, month - 1).toLocaleString('default', { month: 'long' })

const monthPrefix = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, '0')}`

const dateKey = (year: number, month: number, day: number) =>
  `${monthPrefix(year, month)}-${String(day).padStart(2, '0')}`

type AdminPanel = 'operators' | 'positions' | 'vacations'

function App() {
  const [data, setData] = useState<SchedulerData>(() => loadSchedulerData())
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [statusMessage, setStatusMessage] = useState('Ready')
  const [newCallsign, setNewCallsign] = useState('')
  const [newOperatorAle, setNewOperatorAle] = useState(false)
  const [newOperatorUnavailable, setNewOperatorUnavailable] = useState<Weekday[]>([])
  const [newOperatorPermissions, setNewOperatorPermissions] = useState<Record<string, boolean>>({})
  const [editingOperatorCallsign, setEditingOperatorCallsign] = useState<string | null>(null)
  const [newPositionCode, setNewPositionCode] = useState('')
  const [newPositionRequiresAle, setNewPositionRequiresAle] = useState(false)
  const [editingPositionCode, setEditingPositionCode] = useState<string | null>(null)
  const [vacationCallsign, setVacationCallsign] = useState('')
  const [vacationStart, setVacationStart] = useState('')
  const [vacationEnd, setVacationEnd] = useState('')
  const [activeAdminPanel, setActiveAdminPanel] = useState<AdminPanel | null>(null)
  const [smartAssignSettings, setSmartAssignSettings] = useState(() => loadSmartAssignSettings())
  const [assignmentIssues, setAssignmentIssues] = useState<AssignmentIssue[]>([])
  const importInputRef = useRef<HTMLInputElement>(null)

  const scheduleData = useMemo(() => ({
    ...data,
    schedule: ensureMonthSchedule(data.schedule, year, month),
  }), [data, month, year])

  useEffect(() => {
    saveSchedulerData(data)
  }, [data])

  useEffect(() => {
    saveSmartAssignSettings(smartAssignSettings)
  }, [smartAssignSettings])

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const trailingBlankDays = (7 - ((firstWeekday + daysInMonth) % 7)) % 7
  const currentPrefix = monthPrefix(year, month)
  const scheduleText = useMemo(() => generateScheduleText(scheduleData, year, month), [month, scheduleData, year])
  const openShiftCount = Object.entries(scheduleData.schedule)
    .filter(([date]) => date.startsWith(currentPrefix))
    .reduce((count, [, day]) => {
      if (!day.coverage) return count
      const openPositions = scheduleData.positions.filter((position) => !day.assignments[position.name]).length
      return count + openPositions
    }, 0)

  const moveMonth = (offset: number) => {
    const next = new Date(year, month - 1 + offset, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth() + 1)
  }

  const runSmartAssign = () => {
    const options = {
      year,
      month,
      maxShifts: smartAssignSettings.maxShiftsPerMonth,
      preventBackToBack: smartAssignSettings.noBackToBack,
      maxShiftsPerWeek: smartAssignSettings.maxShiftsPerWeek,
    }
    const result = smartAssign(scheduleData, {
      ...options,
    })

    setData(result.data)
    setAssignmentIssues(result.issues)
    setStatusMessage(`Smart assign filled ${result.assignedCount} shifts; ${result.blockedCount} could not be filled.`)
  }

  const refreshAssignmentIssues = () => {
    const issues = findOpenAssignmentIssues(scheduleData, {
      year,
      month,
      maxShifts: smartAssignSettings.maxShiftsPerMonth,
      preventBackToBack: smartAssignSettings.noBackToBack,
      maxShiftsPerWeek: smartAssignSettings.maxShiftsPerWeek,
    })

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
    setEditingOperatorCallsign(null)
  }

  const startEditOperator = (callsign: string) => {
    const operator = data.operators.find((item) => item.callsign === callsign)
    if (!operator) return

    setEditingOperatorCallsign(operator.callsign)
    setNewCallsign(operator.callsign)
    setNewOperatorAle(operator.ale)
    setNewOperatorUnavailable(operator.unavailable)
    setNewOperatorPermissions(operator.positionPermissions)
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

    const positionPermissions = data.positions.reduce<Record<string, boolean>>((permissions, position) => {
      permissions[position.name] = position.name === 'EXD'
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

    const positionPermissions = data.positions.reduce<Record<string, boolean>>((permissions, position) => {
      permissions[position.name] = position.name === 'EXD'
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

  const deleteOperator = (callsign: string) => {
    if (!window.confirm(`Delete ${callsign}? This will clear their assignments and vacations.`)) return

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

  const addPosition = () => {
    const positionCode = newPositionCode.trim().toUpperCase()

    if (!positionCode) {
      setStatusMessage('Enter a position code before adding a position.')
      return
    }

    if (positionCode === 'EXD') {
      setStatusMessage('EXD already exists and stays linked to ALE.')
      return
    }

    if (data.positions.some((position) => position.name === positionCode)) {
      setStatusMessage(`${positionCode} already exists.`)
      return
    }

    setData((current) => ({
      ...current,
      positions: [
        ...current.positions,
        {
          name: positionCode,
          shortName: positionCode,
          requiresALE: newPositionRequiresAle,
        },
      ],
      operators: current.operators.map((operator) => ({
        ...operator,
        positionPermissions: {
          ...operator.positionPermissions,
          [positionCode]: newPositionRequiresAle ? operator.ale : true,
        },
      })),
    }))
    setNewPositionCode('')
    setNewPositionRequiresAle(false)
    setStatusMessage(`${positionCode} position added.`)
  }

  const resetPositionForm = () => {
    setNewPositionCode('')
    setNewPositionRequiresAle(false)
    setEditingPositionCode(null)
  }

  const startEditPosition = (positionCode: string) => {
    const position = data.positions.find((item) => item.name === positionCode)
    if (!position) return

    setEditingPositionCode(position.name)
    setNewPositionCode(position.shortName)
    setNewPositionRequiresAle(position.requiresALE)
  }

  const savePositionEdit = () => {
    if (!editingPositionCode) return

    const positionCode = newPositionCode.trim().toUpperCase()

    if (!positionCode) {
      setStatusMessage('Enter a position code before saving the position.')
      return
    }

    const currentPosition = data.positions.find((position) => position.name === editingPositionCode)
    if (!currentPosition) {
      setStatusMessage('Position does not exist.')
      return
    }

    const codeChanged = positionCode !== currentPosition.name || positionCode !== currentPosition.shortName
    if (
      codeChanged &&
      !window.confirm(`Rename position ${currentPosition.shortName} to ${positionCode}? Existing assignments and permissions will be updated.`)
    ) {
      setStatusMessage('Position rename canceled.')
      return
    }

    const result = editPosition(data, {
      positionCode: editingPositionCode,
      updates: {
        name: positionCode,
        shortName: positionCode,
        requiresALE: newPositionRequiresAle,
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

  const removePosition = (positionCode: string) => {
    if (!window.confirm(`Delete ${positionCode}? This will clear its assignments and operator permissions.`)) return

    const result = deletePosition(data, positionCode)
    if (result.errors.length > 0) {
      setStatusMessage(result.errors[0])
      return
    }

    setData(result.data)
    if (editingPositionCode === positionCode) resetPositionForm()
    setStatusMessage(`${positionCode} position deleted.`)
  }

  const changeAssignment = (dateStr: string, positionCode: string, callsign: string) => {
    const result = assignOperator(scheduleData, dateStr, positionCode, callsign)

    if (!result.check.allowed) {
      setStatusMessage(result.check.reason || 'Assignment was blocked.')
      return
    }

    setData(result.data)
    setStatusMessage(callsign ? `${callsign} assigned to ${positionCode} on ${dateStr}.` : `${positionCode} cleared on ${dateStr}.`)
  }

  const changeCoverage = (dateStr: string, coverage: boolean) => {
    setData(setCoverage(scheduleData, dateStr, coverage))
    setStatusMessage(coverage ? `Coverage turned on for ${dateStr}.` : `Coverage turned off for ${dateStr}; assignments cleared.`)
  }

  const clearCalendarAssignments = () => {
    if (!window.confirm(`Clear all assignments for ${monthName(year, month)} ${year}?`)) return

    if (!monthHasAssignments(scheduleData, currentPrefix)) {
      setStatusMessage(`No assignments to clear for ${monthName(year, month)} ${year}.`)
      return
    }

    setData((current) => clearAssignmentsForMonth(current, currentPrefix))
    setAssignmentIssues([])
    setStatusMessage(`Assignments cleared for ${monthName(year, month)} ${year}.`)
  }

  const saveTextFile = async (contents: string, filename: string, mimeType: string, status: string) => {
    const isTauri = '__TAURI_INTERNALS__' in window

    if (isTauri) {
      const [{ save }, { writeTextFile }] = await Promise.all([
        import('@tauri-apps/plugin-dialog'),
        import('@tauri-apps/plugin-fs'),
      ])
      const path = await save({ defaultPath: filename })

      if (!path) {
        setStatusMessage('Save canceled.')
        return
      }

      await writeTextFile(path, contents)
      setStatusMessage(status)
      return
    }

    const blob = new Blob([contents], { type: mimeType })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
    setStatusMessage(status)
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
    try {
      await saveTextFile(
        backupToJson(scheduleData),
        `mc-scheduler-backup-${currentPrefix}.json`,
        'application/json',
        'Backup exported.',
      )
    } catch {
      setStatusMessage('Backup export failed.')
    }
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

  const importBackup = async (file: File | undefined) => {
    if (!file) return

    try {
      const imported = parseBackupJson(await file.text())
      setData(imported)
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

  const deleteVacation = (callsign: string, index: number) => {
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

  const adminPanelTitle = activeAdminPanel
    ? activeAdminPanel.charAt(0).toUpperCase() + activeAdminPanel.slice(1)
    : 'Admin'

  return (
    <main className="app-shell">
      <section className="workspace" id="schedule">
        <header className="topbar">
          <div>
            <p className="eyebrow">Planning month</p>
            <h2>{monthName(year, month)} {year}</h2>
          </div>
          <div className="toolbar" aria-label="Schedule actions">
            <button type="button" className="secondary" onClick={() => importInputRef.current?.click()}>Import</button>
            <button type="button" className="secondary" onClick={exportBackup}>Export</button>
            <button type="button" className="secondary" onClick={exportMonthBackup}>Export Month</button>
            <button type="button" className="secondary" onClick={downloadScheduleText}>Save Text</button>
            <button type="button" className="secondary" onClick={printSchedule}>Print</button>
            <button type="button" className="secondary" onClick={refreshAssignmentIssues}>Check Issues</button>
            <button type="button" className="secondary danger" onClick={clearCalendarAssignments}>Clear Calendar</button>
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
            <span>Storage</span>
            <strong>Browser JSON</strong>
          </article>
        </section>

        <p className="status-line">{statusMessage}</p>

        <section className="admin-actions" aria-label="Administrative tools">
          <button type="button" onClick={() => setActiveAdminPanel('operators')}>Operators</button>
          <button type="button" onClick={() => setActiveAdminPanel('positions')}>Positions</button>
          <button type="button" onClick={() => setActiveAdminPanel('vacations')}>Vacations</button>
        </section>

        <section className="settings-panel" aria-label="Smart Assign settings">
          <div>
            <p className="eyebrow">Smart Assign</p>
            <h3>Global Settings</h3>
          </div>
          <label>
            Max shifts/month
            <select
              value={smartAssignSettings.maxShiftsPerMonth}
              onChange={(event) => setSmartAssignSettings((current) => ({
                ...current,
                maxShiftsPerMonth: Number(event.target.value),
              }))}
            >
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                <option value={value} key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={smartAssignSettings.noBackToBack}
              onChange={(event) => setSmartAssignSettings((current) => ({
                ...current,
                noBackToBack: event.target.checked,
              }))}
            />
            No back-to-back
          </label>
          <label>
            Max shifts/week
            <select
              value={smartAssignSettings.maxShiftsPerWeek}
              onChange={(event) => setSmartAssignSettings((current) => ({
                ...current,
                maxShiftsPerWeek: Number(event.target.value),
              }))}
            >
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                <option value={value} key={value}>{value}</option>
              ))}
            </select>
          </label>
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
                const scheduleDay = scheduleData.schedule[dateKey(year, month, day)]

                return (
                  <article className={scheduleDay.coverage ? 'calendar-day' : 'calendar-day no-coverage'} key={day}>
                    <div className="day-header">
                      <strong className="print-day-number">{day}</strong>
                      <label className="coverage-toggle screen-only">
                        <input
                          type="checkbox"
                          checked={scheduleDay.coverage}
                          onChange={(event) => changeCoverage(dateKey(year, month, day), event.target.checked)}
                        />
                        {scheduleDay.coverage ? 'Coverage' : 'Off'}
                      </label>
                    </div>
                    {scheduleDay.coverage ? scheduleData.positions.map((position) => (
                      <div className="assignment-row" key={position.name}>
                        <span className="screen-only">{position.shortName}</span>
                        <select
                          className="screen-only"
                          value={scheduleDay.assignments[position.name] || ''}
                          onChange={(event) => changeAssignment(dateKey(year, month, day), position.name, event.target.value)}
                        >
                          <option value="">Open</option>
                          {scheduleData.operators
                            .filter((operator) =>
                              operator.callsign === scheduleDay.assignments[position.name] ||
                              canAssignOperator(scheduleData, dateKey(year, month, day), position, operator.callsign).allowed,
                            )
                            .map((operator) => (
                              <option value={operator.callsign} key={operator.callsign}>{operator.callsign}</option>
                            ))}
                        </select>
                        <p className="print-only print-assignment-text">
                          {position.shortName}: {scheduleDay.assignments[position.name] || 'Open'}
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
              <form className="operator-form" onSubmit={(event) => { event.preventDefault(); editingOperatorCallsign ? saveOperatorEdit() : addOperator() }}>
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
                  ALE capable
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
                    {scheduleData.positions.map((position) => {
                      const isExd = position.name === 'EXD'
                      const checked = isExd ? newOperatorAle : newOperatorPermissions[position.name] !== false

                      return (
                        <label className="chip-check" key={position.name}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isExd}
                            onChange={() => togglePositionPermission(position.name)}
                          />
                          {position.shortName}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

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
                    <button type="button" onClick={() => startEditOperator(operator.callsign)}>Edit</button>
                    <button type="button" className="danger" onClick={() => deleteOperator(operator.callsign)}>Delete</button>
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
                      <button type="button" onClick={() => deleteVacation(callsign, index)}>Remove</button>
                    </div>
                  ))
                ))}
              </div>
            </section>
            ) : null}

            {activeAdminPanel === 'positions' ? (
            <section className="data-panel" id="positions">
              <div className="panel-heading">
                <h3>Positions</h3>
              </div>
              <form className="operator-form" onSubmit={(event) => { event.preventDefault(); editingPositionCode ? savePositionEdit() : addPosition() }}>
                <label>
                  Short code
                  <input
                    type="text"
                    maxLength={6}
                    value={newPositionCode}
                    onChange={(event) => setNewPositionCode(event.target.value)}
                    placeholder="ALT"
                  />
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={newPositionRequiresAle}
                    onChange={(event) => setNewPositionRequiresAle(event.target.checked)}
                    disabled={editingPositionCode === 'EXD'}
                  />
                  Requires ALE
                </label>
                <div className="form-actions">
                  <button type="submit" className="primary">{editingPositionCode ? 'Save Position' : 'Add Position'}</button>
                  {editingPositionCode ? <button type="button" onClick={resetPositionForm}>Cancel Edit</button> : null}
                </div>
              </form>
              <div className="table-list">
                {scheduleData.positions.map((position) => (
                  <div className="table-row" key={position.name}>
                    <strong>{position.shortName}</strong>
                    <span>{position.requiresALE ? 'Requires ALE' : 'No ALE required'}</span>
                    <button type="button" onClick={() => startEditPosition(position.name)}>Edit</button>
                    <button type="button" className="danger" onClick={() => removePosition(position.name)}>Delete</button>
                  </div>
                ))}
              </div>
            </section>
            ) : null}
          </aside>
          {activeAdminPanel ? <button type="button" className="drawer-backdrop" aria-label="Close admin drawer" onClick={() => setActiveAdminPanel(null)} /> : null}
        </section>
      </section>
    </main>
  )
}

export default App
