# Upgrading to 0.1.0

This is for people who already use MC Scheduler 0.0.8 or 0.0.9 on Windows. Version 0.1.0 does not update itself from those versions. You install it by running the new setup over the copy you already have.

Your schedules are not stored inside the program folder. They are stored in a separate data folder. Running the 0.1.0 setup keeps that folder, as long as you do not choose to delete application data.

## 1. Save a backup first

1. Open **MC Scheduler**.
2. At the top of the window, click **Export**. Do not click **Export Month**. **Export Month** saves only the month you are looking at. **Export** saves the whole schedule: every month and year, operators, positions, vacations, and holidays.
3. Choose a place you can find later, such as Documents or a USB drive, and save the file. The name starts with `mc-scheduler-backup-`.
4. Wait until the status line says `Backup exported.`

The three Smart Assign boxes (shifts per month, No back-to-back, and shifts per week) are not inside that Export file. Copying the data folder, below, keeps those as well.

## 2. Optional extra copy of the data folder

Close MC Scheduler first.

The data folder is:

`C:\Users\<Your Windows name>\AppData\Roaming\com.marsmessagecenter.scheduler`

Replace `<Your Windows name>` with the name you sign in with. AppData is a hidden folder. The easiest way to open it is inside the app, before you close it: under **Data location**, click **Open Data Folder**.

Copy that whole folder somewhere safe. Inside it you should see `scheduler.json`, a `years` folder, and a `backups` folder.

## 3. Run the 0.1.0 setup

Close MC Scheduler if it is still open. Then run `MC-Scheduler_0.1.0_x64-setup.exe`.

Windows may say it protected your PC. Click **More info**, then **Run anyway**.

If the setup says an older version is already installed:

- Select **Do not uninstall**.
- Click **Next** and finish the setup.

Leave **Uninstall before installing** unselected. If you do use that choice, the old uninstaller appears and shows **Delete the application data**. Leave that box unchecked. Checking it erases the schedules.

## 4. What you should see afterward

Open MC Scheduler. The **App Version** box should say **v0.1.0**. Your operators and the calendar should look the same as before. The status line should say the data was loaded from the AppData folder.

From this version on, you do not need to download the next setup by hand. Use **Check for updates** at the top of the window. The app will ask you to back up the full database before it installs anything.

## Later update: region positions

A later update (planned as 0.2.0) lets any Army MARS region name itself and create its own positions. People already using 0.1.0 get that update from **Check for updates**. The app asks for a full backup before it installs.

After that update:

- EXD, DW, DR, and every saved assignment stay as they are.
- EXD remains an ALE duty seat. DW and DR remain fixed-frequency / net seats.
- Channel names start blank. You can add a four-character channel later if you want one.
- Scheduling stays as it is today until you change it: every seat is daily, back-to-back is Avoid, and the week starts on Monday. That is true even if the old No back-to-back checkbox was unchecked.
- The first time the new version saves, it keeps a copy of the older data file in the backups folder (or in browser storage under the pre-migration key).

Two new choices are stored with the schedule, in Global Settings and in first-run setup:

- **Back-to-back.** Avoid back-to-back is the default. Smart Assign and Check Issues then keep an operator off the previous calendar day and the next calendar day. Allow back-to-back turns that rule off. One person still holds only one seat on a day. The old No back-to-back checkbox is not used anymore.
- **Daily or weekly, per position.** Daily is the default. Weekly gives one operator that seat for every coverage day in the week. The week starts on Monday unless you pick another day. A holiday or a day marked off stays empty. For a weekly seat, back-to-back means the previous or next week.

The Region 4 example seats stay daily. Details for setting up a region are in [Region setup](REGION-SETUP.md).
