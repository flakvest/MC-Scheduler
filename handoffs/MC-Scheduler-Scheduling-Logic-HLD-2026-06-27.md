# MC-Scheduler Scheduling Logic and Workflow Migration HLD

**Document date:** 2026-06-27
**Purpose:** Provide an AI development assistant with a precise, implementation-neutral description of the MC-Scheduler scheduling logic and operator workflows so they can be incorporated into an existing web scheduler.
**Source reviewed:** The active React/TypeScript application under `mc-scheduler-app`, its domain tests, and the original `scheduler1.66.html` prototype.
**Scope:** Scheduling logic and workflows only. Storage layout, desktop packaging, backup architecture, and Zeroize implementation are outside scope except where a workflow changes scheduling data.

---

## 1. Instructions to the Receiving AI

Do not copy this application blindly into the target web scheduler. First inspect the target system's existing data model, authentication, authorization, API boundaries, calendar behavior, time-zone policy, and assignment rules.

Use this document as a behavioral contract. Produce a gap analysis that separates:

1. behavior already supported by the target system;
2. behavior that can be mapped directly;
3. behavior that conflicts with existing target rules;
4. behavior requiring a product-owner decision; and
5. behavior that must be added.

Before implementation, identify any ambiguity or conflict and ask the system owner. In particular, do not rename the position codes described here without approval. Preserve the rule that **EXD requires ALE**.

The target implementation should keep the scheduling rules in a testable domain/service layer rather than embedding them directly in web pages, database queries, or UI event handlers.

---

## 2. Executive Summary

MC-Scheduler builds a monthly MARS Message Center duty schedule. A normal coverage day has one assignment slot for every configured position. The default positions are:

| Position | ALE required by default | Special rule |
|---|---:|---|
| EXD | Yes | EXD is always tied to the operator's ALE capability. |
| DW | No | Uses normal position permission rules. |
| DR | No | Uses normal position permission rules. |

The scheduler supports two assignment modes:

- **Manual assignment:** A scheduler selects an eligible operator for a specific date and position.
- **Smart Assign:** A deterministic, greedy process fills currently open shifts for one month while applying configurable monthly, weekly, and back-to-back limits.

The core inputs are:

- operators and their callsigns;
- ALE capability;
- operator permission for each position;
- recurring unavailable weekdays;
- inclusive vacation date ranges;
- positions and their ALE requirement;
- coverage status for each date;
- holidays; and
- existing assignments.

Smart Assign is designed to produce a practical, reasonably balanced schedule. It is **not** a global optimization engine and does not guarantee the mathematically fairest or most complete schedule.

---

## 3. Scope and Non-Goals

### In scope

- operator, position, availability, vacation, holiday, coverage, and assignment concepts;
- monthly calendar creation;
- manual assignment behavior;
- Smart Assign behavior;
- shift-count and fairness behavior;
- issue reporting for unfilled shifts;
- administrative workflows that affect scheduling;
- schedule clearing and schedule output behavior;
- recommended web architecture, security boundaries, and acceptance tests.

### Out of scope

- Windows/Tauri packaging;
- local AppData and browser storage implementation;
- backup folder structure and yearly files;
- installer behavior;
- Zeroize implementation details;
- visual branding and pixel-level UI reproduction.

The target web system may use a different database, backend, frontend, or deployment model. Behavioral equivalence matters more than matching the current technology.

---

## 4. Terms

| Term | Meaning |
|---|---|
| Operator | A person eligible to work one or more scheduler positions, identified by a callsign. |
| Callsign | The operator's unique, uppercase identifier. |
| Position | A duty slot required on each coverage day, such as EXD, DW, or DR. |
| ALE | Automatic Link Establishment capability. It is mandatory for EXD. |
| Coverage day | A date on which the Message Center must staff every configured position. |
| Non-coverage day | A date on which no positions should be staffed. |
| Open shift | A position on a coverage day with no assigned operator. |
| Unavailable weekday | A recurring day of the week when an operator cannot work. |
| Vacation | An inclusive start/end date range when an operator cannot work. |
| Smart Assign | The automatic, rule-based process that fills open shifts for a selected month. |
| Assignment issue | An open shift Smart Assign cannot fill, with the reason or reasons candidates were blocked. |

