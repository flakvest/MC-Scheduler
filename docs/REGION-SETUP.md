# Region setup

MC Scheduler can be used by any Army MARS region. A region names itself and creates its own message-center positions. Nothing in the scheduler treats the letters EXD, DW, or DR as special. Those names exist only if a region creates them, or if an older Region 4 file is opened.

## First-run setup

A new install starts with no positions. The setup panel asks for:

- **Region name.** This is the name printed at the top of the text schedule. You can leave it blank. A blank name prints `MARS SCHEDULE:`. You can change the name later under **Global Settings**.
- **Positions.** Each position has a short code, a name, a type, an optional channel name, and a sort order.

**Load Region 4 example** creates three positions:

| Code | Name | Type |
| --- | --- | --- |
| EXD | EXD | ALE duty |
| DW | DeltaWhite | Fixed-frequency / net |
| DR | DeltaRed | Fixed-frequency / net |

Click **Finish setup** after at least one position exists. The calendar then uses one coverage switch per day for every position. ALE duty seats are filled first. One person can hold only one seat on a day.

## Position types

- **ALE duty.** The operator must be marked **ALE qualified**. A region can have two or more of these seats. Every one of them uses that same qualification.
- **Fixed-frequency / net.** Any operator who is allowed on that seat can take it. ALE qualification is not required.

## Channel name

Channel name is optional. If you fill it in, it must be exactly four letters or numbers, such as `AB12`. The app stores it in capitals. Anything else shows: "Channel name must be exactly 4 letters or numbers, such as AB12."

## Holidays

**US federal holidays (optional)** still loads the United States federal list. It does not run by itself. Typed holidays work the same as before.

## Existing Region 4 files

Opening a schedule saved by version 0.0.8, 0.0.9, or 0.1.0 keeps the same position codes, operators, vacations, holidays, and assignments. Seats that required ALE become ALE duty seats. Other seats become fixed-frequency / net seats. Channel names are left blank. The data folder does not move.
