# Region setup

MC Scheduler can be used by any Army MARS region. A region names itself and creates its own message-center positions. Nothing in the scheduler treats the letters EXD, DW, or DR as special. Those names exist only if a region creates them, or if an older Region 4 file is opened.

## First-run setup

A new install starts with no positions. Add the seats on the setup panel itself. Each seat needs a code, a name, a type, daily or weekly assignment, an optional channel name, and a sort order. The list can be edited or deleted before you finish.

**Finish setup** stays unavailable until the region name is filled in and at least one position exists. The reason is written next to the button. A click that still fails puts that same message in an error line beside the button.

The setup panel also asks for:

- **Region name.** This is the name printed at the top of the text schedule. You can change it later under **Global Settings**.
- **Back-to-back.** Avoid back-to-back is the default. Smart Assign and Check Issues then keep an operator off the previous calendar day and the next calendar day. Friday and the following Monday are still allowed. Allow back-to-back turns that rule off. One person still holds only one seat on a day. Hand-picking a day does not use this rule.
- **Week starts on.** Monday is the default. This is used only by weekly seats. Every position in the region shares the same week.
- **Max shifts/month.** The default is 5. Choose **No limit**, or a number from 1 to 31. Each coverage day counts, including each day of a weekly seat. A Monday-through-Friday weekly seat is 5, so the default allows one such week in a month.
- **Max daily shifts/week.** The default is 2. This is the rolling week used for daily seats. Choose **No limit** to turn it off. It does not limit a weekly seat, because 2 would make a Monday-through-Friday week impossible.

**Load Region 4 example** creates three positions. If positions already exist, the app asks before it replaces them. Assignments for seats that are not in the example are removed, so a hidden seat cannot keep blocking one person from one seat per day. The example does not change the shift limits. A new region, and a file migrated from 0.0.8, 0.0.9, or 0.1.0, starts at 5 shifts per month and 2 daily shifts per rolling week.

The example positions are:

| Code | Name | Type | Assignment |
| --- | --- | --- | --- |
| EXD | EXD | ALE duty | Daily |
| DW | DeltaWhite | Fixed-frequency / net | Daily |
| DR | DeltaRed | Fixed-frequency / net | Daily |

After setup, the calendar uses one coverage switch per day for every position. ALE duty seats are filled first. One person can hold only one seat on a day. A position code may use letters, numbers, and hyphens only.

You can change the back-to-back rule and the week start later under **Global Settings**. The old **No back-to-back** checkbox is no longer used.

## Position types

- **ALE duty.** The operator must be marked **ALE qualified**. A region can have two or more of these seats. Every one of them uses that same qualification.
- **Fixed-frequency / net.** Any operator who is allowed on that seat can take it. ALE qualification is not required. Changing an ALE seat to a net removes that ALE requirement for every operator immediately.

## Daily and weekly seats

Assignment is chosen per position, so one seat can be weekly while the nets stay daily.

- **Daily.** The seat is filled one coverage day at a time. This is the default and matches schedules saved before this choice existed.
- **Weekly.** One operator holds that seat for every coverage day in the week. A holiday, a weekend, or a day marked off stays empty, and the same person keeps the other coverage days. Choosing someone on the calendar fills the whole week. Choosing Open clears the whole week. If any coverage day in that week would put the person on a second seat, or they are unavailable, the week is left unchanged.

A weekly seat can cross a month boundary. Smart Assign and a hand pick write those days in the neighboring month too. Choosing Open, or clearing the month, also clears that weekly seat on the days that fall in the neighboring month. Daily seats outside the month stay.

Choosing a person for a weekly seat that someone else already holds, including on a day in the other month, asks first and names who would be replaced.

Hand-picking a seat asks before it puts someone over a shift limit, and the message names that limit. Smart Assign and Check Issues still leave the seat open instead of going over the limit.

Changing the week start, or switching a filled seat from Daily to Weekly, keeps the assignments already on the calendar. If one week then has more than one person, Smart Assign fills the open days with whoever already has the most coverage days that week, when that person is eligible. A tie stays open, and Check Issues says the week is split.

With **Avoid back-to-back**, a weekly seat also stays off the previous week and the next week when that operator already works either week, on any seat. **Allow back-to-back** turns that off.

The text schedule and the printed calendar still list one line per day. A channel, when one is set, is printed beside the position code. A weekly seat shows the same operator on each of that week's coverage days. **Export to calendar (.ics)** writes those same days as all-day events. See [Calendar export](CALENDAR-EXPORT.md).

On the Operators screen, **Max shifts per month** and **Max daily shifts per rolling week** are optional. Leave a box blank to use the region default, which is shown as the placeholder. Enter 0 for no limit for that person. Those values are that person's own limits and replace the region numbers. Smart Assign uses them. A hand pick asks first instead of refusing.

## Channel name

Channel name is optional. If you fill it in, it must be exactly four letters or numbers, such as `AB12`. The app stores it in capitals. Anything else shows: "Channel name must be exactly 4 letters or numbers, such as AB12." The text schedule and the printed calendar show it next to the position code.

## Holidays

**US federal holidays (optional)** still loads the United States federal list. It does not run by itself. Typed holidays work the same as before.

## Existing Region 4 files

Opening a schedule saved by version 0.0.8, 0.0.9, or 0.1.0 keeps the same position codes, operators, vacations, holidays, and assignments. Seats that required ALE become ALE duty seats. Other seats become fixed-frequency / net seats. Channel names are left blank. Every seat stays daily. Back-to-back stays Avoid, and the week starts on Monday, even if the old No back-to-back checkbox was unchecked. The data folder does not move.

A month export includes the back-to-back rule, the week start, and each position's daily or weekly setting. Importing an older month file uses the same defaults: daily, Avoid, and Monday. Importing a newer month file keeps the choices that were saved in it.
