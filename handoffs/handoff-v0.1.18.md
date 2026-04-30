# MC-Scheduler Handoff - v0.1.18

## Session Summary

- Investigated the installed Tauri app opening to a black/empty window on multiple computers.
- Found the packaged `dist/index.html` was using absolute asset paths such as `/assets/...`.
- Updated Vite to build desktop assets with relative paths by setting `base: './'`.
- Rebuilt the Windows Tauri installer after the packaging fix.

## Root Cause

- The web build referenced JavaScript and CSS from the root path.
- In the packaged Tauri desktop app, those absolute paths may not resolve to the bundled frontend files.
- The app shell opened, but the React UI did not load, resulting in the black window.

## Verification

- `npm.cmd run build` passed.
- The rebuilt `dist/index.html` now references `./assets/...`.
- `npm.cmd test` passed.
- `npm.cmd run tauri -- build` passed.
- Test count remains 27 passing tests across 6 test files.

## Build Output

- Rebuilt installer:
  `C:\code-base\MC-Scheduler\mc-scheduler-app\src-tauri\target\release\bundle\nsis\MC Scheduler_0.0.0_x64-setup.exe`

## Git Checkpoint

- Pending final commit and push for the Tauri asset-path fix.

## Current Notes

- The installer is still versioned `0.0.0`.
- The corrected installer should replace the previous installer before testing on another computer.
- Existing installed copies may need to be uninstalled or updated with the rebuilt installer.

## Recommended Next Step

Install the rebuilt setup `.exe` and confirm the scheduler UI loads instead of the black window.
