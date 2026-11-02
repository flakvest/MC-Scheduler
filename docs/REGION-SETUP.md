# Region setup

MC Scheduler can be used by any Army MARS region. A region names itself and creates its own message-center positions. Nothing in the scheduler treats the letters EXD, DW, or DR as special. Those names exist only if a region creates them, or if an older Region 4 file is opened.

## First-run setup

A new install starts with no positions. The setup panel asks for:

- **Region name.** This is the name printed at the top of the text schedule. You can leave it blank. A blank name prints `MARS SCHEDULE:`. You can change the name later under **Global Settings**.
- **Positions.** Each position has a short code, a name, a type, a daily or weekly assignment, an optional channel name, and a sort order.
- **Back-to-back.** Avoid back-to-back is the default. Smart Assign and Check Issues then keep an operator off the previous calendar day and the next calendar day. Friday and the following Monday are still allowed. Allow back-to-back turns that rule off. One person still holds only one seat on a day. Hand-picking a day does not use this rule.
- **Week starts on.** Monday is the default. This is used only by weekly seats. Every position in the region shares the same week.

**Load Region 4 example** creates three positions:

| Code | Name | Type | Assignment |
| --- | --- | --- | --- |
| EXD | EXD | ALE duty | Daily |
| DW | DeltaWhite | Fixed-frequency / net | Daily |
| DR | DeltaRed | Fixed-frequency / net | Daily |

Click **Finish setup** after at least one position exists. The calendar then uses one coverage switch per day for every position. ALE duty seats are filled first. One person can hold only one seat on a day.

You can change the back-to-back rule and the week start later under **Global Settings**. The old **No back-to-back** checkbox is no longer used.

## Position types

- **ALE duty.** The operator must be marked **ALE qualified**. A region can have two or more of these seats. Every one of them uses that same qualification.
- **Fixed-frequency / net.** Any operator who is allowed on that seat can take it. ALE qualification is not required.

## Daily and weekly seats

Assignment is chosen per position, so one seat can be weekly while the nets stay daily.

- **Daily.** The seat is filled one coverage day at a time. This is the default and matches schedules saved before this choice existed.
- **Weekly.** One operator holds that seat for every coverage day in the week. A holiday, a weekend, or a day marked off stays empty, and the same person keeps the other coverage days. Choosing someone on the calendar fills the whole week. Choosing Open clears the whole week. If any coverage day in that week would put the person on a second seat, or they are unavailable, the week is left unchanged.

A weekly seat can cross a month boundary. Smart Assign and a hand pick write those days in the neighboring month too.

With **Avoid back-to-back**, a weekly seat also stays off the previous week and the next week when that operator already works either week, on any seat. **Allow back-to-back** turns that off. A week that already has two different people is left as it is, and Check Issues says the week is split.

The text schedule and the printed calendar still list one line per day. A weekly seat shows the same operator on each of that week's coverage days.

**Max shifts/week** still limits daily seats. It does not limit a weekly hold, because the usual maximum of 2 would make a Monday-through-Friday week impossible. Each coverage day of a weekly hold still counts toward **Max shifts/month**.

## Channel name

Channel name is optional. If you fill it in, it must be exactly four letters or numbers, such as `AB12`. The app stores it in capitals. Anything else shows: "Channel name must be exactly 4 letters or numbers, such as AB12."

## Holidays

**US federal holidays (optional)** still loads the United States federal list. It does not run by itself. Typed holidays work the same as before.

## Existing Region 4 files

Opening a schedule saved by version 0.0.8, 0.0.9, or 0.1.0 keeps the same position codes, operators, vacations, holidays, and assignments. Seats that required ALE become ALE duty seats. Other seats become fixed-frequency / net seats. Channel names are left blank. Every seat stays daily. Back-to-back stays Avoid, and the week starts on Monday, even if the old No back-to-back checkbox was unchecked. The data folder does not move.

A month export includes the back-to-back rule, the week start, and each position's daily or weekly setting. Importing an older month file uses the same defaults: daily, Avoid, and Monday. Importing a newer month file keeps the choices that were saved in it.