---

## 5. High-Level Design

The recommended target design separates user interaction, business rules, and persistence.

```text
Web calendar and administration pages
                |
                v
Authenticated scheduling API / application service
                |
        +-------+--------+
        |                |
        v                v
Eligibility service   Smart Assign service
        |                |
        +-------+--------+
                |
                v
Transactional schedule repository / database
```

### 5.1 Recommended responsibilities

**Web UI**

- Displays the selected month, coverage, holidays, positions, open shifts, and assignments.
- Collects administrator choices and sends identifiers rather than trusting display text.
- Shows validation failures returned by the server.
- Never acts as the only enforcement point for eligibility rules.

**Scheduling API or application service**

- Authenticates the user and verifies their scheduling permissions.
- Validates dates, identifiers, callsigns, settings, and requested changes.
- Runs all assignment checks on the server.
- Applies multi-record changes in database transactions.
- Detects concurrent modifications.

**Eligibility service**

- Provides one authoritative answer to: "Can this operator work this position on this date?"
- Supports base/manual rules and additional Smart Assign policy limits.
- Returns a machine-readable reason code plus a plain-language explanation.

**Smart Assign service**

- Loads a consistent snapshot of operators, positions, coverage dates, vacations, holidays, and assignments.
- Fills only open shifts.
- Preserves existing assignments.
- Returns assigned and blocked counts plus issues.
- Commits all resulting changes atomically, or supports a preview/approve workflow.

**Repository/database layer**

- Enforces unique callsigns, unique position codes, and one assignment per date/position.
- Uses foreign keys so assignments cannot reference missing operators or positions.
- Prevents two simultaneous users from silently overwriting one another.

---

## 6. Conceptual Data Model

The names below are conceptual. Map them to the target system rather than forcing this exact schema.

### 6.1 Operator

```text
Operator
- id: stable internal identifier
- callsign: unique uppercase string
- aleCapable: boolean
- unavailableWeekdays: set of integers 0 through 6
- positionPermissions: mapping of position identifier to allowed boolean
```

Weekday values follow JavaScript convention in the current app:

| Value | Day |
|---:|---|
| 0 | Sunday |
| 1 | Monday |
| 2 | Tuesday |
| 3 | Wednesday |
| 4 | Thursday |
| 5 | Friday |
| 6 | Saturday |

Use stable internal IDs in a new web database. Callsigns should remain editable display/business identifiers, but changing a callsign must not break historical assignments.

### 6.2 Position

```text
Position
- id: stable internal identifier
- code: unique position code
- displayCode: short display code
- requiresALE: boolean
- sortOrder: optional explicit display/assignment order
```

Default position codes are `EXD`, `DW`, and `DR`. Do not rename them during migration without owner approval.

### 6.3 Vacation

```text
Vacation
- id
- operatorId
- startDate: local calendar date, inclusive
- endDate: local calendar date, inclusive
```

The current behavior permits multiple and overlapping vacation ranges. Overlap normalization is not required for behavioral compatibility, although the target UI may warn about duplicates.

### 6.4 Holiday

```text
Holiday
- id
- date: local calendar date
- name
- source: manual | generated | lookup
```

Only one effective holiday exists per date in the current model. Manual or lookup entries take precedence over generated entries when duplicates are consolidated.

### 6.5 Schedule day

```text
ScheduleDay
- date: local calendar date
- coverageRequired: boolean
```

### 6.6 Assignment

```text
Assignment
- scheduleDate
- positionId
- operatorId
- assignmentSource: manual | smart (recommended addition)
- createdBy / updatedBy / timestamps (recommended for a web system)
```

Required database constraint:

```text
UNIQUE(scheduleDate, positionId)
```

The service must also prevent one operator from holding two positions on the same date. This can be enforced with a second unique constraint when the web system's rules match MC-Scheduler:

```text
UNIQUE(scheduleDate, operatorId)
```

