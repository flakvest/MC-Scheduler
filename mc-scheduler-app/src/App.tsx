import './App.css'
import { defaultPositions } from './domain/schedulerTypes'

const positions = defaultPositions

const operators = [
  { callsign: 'NCS001', ale: true, shifts: 4 },
  { callsign: 'NCS014', ale: false, shifts: 3 },
  { callsign: 'NCS027', ale: true, shifts: 2 },
]

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function App() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.toLocaleString('default', { month: 'long' })
  const daysInMonth = new Date(year, today.getMonth() + 1, 0).getDate()
  const firstWeekday = new Date(year, today.getMonth(), 1).getDay()
  const openShiftCount = 9

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
            <h2>{month} {year}</h2>
          </div>
          <div className="toolbar" aria-label="Schedule actions">
            <button type="button" className="secondary">Import</button>
            <button type="button" className="secondary">Export</button>
            <button type="button" className="primary">Smart Assign</button>
          </div>
        </header>

        <section className="summary-grid" aria-label="Schedule summary">
          <article>
            <span>Operators</span>
            <strong>{operators.length}</strong>
          </article>
          <article>
            <span>Positions</span>
            <strong>{positions.length}</strong>
          </article>
          <article>
            <span>Open Shifts</span>
            <strong>{openShiftCount}</strong>
          </article>
          <article>
            <span>Storage</span>
            <strong>Local JSON</strong>
          </article>
        </section>

        <section className="content-grid">
          <div className="calendar-panel">
            <div className="panel-heading">
              <h3>Calendar</h3>
              <div className="month-controls" aria-label="Month controls">
                <button type="button" aria-label="Previous month">‹</button>
                <button type="button" aria-label="Next month">›</button>
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
                const isCovered = day % 6 !== 0

                return (
                  <article className={isCovered ? 'calendar-day' : 'calendar-day no-coverage'} key={day}>
                    <div className="day-header">
                      <strong>{day}</strong>
                      <span>{isCovered ? 'Coverage' : 'Off'}</span>
                    </div>
                    {isCovered ? positions.map((position) => (
                      <div className="assignment-row" key={position.name}>
                        <span>{position.shortName}</span>
                        <button type="button">Open</button>
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
                {operators.map((operator) => (
                  <div className="table-row" key={operator.callsign}>
                    <strong>{operator.callsign}</strong>
                    <span>{operator.ale ? 'ALE' : 'Standard'}</span>
                    <span>{operator.shifts} shifts</span>
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
                {positions.map((position) => (
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
