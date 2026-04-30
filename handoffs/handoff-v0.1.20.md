# MC-Scheduler Handoff - v0.1.20

## Session Summary

- Fixed Export, Export Month, and Save Text for the Tauri desktop app.
- Replaced browser-only download behavior with a native Windows Save dialog when running in Tauri.
- Kept the browser download fallback for web/dev use.
- Added Tauri dialog and filesystem plugins.
- Granted only the needed desktop permissions: save dialog and text-file writing.
- Rebuilt the `0.0.1` Windows installer.

## Root Cause

- The app used a browser-style hidden link download.
- That pattern can fail silently inside the Tauri/WebView desktop runtime.
- A native Save dialog is more reliable for a Windows desktop app.

## Verification

- `npm.cmd test` passed.
- `npm.cmd run build` passed.
- `npm.cmd run tauri -- build` passed.
- Test count remains 27 passing tests across 6 test files.

## Build Output

- Rebuilt installer:
  `C:\code-base\MC-Scheduler\mc-scheduler-app\src-tauri\target\release\bundle\nsis\MC Scheduler_0.0.1_x64-setup.exe`

## Git Checkpoint

- Pending final commit and push for the desktop export fix.

## Current Notes

- The installer remains versioned `0.0.1`.
- Export actions should now prompt for where to save the file in the installed app.
- No scheduler logic, position codes, assignment rules, storage format, or backup compatibility behavior was changed.

## Recommended Next Step

Install the rebuilt `0.0.1` setup file and verify Export, Export Month, and Save Text each open a Save dialog and create the expected file.
