# Export the schedule to a calendar

**Export to calendar (.ics)** is next to **Save Text** and **Print**. It writes an iCalendar file you can import into Google Calendar or Outlook.

The file lists one all-day event for each assigned coverage day. A weekly seat is already stored as one assignment per coverage day, so it becomes one event per day. Open seats are left out. The app does not store shift times, so the events have no start or end time.

The default is the full calendar: every assigned day in the file. In the export window you can limit it to the month on screen, or to one operator.

The event title is the position code, a dash, and the operator callsign. The description includes the position name, the channel when one is set, and the region name. The calendar name is the region name followed by `MC Schedule`.

The suggested file name looks like `army-mars-region-4-schedule-2026-11-03.ics`.

## Import into Google Calendar

1. In Google Calendar, open **Settings**.
2. In the left menu, open **Import & export**.
3. Choose the `.ics` file.
4. Choose a calendar that you use only for this schedule, then click **Import**.

Create that calendar first with **Add other calendars**, then **Create new calendar**. Name it something like `Region 4 MC Schedule`.

Importing the same file again updates an event when the calendar program matches its id. Google Calendar often adds a second copy instead, especially if the operator on that seat changed, because the id includes the date, the position, and the operator. Import into the dedicated calendar, and delete that calendar's events before you import a replacement file if you see duplicates.

Outlook can open the same file with **File**, then **Open & Export**, then **Import/Export**, then **Import an iCalendar (.ics)**.
