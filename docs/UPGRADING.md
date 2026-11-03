# Upgrading MC Scheduler

Your schedules are not stored inside the program folder. They are stored in:

`C:\Users\<Your Windows name>\AppData\Roaming\com.marsmessagecenter.scheduler`

Running a newer setup keeps that folder, as long as you do not choose to delete application data.

## If you already have 0.1.0

Use **Check for updates** at the top of the window. The app asks for a full backup before it installs 0.2.0. You do not need to download the setup file by hand.

After the update, the **App Version** box should say **v0.2.0**.

## If you have 0.0.8 or 0.0.9

Those versions do not check for updates. Install 0.2.0 by running the new setup over the copy you already have.

### 1. Save a backup first

1. Open **MC Scheduler**.
2. At the top of the window, click **Export**. Do not click **Export Month**. **Export Month** saves only the month you are looking at. **Export** saves the whole schedule: every month and year, operators, positions, vacations, and holidays.
3. Choose a place you can find later, such as Documents or a USB drive, and save the file. The name starts with `mc-scheduler-backup-`.
4. Wait until the status line says `Backup exported.`

The three Smart Assign boxes (shifts per month, No back-to-back, and shifts per week) are not inside that Export file. Copying the data folder, below, keeps those as well.

### 2. Optional extra copy of the data folder

Close MC Scheduler first.

The data folder is the path at the top of this page. Replace `<Your Windows name>` with the name you sign in with. AppData is a hidden folder. The easiest way to open it is inside the app, before you close it: under **Data location**, click **Open Data Folder**.

Copy that whole folder somewhere safe. Inside it you should see `scheduler.json`, a `years` folder, and a `backups` folder.

### 3. Run the 0.2.0 setup

Close MC Scheduler if it is still open. Then run `MC-Scheduler_0.2.0_x64-setup.exe`.

Windows may say it protected your PC. Click **More info**, then **Run anyway**.

If the setup says an older version is already installed:

- Select **Do not uninstall**.
- Click **Next** and finish the setup.

Leave **Uninstall before installing** unselected. If you do use that choice, the old uninstaller appears and shows **Delete the application data**. Leave that box unchecked. Checking it erases the schedules.

### 4. What you should see afterward

Open MC Scheduler. The **App Version** box should say **v0.2.0**. Your operators and the calendar should look the same as before. The status line should say the data was loaded from the AppData folder.

From this version on, use **Check for updates** for later releases.

## What 0.2.0 does to an existing schedule

- EXD, DW, DR, and every saved assignment stay as they are.
- EXD remains an ALE duty seat. DW and DR remain fixed-frequency / net seats.
- Channel names start blank. You can add a four-character channel later if you want one.
- Scheduling stays as it was until you change it: every seat is daily, back-to-back is Avoid, the week starts on Monday, the monthly maximum is 5, and the daily rolling-week maximum is 2. That is true even if the old No back-to-back checkbox was unchecked or the old shift boxes had been changed.
- The first time 0.2.0 saves, it keeps a permanent copy of the older data named `premigration-v1.json` in the backups folder. Later saves do not delete that file. The rotating folder still keeps only the last 5 ordinary backups.

Two choices are stored with the schedule, in Global Settings:

- **Back-to-back.** Avoid back-to-back is the default. Smart Assign and Check Issues then keep an operator off the previous calendar day and the next calendar day. Allow back-to-back turns that rule off. One person still holds only one seat on a day.
- **Daily or weekly, per position.** Daily is the default. Weekly gives one operator that seat for every coverage day in the week. The week starts on Monday unless you pick another day. A holiday or a day marked off stays empty. For a weekly seat, back-to-back means the previous or next week.

The Region 4 example seats stay daily. Details are in [Region setup](REGION-SETUP.md). A schedule can also be saved as a calendar file; see [Calendar export](CALENDAR-EXPORT.md).
