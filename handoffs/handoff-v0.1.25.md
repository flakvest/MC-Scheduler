# MC-Scheduler Handoff - v0.1.25

## Session Summary

- Changed desktop live schedule storage from one full `scheduler.json` schedule map to yearly schedule files.
- Kept operators, positions, vacations, and metadata in the main AppData `scheduler.json`.
- Added a new AppData `years` folder for files like `schedule-2026.json`.
- Kept the React and domain scheduler data shape unchanged so scheduler rules and exports still work with one complete in-memory schedule.
- Kept browser/dev mode on the existing single `localStorage` blob.
- Updated the data location panel to show the yearly schedule folder path in the desktop app.

## Upgrade Safety

- Existing full `scheduler.json` files still load because `load_scheduler_data` reads any schedule map from the main file.
- On the next successful save, schedule entries are split into yearly files.
- Automatic backups are written as full merged scheduler JSON snapshots before saving, so backup files remain compatible with the existing import path.
- Full manual export still uses the existing complete scheduler JSON format.

## Vacation Behavior

- Vacations are stored globally under `SchedulerData.vacations`, not inside monthly or yearly schedule files.
- The Vacations admin panel shows all stored vacation entries.
- A vacation entered only for April remains visible when viewing May unless it is manually removed.

## Verification

- `cargo test` passed.
- `cargo check` passed.
- `npm.cmd test` passed after rerunning outside the sandbox because the first sandboxed run hit Windows `spawn EPERM`.
- `npm.cmd run build` passed after rerunning outside the sandbox for the same `spawn EPERM` reason.

## Current Notes

- No scheduler assignment rules, position codes, vacation rules, or backup import/export formats were intentionally changed.
- No installer was rebuilt in this session.
- The app version was not bumped in this session.

## Recommended Next Step

Run an installed-desktop smoke test with existing data:

1. Open a current installed app with existing `scheduler.json` data.
2. Confirm existing assignments still appear.
3. Make one harmless schedule change.
4. Confirm AppData now contains `scheduler.json`, `years\schedule-YYYY.json`, and a full JSON backup.