---

## 7. Calendar and Coverage Rules

### 7.1 Month initialization

When a month is viewed or scheduled, create an effective schedule-day record for every date in that month if one does not already exist.

Default coverage is:

- Monday through Friday: coverage on;
- Saturday and Sunday: coverage off; and
- holiday: coverage off regardless of weekday.

An existing non-holiday date keeps its stored coverage selection. Month initialization must not overwrite an existing manual coverage choice.

### 7.2 Turning coverage off

When coverage is changed from on to off:

- delete all assignments for that date;
- leave other dates unchanged; and
- report clearly that assignments were cleared.

This must be atomic in a multi-user web system. The coverage update and assignment deletion must succeed or fail together.

### 7.3 Turning coverage on

Turning coverage on creates an empty coverage day if necessary. It does not restore assignments that were previously cleared.

### 7.4 Holidays

Adding or importing a holiday:

- marks that date as a holiday;
- forces coverage off;
- clears all assignments on that date; and
- causes Smart Assign to skip the date.

If assignments already exist, the current manual holiday workflow asks for confirmation before clearing them. Federal-holiday import presents the dates for confirmation, then clears affected assignments when approved.

Removing a holiday:

- removes the holiday marker;
- does **not** automatically turn coverage back on; and
- does **not** restore previous assignments.

This last rule prevents an administrative cleanup action from silently creating staffing requirements or reconstructing stale assignments.

### 7.5 Federal holiday generation

The current app can import 11 U.S. federal holidays for the selected year. It attempts an external lookup and falls back to built-in rules. Fixed-date holidays use the observed weekday when the actual date falls on a weekend. The scheduling contract is that the resulting holiday dates are non-coverage dates; the target system may use its own trusted holiday provider.

---

## 8. Operator Rules and Workflows

### 8.1 Add operator

Input and validation:

- callsign is required;
- trim surrounding whitespace;
- normalize to uppercase;
- callsign must be unique;
- select ALE capability;
- select recurring unavailable weekdays; and
- select permitted positions.

Default permissions:

- non-EXD positions are allowed unless explicitly disabled;
- EXD permission is not independently editable; it equals ALE capability; and
- when a new ALE-required custom position is created, ALE-capable operators receive permission by default and non-ALE operators do not.

### 8.2 Edit operator

The scheduler can change callsign, ALE capability, unavailable weekdays, and position permissions.

When the callsign changes, existing assignments and vacation ownership must continue to reference the same operator. A web system should accomplish this through an immutable internal operator ID. Do not use mutable callsign text as the database foreign key.

When ALE capability is disabled:

- EXD permission becomes false;
- new EXD assignments must be blocked; and
- the receiving team must decide how to handle an already-existing EXD assignment.

The current app does not automatically clear every assignment that becomes invalid after an operator edit. This is a current implementation behavior, not necessarily the desired web policy. Flag invalid existing assignments for review rather than silently deleting them unless the owner explicitly chooses another policy.

### 8.3 Delete operator

Deletion currently:

- requires confirmation;
- removes the operator;
- removes the operator's vacation entries; and
- clears all of that operator's assignments across all dates.

In a web system with audit/history requirements, prefer deactivation over hard deletion. If true deletion is required, perform all related changes in one transaction and retain an audit event without storing unnecessary sensitive content.

---

## 9. Position Rules and Workflows

### 9.1 Add position

- Position code is required.
- Trim and normalize the code to uppercase.
- Position code must be unique.
- The user selects whether ALE is required.
- Existing operators receive a default permission: allowed when the position does not require ALE; allowed only for ALE-capable operators when it does.
- `EXD` cannot be added again.

### 9.2 EXD invariant

`EXD` must always require ALE. The UI, API, service, and database/business-rule layer should all protect this invariant. Do not rely only on a disabled checkbox in the browser.

### 9.3 Rename position

Renaming a position is consequential and requires explicit confirmation. Existing assignments and operator permission mappings must be migrated to the new code atomically.

Because the project owner has directed that scheduler position codes not be renamed without asking, a receiving AI must obtain approval before altering `EXD`, `DW`, or `DR` codes.

