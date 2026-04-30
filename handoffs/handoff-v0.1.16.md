# MC-Scheduler Handoff - v0.1.16

## Session Summary

- Started moving the app toward a Windows `.exe` using Tauri v2.
- Added a minimal Tauri desktop scaffold under `mc-scheduler-app/src-tauri`.
- Added the Tauri CLI as a project dev dependency.
- Updated Vite config for stable Tauri dev/build behavior.
- Set the Tauri bundle target to NSIS so the intended output is a Windows setup `.exe`.
- Added a local-only Content Security Policy for the desktop shell.
- Added `src-tauri/target` to `.gitignore` so Rust build output is not committed.

## Verification

- `npm.cmd test` passed.
- `npm.cmd run build` passed.
- `npm.cmd run tauri -- --version` reported `tauri-cli 2.10.1`.
- `npm.cmd run tauri -- info` successfully read the Tauri config.
- Test count remains 27 passing tests across 6 test files.

## Current Blockers

- Rust is not installed.
- Cargo is not installed.
- rustup is not installed.
- Visual Studio Build Tools with MSVC and Windows SDK were not detected.
- Because those native prerequisites are missing, the Windows `.exe` installer cannot be built yet.

## Git Checkpoint

- Tauri scaffold committed as `9ca2c89 Add Tauri desktop scaffold`.
- Pending final push after this handoff is committed.

## Current Notes

- WebView2 is installed and detected.
- The app still uses browser-style local storage inside the Tauri WebView profile.
- JSON backup/export behavior was not changed.
- No scheduler logic, position codes, assignment rules, or backup compatibility behavior was changed.

## Recommended Next Step

Install the Windows native build prerequisites: Rust via rustup, plus Visual Studio Build Tools with the MSVC compiler and Windows SDK. After that, run `npm.cmd run tauri -- build` from `C:\code-base\MC-Scheduler\mc-scheduler-app` to create the first installer.
