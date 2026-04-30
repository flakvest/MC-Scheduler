# MC-Scheduler Handoff - v0.1.19

## Session Summary

- Bumped the application version from `0.0.0` to `0.0.1`.
- Updated npm package metadata, npm lockfile metadata, Cargo metadata, Cargo lockfile metadata, and Tauri config.
- Rebuilt the Windows Tauri installer so the setup filename now includes `0.0.1`.

## Verification

- `npm.cmd test` passed.
- `npm.cmd run tauri -- build` passed.
- Test count remains 27 passing tests across 6 test files.

## Build Output

- Rebuilt installer:
  `C:\code-base\MC-Scheduler\mc-scheduler-app\src-tauri\target\release\bundle\nsis\MC Scheduler_0.0.1_x64-setup.exe`

## Git Checkpoint

- Pending final commit and push for the `0.0.1` version bump.

## Current Notes

- This change only updates version metadata and rebuilds the installer.
- No scheduler logic, position codes, assignment rules, storage format, or backup compatibility behavior was changed.
- The older `0.0.0` installer may still exist in the local build output folder, but `0.0.1` is the newer installer to test.

## Recommended Next Step

Install `MC Scheduler_0.0.1_x64-setup.exe` and confirm the app opens to the scheduler UI on the target test machines.
