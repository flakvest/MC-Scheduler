# MC-Scheduler Handoff - v0.1.22

## Session Summary

- Moved desktop live scheduler storage from WebView `localStorage` to a normal AppData JSON file.
- Added a one-time migration path from old WebView `localStorage` into the new AppData file when old data exists and the AppData file is empty.
- Added automatic backups before overwriting the AppData scheduler file.
- Limited automatic backups to the latest 5 files.
- Added visible app version display in the schedule summary.
- Added a data location panel with the AppData file path and backup folder path.
- Added an Open Data Folder button for the desktop app.
- Kept browser/dev mode on browser `localStorage`.
- Bumped the app and installer version to `0.0.3`.

## Storage Details

- Desktop live data file:
  `scheduler.json` under the app-specific AppData folder.
- Desktop automatic backup folder:
  `backups` under the same AppData folder.
- Browser/dev fallback storage key:
  `mc-scheduler-data-v1`.

## Verification

- `npm.cmd test` passed.
- `npm.cmd run build` passed.
- `cargo check` passed.
- `npm.cmd run tauri -- build` passed.
- Test count remains 27 passing tests across 6 test files.

## Build Output

- Rebuilt installer:
  `C:\code-base\MC-Scheduler\mc-scheduler-app\src-tauri\target\release\bundle\nsis\MC Scheduler_0.0.3_x64-setup.exe`

## Git Checkpoint

- Pending final commit and push for AppData JSON storage, automatic backups, version display, data location UI, and the `0.0.3` installer build.

## Current Notes

- No scheduler logic, position codes, assignment rules, or backup compatibility behavior was intentionally changed.
- Manual Export and Import remain available.
- The new live storage path should be more stable across installer updates than WebView `localStorage`.
- The installer artifact itself is a local build output and is not committed to Git.

## Recommended Next Step

Install `MC Scheduler_0.0.3_x64-setup.exe` on a test machine with existing data and confirm the data migrates into AppData, Export works, and the Open Data Folder button shows the new storage files.
