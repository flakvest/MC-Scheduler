# MC-Scheduler Handoff - v0.1.21

## Session Summary

- Investigated the extra black tabbed window opening beside the scheduler UI.
- Identified it as the Windows console host opening for the Tauri executable.
- Added the standard Windows release-build subsystem setting to suppress the console window.
- Bumped the app version from `0.0.1` to `0.0.2`.
- Rebuilt the Windows Tauri installer.

## Root Cause

- `src-tauri/src/main.rs` did not include the release-build Windows GUI subsystem attribute.
- Without that setting, Windows launches a console window in addition to the Tauri app window.

## Verification

- `npm.cmd test` passed.
- `npm.cmd run tauri -- build` passed after one retry.
- The first build attempt hit a transient Windows file-lock error while writing the setup `.exe`; retry succeeded.
- Test count remains 27 passing tests across 6 test files.

## Build Output

- Rebuilt installer:
  `C:\code-base\MC-Scheduler\mc-scheduler-app\src-tauri\target\release\bundle\nsis\MC Scheduler_0.0.2_x64-setup.exe`

## Git Checkpoint

- Pending final commit and push for the console-window fix and `0.0.2` version bump.

## Current Notes

- This change only affects Windows desktop packaging and version metadata.
- No scheduler logic, position codes, assignment rules, storage format, or backup compatibility behavior was changed.

## Recommended Next Step

Install `MC Scheduler_0.0.2_x64-setup.exe` and confirm only the scheduler app window opens, without the extra black console window.