### 9.4 Delete position

Deletion requires confirmation and:

- removes the position;
- clears all assignments for that position; and
- removes the corresponding permission from every operator.

Prefer deactivation when the target system needs historical reports to retain the meaning of old schedules.

---

## 10. Base Assignment Eligibility

The base rules apply to manual assignment and Smart Assign.

An operator is eligible for a date and position only when every condition below is true:

1. The operator exists.
2. The position exists.
3. The date is a coverage day.
4. The operator's recurring unavailable weekdays do not include that date's weekday.
5. The date does not fall within any of the operator's vacation ranges, including both start and end dates.
6. If the position requires ALE, the operator is ALE capable.
7. The operator is allowed to work the position.
8. The operator is not already assigned to another position on the same date.

For EXD specifically, ALE capability is authoritative. A separate position-permission value must never allow a non-ALE operator to work EXD.

Recommended machine-readable reason codes:

| Code | Meaning |
|---|---|
| `OPERATOR_NOT_FOUND` | Operator does not exist. |
| `POSITION_NOT_FOUND` | Position does not exist. |
| `NO_COVERAGE` | Date does not require coverage. |
| `OPERATOR_UNAVAILABLE` | Recurring weekday or vacation blocks the operator. |
| `ALE_REQUIRED` | Position requires ALE and operator is not ALE capable. |
| `POSITION_NOT_PERMITTED` | Operator lacks permission for the position. |
| `ALREADY_ASSIGNED_TODAY` | Operator already holds another position that date. |
| `MONTHLY_LIMIT_REACHED` | Smart Assign monthly policy blocks the operator. |
| `PREVIOUS_DAY_ASSIGNED` | Smart Assign back-to-back policy blocks the operator. |
| `WEEKLY_LIMIT_REACHED` | Smart Assign weekly policy blocks the operator. |

---

## 11. Manual Assignment Workflow

### 11.1 Display eligible choices

For each open position on a coverage day, the UI shows:

- `Open`; and
- operators passing the base eligibility rules.

The currently assigned operator remains visible so the existing selection can be displayed even if later changes have made that assignment ineligible.

### 11.2 Save manual assignment

The server must re-run eligibility checks at save time. Never trust a browser-provided eligibility result.

On success:

- create or replace the assignment for that date and position;
- leave other assignments unchanged; and
- return an updated schedule/version.

On failure:

- make no scheduling change; and
- return a specific reason suitable for display.

### 11.3 Clear manual assignment

Selecting `Open` removes the assignment for that date and position without changing coverage or other positions.

### 11.4 Important difference from Smart Assign

The current manual workflow does **not** apply these Smart Assign policy limits:

- maximum shifts per month;
- no back-to-back shifts; and
- maximum shifts per week.

This permits an authorized scheduler to handle exceptions manually while still enforcing capability, availability, permission, coverage, and same-day uniqueness.

The target team must preserve this distinction unless the owner explicitly decides that manual scheduling should enforce the automatic limits too.

---

## 12. Shift Counting

### 12.1 Monthly shift count

For a given operator and calendar month, count every assignment in that month across all configured positions.

Conceptually:

```text
monthlyCount(operator, YYYY-MM) =
    number of assignments where assignment.date starts with YYYY-MM
    and assignment.operator is the selected operator
```

Because normal assignment rules prevent one operator from holding two positions on one date, this normally equals days worked in that month. The implementation counts assignments, not distinct dates.

### 12.2 Weekly shift count: current exact behavior

For a target date, inspect the seven-calendar-day window from three days before through three days after the target date. Count the number of dates in that window on which the operator has at least one assignment.

```text
window = targetDate - 3 days through targetDate + 3 days
weeklyCount = number of window dates on which operator worked
```

This is a centered rolling seven-day window. It is **not** a Sunday-to-Saturday or Monday-to-Sunday calendar week.

This detail should be confirmed with the owner before web implementation because users may interpret "per week" differently.

### 12.3 Date handling

