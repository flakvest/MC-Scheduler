# MC-Scheduler Handoff - v0.1.26

## Session Summary

- Bumped the app and installer version to `0.0.6`.
- Rebuilt the Windows Tauri installer for the yearly JSON storage change.
- Confirmed the new installer was created successfully.

## Verification

- `cargo check` passed.
- `cargo test` passed.
- `npm.cmd test` passed.
- `npm.cmd run build` passed.
- `npm.cmd run tauri -- build` passed.
- Test count remains 27 passing frontend tests across 6 test files, plus 3 passing Rust storage tests.

## Build Output

- Rebuilt installer:
  `C:\code-base\MC-Scheduler\mc-scheduler-app\src-tauri\target\release\bundle\nsis\MC Scheduler_0.0.6_x64-setup.exe`

## Current Notes

- Version `0.0.6` includes the yearly schedule file storage split.
- Existing full `scheduler.json` data should load before being split into yearly files on the next successful save.
- Automatic backups should remain full merged scheduler JSON snapshots.
- No scheduler assignment rules, position codes, vacation rules, or backup import/export formats were intentionally changed.

## Recommended Next Step

Install `MC Scheduler_0.0.6_x64-setup.exe` and run the upgrade smoke test against existing scheduler data.
