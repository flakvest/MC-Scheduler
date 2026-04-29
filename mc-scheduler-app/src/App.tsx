import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { backupToJson, parseBackupJson } from './domain/backupFiles'
import { generateScheduleText } from './domain/scheduleOutput'
import { assignOperator, canAssignOperator, ensureMonthSchedule, getShiftCount, setCoverage, smartAssign } from './domain/schedulerRules'
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
  const [vacationCallsign, setVacationCallsign] = useState('')
  const [vacationStart, setVacationStart] = useState('')
  const [vacationEnd, setVacationEnd] = useState('')
  const [activeAdminPanel, setActiveAdminPanel] = useState<AdminPanel | null>(null)
  const [maxShifts, setMaxShifts] = useState(5)
  const [preventBackToBack, setPreventBackToBack] = useState(true)
  const [limitWeekly, setLimitWeekly] = useState(true)
  const importInputRef = useRef<HTMLInputElement>(null)

  const scheduleData = useMemo(() => ({
    ...data,
    schedule: ensureMonthSchedule(data.schedule, year, month),
  }), [data, month, year])

  useEffect(() => {
    saveSchedulerData(data)
  }, [data])

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstWeekday = new Date(year, month - 1, 1).getDay()
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
    const result = smartAssign(scheduleData, {
      year,
      month,
      maxShifts,
      preventBackToBack,
      limitWeekly,
    })

    setData(result.data)
    setStatusMessage(`Smart assign filled ${result.assignedCount} shifts; ${result.blockedCount} could not be filled.`)
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

  const exportBackup = () => {
    const blob = new Blob([backupToJson(scheduleData)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `mc-scheduler-backup-${currentPrefix}.json`
    link.click()
    URL.revokeObjectURL(link.href)
    setStatusMessage('Backup exported.')
  }

  const downloadScheduleText = () => {
    const blob = new Blob([scheduleText], { type: 'text/plain' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `mars-schedule-${currentPrefix}.txt`
    link.click()
    URL.revokeObjectURL(link.href)
    setStatusMessage('Text schedule downloaded.')
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
    if (!vacationCallsign) {
      setStatusMessage('Select an operator before adding vacation.')
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
        [vacationCallsign]: [
          ...(current.vacations[vacationCallsign] ?? []),
          { start: vacationStart, end: vacationEnd },
        ],
      },
    }))
    setVacationStart('')
    setVacationEnd('')
    setStatusMessage(`Vacation added for ${vacationCallsign}.`)
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
      <aside className="sidebar" aria-label="Application sections">
        <div>
          <p className="eyebrow">MARS</p>
          <h1>Message Center Scheduler</h1>
        </div>

        <nav className="nav-list">
          <a aria-current="page" href="#schedule">Schedule</a>
          <a href="#operators">Operators</a>
          <a href="#positions">Positions</a>
          <a href="#backups">Backups</a>
        </nav>
      </aside>

      <section className="workspace" id="schedule">
        <header className="topbar">
          <div>
            <p className="eyebrow">Planning month</p>
            <h2>{monthName(year, month)} {year}</h2>
          </div>
          <div className="toolbar" aria-label="Schedule actions">
            <button type="button" className="secondary" onClick={() => importInputRef.current?.click()}>Import</button>
            <button type="button" className="secondary" onClick={exportBackup}>Export</button>
            <button type="button" className="secondary" onClick={downloadScheduleText}>Save Text</button>
            <button type="button" className="secondary" onClick={printSchedule}>Print</button>
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
            <select value={maxShifts} onChange={(event) => setMaxShifts(Number(event.target.value))}>
              {[1, 2, 3, 4, 5, 10].map((value) => (
                <option value={value} key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={preventBackToBack}
              onChange={(event) => setPreventBackToBack(event.target.checked)}
            />
            No back-to-back
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={limitWeekly}
              onChange={(event) => setLimitWeekly(event.target.checked)}
            />
            Max 2 shifts/week
          </label>
        </section>

        <section className="content-grid">
          <div className="calendar-panel">
            <div className="panel-heading">
              <h3>Calendar</h3>
              <div className="month-controls" aria-label="Month controls">
                <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>&lt;</button>
                <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>&gt;</button>
              </div>
            </div>

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
                      <strong>{day}</strong>
                      <label className="coverage-toggle">
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
                        <span>{position.shortName}</span>
                        <select
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
                      </div>
                    )) : null}
                  </article>
                )
              })}
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
                  <select value={vacationCallsign} onChange={(event) => setVacationCallsign(event.target.value)}>
                    <option value="">Select operator</option>
                    {scheduleData.operators.map((operator) => (
                      <option value={operator.callsign} key={operator.callsign}>{operator.callsign}</option>
                    ))}
                  </select>
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
              <form className="operator-form" onSubmit={(event) => { event.preventDefault(); addPosition() }}>
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
                  />
                  Requires ALE
                </label>
                <button type="submit" className="primary">Add Position</button>
              </form>
              <div className="table-list">
                {scheduleData.positions.map((position) => (
                  <div className="table-row" key={position.name}>
                    <strong>{position.shortName}</strong>
                    <span>{position.requiresALE ? 'Requires ALE' : 'No ALE required'}</span>
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