Scheduling dates are local calendar dates, not timestamps. Use a date-only database type where possible. Avoid converting a date-only value through UTC in a way that can change the calendar day in another time zone.

---

## 13. Smart Assign Settings

The current settings are global to the running application rather than per operator.

| Setting | Current default | Allowed in current UI | Meaning |
|---|---:|---:|---|
| Maximum shifts per month | 5 | 1-10 | Block candidates whose existing monthly assignment count is already at the limit. |
| No back-to-back | On | On/off | Block a candidate who worked the immediately previous calendar day. |
| Maximum shifts per week | 2 | 1-10 | Block candidates whose centered seven-day count is already at the limit. |

The target system should decide whether settings are global, organization-specific, schedule-specific, or month-specific. Store them server-side if they must be consistent for multiple schedulers.

---

## 14. Smart Assign Algorithm

### 14.1 Behavioral requirements

Smart Assign:

- operates on one selected calendar month;
- ensures every date in the month has an effective coverage record;
- skips weekends by default unless coverage was manually enabled;
- skips holidays and every other non-coverage date;
- preserves all existing assignments;
- fills only open positions;
- handles ALE-required positions before positions that do not require ALE;
- processes dates from the first through the last day of the month;
- applies base eligibility and Smart Assign policy limits;
- prefers the eligible operator with the fewest assignments in the selected month at that moment; and
- reports each shift that remains open.

### 14.2 Exact pseudocode

```text
function smartAssign(schedule, selectedYear, selectedMonth, settings):
    ensure effective schedule days exist for every date in selected month

    positions = all configured positions
    positions = stable sort positions so requiresALE=true comes first

    assignedCount = 0
    blockedCount = 0
    issues = []

    for date in selected month, ascending:
        if date is not a coverage day:
            continue

        for position in positions:
            if date/position already has an assignment:
                continue

            candidates = operators where:
                base eligibility passes
                AND monthly count is below maximum
                AND, when enabled, operator did not work previous day
                AND centered seven-day count is below weekly maximum

            stable sort candidates by current selected-month assignment count ascending

            if candidates is empty:
                blockedCount += 1
                add issue(date, position, summarized rejection reasons)
                continue

            assign candidates[0] to date/position
            assignedCount += 1

    return updated schedule, assignedCount, blockedCount, issues
```

### 14.3 Tie-breaking

When two candidates have the same monthly count, the current stable sort preserves their existing operator-list order. Therefore operator insertion/order becomes the implicit tie-breaker.

A database query has no reliable implicit order. The web implementation must use an explicit deterministic tie-breaker. For exact current compatibility, preserve a configured operator order. If no such order exists, ask the owner whether to use callsign, a rotation value, least-recently-worked, or another policy.

Do not introduce random assignment without approval. Random behavior makes results difficult to explain, reproduce, and test.

### 14.4 Existing assignments affect later choices

All existing manual and Smart Assign assignments in the selected month count toward fairness and limits. Every new assignment immediately changes the candidate's count before the next open shift is processed.

### 14.5 ALE-scarce positions first

Positions marked `requiresALE` are processed before other positions so an ALE-capable operator is less likely to be consumed by a general position while an ALE-only position remains open.

This is a scarcity heuristic. It improves practical results but does not search all possible schedules.

### 14.6 Back-to-back behavior: current exact behavior

When enabled, the current rule checks only whether the operator worked the **previous** calendar day. It does not separately check the next day.

Because Smart Assign processes dates chronologically, that is sufficient for assignments created during one clean forward pass. However, an existing future assignment can create a back-to-back pair when filling the prior date.

The receiving team must ask whether the desired web rule is:

- exact compatibility: check previous day only; or
- symmetric validation: block when either previous or next day is assigned.

### 14.7 Smart Assign is greedy, not globally optimal

The algorithm makes the best available local choice for each open shift and never revisits that choice. It does not:

- backtrack;
- swap assignments;
- forecast later scarce dates;
- minimize all operators' count variance globally;
- optimize weekends or preferred days;
- prioritize the operator who has waited longest;
- guarantee every fillable shift is filled; or
- guarantee the only possible complete schedule.

