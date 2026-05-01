# MC-Scheduler Handoff - v0.1.27

## Session Summary

- Added a destructive `Zeroize` action to the schedule toolbar.
- Added two in-app confirmations:
  - `Are you sure?`
  - `Are you REALLY sure?`
- The final confirmation wipes operators, positions, vacations, assignments, and historical schedules by resetting the app to empty default scheduler data.
- Bumped the app and installer version to `0.0.7`.
- Rebuilt the Windows Tauri installer.

## Verification

- `npm.cmd test` passed.
- `cargo test` passed.
- `cargo check` passed.
- `npm.cmd run build` passed.
- `npm.cmd run tauri -- build` passed.
- Test count remains 27 passing frontend tests across 6 test files, plus 3 passing Rust storage tests.

## Build Output

- Rebuilt installer:
  `C:\code-base\MC-Scheduler\mc-scheduler-app\src-tauri\target\release\bundle\nsis\MC Scheduler_0.0.7_x64-setup.exe`

## Current Notes

- Zeroize uses the normal app save path after state reset.
- With the yearly storage split, the next save removes stale yearly schedule files that are no longer active.
- Automatic backup behavior should create a full merged JSON backup before the wipe is saved.
- No scheduler assignment rules, position codes, vacation rules, or import/export formats were intentionally changed.

## Recommended Next Step

Install `MC Scheduler_0.0.7_x64-setup.exe` and test Zeroize only after exporting a manual backup or using disposable test data.
