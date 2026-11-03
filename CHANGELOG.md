# Changelog

## 0.2.0

Any Army MARS region can name itself and define its own positions. A first-run setup wizard asks for the region name, at least one position, shift limits, the back-to-back rule, and the week start before the calendar is used.

- Positions have a code, name, ALE or fixed-frequency type, optional four-character channel, sort order, and a daily or weekly assignment period.
- Daily seats are filled one coverage day at a time. A weekly seat is held by one operator for every coverage day in the week.
- Back-to-back is a region choice. Avoid is the default. Allow turns the rule off. There is no warn-only mode.
- The region sets a monthly maximum and a rolling-week maximum for daily seats. Zero means no limit. Each operator can override either limit, including no limit for that person.
- Schedules can be exported as an `.ics` calendar file for Google Calendar or Outlook.
- Opening a schedule from 0.0.8, 0.0.9, or 0.1.0 keeps operators, position codes, vacations, holidays, and assignments. Seats stay daily, back-to-back stays Avoid, the week starts on Monday, and the limits start at 5 per month and 2 daily shifts per rolling week. The first save writes a permanent `premigration-v1.json` backup that the ordinary five-save rotation does not delete.

People on 0.1.0 get this release from **Check for updates**. People on 0.0.8 or 0.0.9 install the setup file by hand. See [Upgrading](docs/UPGRADING.md).

## 0.1.0

- The Windows app checks GitHub Releases for a newer signed installer and asks before it downloads.
- A full-database backup is offered before the update is installed.
- Versions before 0.1.0 do not contain the updater and must be installed with the setup file.

## 0.0.9

- Avoiding consecutive days uses calendar dates, including across a month boundary, and leaves a seat open when the previous or next day is already filled.