Do not describe it to users as an optimizer. "Rule-based fair fill" is more accurate.

---

## 15. Assignment Issue Reporting

After Smart Assign, every unfilled position on a coverage day becomes an issue containing:

- date;
- position code; and
- plain-language reason summary.

The current reason summary evaluates every operator and combines distinct rejection explanations. If there are no operators, the reason is `No operators exist.`

The `Check Issues` workflow performs the same evaluation without assigning anyone. It scans the selected month and reports all currently open shifts using the current Smart Assign settings.

Recommended web response:

```json
{
  "assignedCount": 12,
  "blockedCount": 2,
  "issues": [
    {
      "date": "2026-07-14",
      "positionCode": "EXD",
      "reasonCodes": ["ALE_REQUIRED", "OPERATOR_UNAVAILABLE"],
      "message": "No eligible operator is available for EXD."
    }
  ],
  "scheduleVersion": 27
}
```

Machine-readable codes let the web UI group and translate problems without parsing English messages.

---

## 16. Clear Calendar Workflow

`Clear Calendar` operates on the selected month only.

- It requires confirmation when assignments exist.
- It removes every assignment in that month.
- It preserves coverage selections.
- It preserves holidays.
- It preserves every other month.
- It does not remove operators, positions, vacations, or Smart Assign settings.

The web API should take the selected `YYYY-MM` explicitly, validate authorization, and execute the deletion transactionally.

---

## 17. Schedule Display and Text Output

The monthly calendar shows:

- one cell for each date;
- coverage/on, off, or holiday status;
- one assignment control for each position on coverage days; and
- `Open` when a position is unfilled.

The text schedule uses this conceptual format:

```text
MARS SCHEDULE: JULY 2026
==============================
01: EXD:ALPHA | DW:BRAVO | DR:OPEN
02: --- NO COVERAGE ---
```

Every calendar date is included. Non-coverage days, including holidays, appear as `--- NO COVERAGE ---`. Coverage days list positions in configured position order.

---

## 18. Web Security and Multi-User Requirements

The desktop app is effectively single-user. A web conversion introduces authentication, authorization, concurrency, and audit requirements.

### 18.1 Authentication and authorization

- Require authentication for all scheduling data.
- Define roles such as viewer, scheduler, and administrator.
- Viewers may read schedules but cannot change assignments.
- Schedulers may edit coverage and assignments and run Smart Assign.
- Only authorized administrators may manage operators, positions, holidays, or destructive monthly actions.
- Enforce authorization on the server for every request.

### 18.2 Input validation

- Validate date strings as real calendar dates, not only with a text pattern.
- Normalize and length-limit position codes and callsigns.
- Reject duplicate callsigns and position codes using database constraints.
- Validate vacation start date is not after end date.
- Restrict Smart Assign limits to approved positive integer ranges.
- Treat all names and labels as untrusted text and escape them when displayed.
- Use parameterized database queries or a safe ORM.

### 18.3 Concurrency

Two schedulers must not silently overwrite each other. Use one of:

- optimistic concurrency with a schedule version/revision;
- row versions; or
- a transaction with appropriate locking.

Smart Assign should run against a consistent snapshot and commit atomically. If the schedule changed after the preview or calculation started, reject the commit and ask the user to refresh or rerun.

### 18.4 Auditability

For a shared web system, record:

- who assigned or cleared a shift;
- whether an assignment was manual or Smart Assign;
- who changed coverage;
- who changed operator capability/permissions;
- who ran or approved Smart Assign; and
- when the change occurred.

Do not log unnecessary personal data. Callsigns and scheduling actions should be visible only to authorized users.

---

## 19. Recommended API Boundaries

These are illustrative, not mandatory URL names.

