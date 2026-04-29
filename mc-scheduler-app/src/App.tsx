import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { ensureMonthSchedule, getShiftCount, smartAssign } from './domain/schedulerRules'
import { loadSchedulerData, saveSchedulerData } from './domain/schedulerStorage'
import { type SchedulerData } from './domain/schedulerTypes'

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const today = new Date()

const monthName = (year: number, month: number) =>
  new Date(year, month - 1).toLocaleString('default', { month: 'long' })

const monthPrefix = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, '0')}`

const dateKey = (year: number, month: number, day: number) =>
  `${monthPrefix(year, month)}-${String(day).padStart(2, '0')}`

function App() {
  const [data, setData] = useState<SchedulerData>(() => loadSchedulerData())
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [statusMessage, setStatusMessage] = useState('Ready')

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
      maxShifts: 5,
      preventBackToBack: true,
      limitWeekly: true,
    })

    setData(result.data)
    setStatusMessage(`Smart assign filled ${result.assignedCount} shifts; ${result.blockedCount} could not be filled.`)
  }

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
            <button type="button" className="secondary">Import</button>
            <button type="button" className="secondary">Export</button>
            <button type="button" className="primary" onClick={runSmartAssign}>Smart Assign</button>
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
                <div className="weekday" key={day}>{day}</div>
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
                      <span>{scheduleDay.coverage ? 'Coverage' : 'Off'}</span>
                    </div>
                    {scheduleDay.coverage ? scheduleData.positions.map((position) => (
                      <div className="assignment-row" key={position.name}>
                        <span>{position.shortName}</span>
                        <button type="button">{scheduleDay.assignments[position.name] || 'Open'}</button>
                      </div>
                    )) : null}
                  </article>
                )
              })}
            </div>
          </div>

          <aside className="side-panels">
            <section className="data-panel" id="operators">
              <div className="panel-heading">
                <h3>Operators</h3>
                <button type="button">Add</button>
              </div>
              <div className="table-list">
                {scheduleData.operators.length === 0 ? (
                  <p className="empty-state">No operators yet.</p>
                ) : scheduleData.operators.map((operator) => (
                  <div className="table-row" key={operator.callsign}>
                    <strong>{operator.callsign}</strong>
                    <span>{operator.ale ? 'ALE' : 'Standard'}</span>
                    <span>{getShiftCount(scheduleData.schedule, scheduleData.positions, operator.callsign, currentPrefix)} shifts</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="data-panel" id="positions">
              <div className="panel-heading">
                <h3>Positions</h3>
                <button type="button">Add</button>
              </div>
              <div className="table-list">
                {scheduleData.positions.map((position) => (
                  <div className="table-row" key={position.name}>
                    <strong>{position.shortName}</strong>
                    <span>{position.requiresALE ? 'Requires ALE' : 'No ALE required'}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </section>
    </main>
  )
}

export default App