| Operation | Suggested request | Important server behavior |
|---|---|---|
| Get month | `GET /schedules/{year}/{month}` | Return coverage, holidays, positions, assignments, counts, and revision. |
| Set coverage | `PUT /schedule-days/{date}/coverage` | Authorize, validate, and atomically clear assignments when disabling. |
| Assign operator | `PUT /schedule-days/{date}/positions/{positionId}` | Re-run base eligibility and enforce concurrency. |
| Clear assignment | `DELETE /schedule-days/{date}/positions/{positionId}` | Remove only that slot. |
| Check issues | `POST /schedules/{year}/{month}/issues` | Evaluate without mutation using supplied or stored settings. |
| Preview Smart Assign | `POST /schedules/{year}/{month}/smart-assign/preview` | Return proposed assignments, issues, and base revision. |
| Commit Smart Assign | `POST /schedules/{year}/{month}/smart-assign/commit` | Revalidate revision and commit atomically. |
| Clear month | `DELETE /schedules/{year}/{month}/assignments` | Require explicit confirmation in UI and authorization on server. |

Preview/commit is recommended for a web system because it allows a scheduler to review proposed changes. Exact desktop compatibility can instead run and save in one operation.

---

## 20. Current Behavior Versus Decisions to Confirm

The following are verified current behaviors but may represent implementation choices rather than permanent business policy.

| Topic | Current behavior | Decision required before changing |
|---|---|---|
| Weekly limit | Centered rolling window from date -3 through date +3. | Confirm whether users expect a calendar week instead. |
| Back-to-back | Checks the previous day only. | Confirm whether existing next-day assignments must also block. |
| Tie-breaker | Existing operator-list order. | Define explicit deterministic order for a database system. |
| Manual override | Monthly, weekly, and back-to-back limits are not applied manually. | Confirm that authorized manual exceptions should remain possible. |
| Invalid existing assignment after operator edit | Not automatically cleared. | Decide whether to warn, block save, or clear after confirmation. |
| Smart Assign | Greedy and does not backtrack. | Decide whether exact compatibility or a stronger optimizer is desired. |
| Vacation overlap | Multiple overlapping ranges are accepted. | Decide whether to merge or warn. |
| Delete operator/position | Clears dependent assignments. | Decide whether web history requires deactivation instead. |
| Holiday removal | Does not restore coverage. | Preserve unless owner explicitly requests automatic restoration. |
| Settings scope | Effectively global/local to the current app. | Define organization, schedule, month, or user scope for web use. |

Do not silently "improve" these behaviors. Each change can produce a different schedule.

---

## 21. Acceptance Test Suite

The receiving implementation should automate at least the following tests.

### 21.1 Calendar and coverage

1. A new Monday defaults to coverage on.
2. A new Saturday and Sunday default to coverage off.
3. A stored manual coverage choice is not overwritten when reopening a month.
4. Turning coverage off clears every assignment on that date.
5. Turning coverage on does not restore cleared assignments.
6. A holiday forces coverage off and clears assignments.
7. Removing a holiday does not turn coverage back on.

### 21.2 Operator availability and eligibility

8. A recurring unavailable weekday blocks the operator.
9. Vacation start date blocks the operator.
10. Vacation end date blocks the operator.
11. A date outside the vacation range does not block the operator.
12. A non-ALE operator cannot work EXD.
13. An ALE operator can work EXD when all other rules pass.
14. A denied position permission blocks the operator.
15. An operator cannot hold two positions on the same date.
16. No assignment is allowed on a non-coverage date.

### 21.3 Manual scheduling

17. Manual assignment enforces base eligibility.
18. Manual assignment can exceed the Smart Assign monthly maximum.
19. Manual assignment can create a back-to-back exception.
20. Clearing one position leaves other assignments and coverage unchanged.

### 21.4 Smart Assign

21. Smart Assign skips non-coverage dates and holidays.
22. Existing assignments are preserved.
23. Only open shifts are filled.
24. ALE-required positions are processed before general positions.
25. The eligible operator with the lowest current monthly count is chosen.
26. A candidate at the monthly maximum is blocked.
27. With no-back-to-back enabled, an operator who worked the prior day is blocked.
28. With no-back-to-back disabled, that operator may be selected if otherwise eligible.
29. A candidate at the centered seven-day maximum is blocked.
30. Every unfilled coverage position produces an issue.
31. With no operators, an issue reports that no operators exist.
32. Running Smart Assign twice does not replace assignments created by the first run.
33. Results are deterministic for the same ordered inputs and settings.

### 21.5 Administrative side effects

34. Renaming a callsign preserves assignments and vacations through the operator's stable ID.
35. Deleting/deactivating an operator follows the approved historical-data policy.
36. Renaming a position preserves its assignments and permissions.
37. EXD cannot be changed to no-ALE.
38. Deleting/deactivating a position follows the approved historical-data policy.
39. Clearing a month removes only that month's assignments and preserves coverage.

### 21.6 Web security and concurrency

40. An unauthenticated user cannot read or modify schedules.
41. A read-only user cannot assign operators or run Smart Assign.
42. A stale schedule revision cannot overwrite newer changes.
43. Smart Assign either commits all proposed assignments or none.
44. Malformed dates, invalid identifiers, and out-of-range settings are rejected.
45. User-supplied labels render as text and cannot inject script or markup.

---

## 22. Recommended Migration Sequence

1. **Inspect and map the target system.** Document its current entities, rules, roles, APIs, and calendar semantics.
2. **Resolve policy questions.** Confirm weekly-window meaning, back-to-back symmetry, tie-breaking, manual overrides, and historical deletion behavior.
3. **Create a domain mapping.** Map operator, position, vacation, holiday, coverage day, and assignment to existing target entities.
4. **Implement pure eligibility tests.** Build and test base eligibility before adding automatic assignment.
5. **Implement manual workflows.** Use the same server-side eligibility service.
6. **Implement issue checking.** Verify counts and reasons without mutating the schedule.
7. **Implement Smart Assign preview.** Reproduce the deterministic greedy algorithm first.
8. **Add transactional commit and concurrency control.** Prevent partial or stale writes.
9. **Run acceptance tests with a fixed fixture.** Compare results against MC-Scheduler for identical inputs.
10. **Pilot with copied/non-production data.** Have an experienced scheduler review differences before enabling production writes.

Do not replace the greedy algorithm with an optimizer during the compatibility phase. Establish matching behavior first; evaluate enhancements as a separate, owner-approved change.

---

## 23. Example Compatibility Fixture

Use a small deterministic fixture to compare implementations.

### Operators

| Callsign | ALE | Unavailable | Allowed positions |
|---|---:|---|---|
| ALPHA | Yes | Sunday | EXD, DW, DR |
| BRAVO | No | Tuesday | DW, DR |
| CHARLIE | Yes | Saturday | EXD, DW, DR |

### Settings

```text
Maximum shifts/month: 5
No back-to-back: true
Maximum shifts/week: 2
```

### Scenario checks

- BRAVO must never receive EXD.
- BRAVO must not be assigned on a Tuesday.
- A vacation for ALPHA from `2026-07-06` through `2026-07-08` blocks all three dates.
- A holiday on `2026-07-03` is non-coverage and has no assignments.
- If ALPHA and CHARLIE have equal monthly counts, the configured deterministic operator order resolves the EXD tie.
- If an assignment already exists, Smart Assign leaves it unchanged.
- If no candidate can fill a shift, the shift remains open and an issue is returned.

The receiving team should expand this fixture into a month-long golden-file comparison after the policy questions in Section 20 are resolved.

---

## 24. Definition of Done

The web conversion is behaviorally complete when:

- the target system owner has approved the policy decisions;
- server-side base eligibility matches Section 10;
- manual assignment preserves the approved override behavior;
- Smart Assign produces deterministic results matching the approved algorithm;
- holidays, coverage, vacations, and administrative changes have the documented side effects;
- unfilled shifts return actionable reasons;
- authorization and concurrency are enforced server-side;
- the acceptance suite passes; and
- an experienced MARS scheduler validates a representative month before production use.

---

## 25. Source-of-Truth Note

This HLD describes behavior verified in the MC-Scheduler active source as of 2026-06-27. When this document and the target system disagree, do not guess which is correct. Present the conflict to the system owner with a concrete example showing how each interpretation changes the resulting schedule.
