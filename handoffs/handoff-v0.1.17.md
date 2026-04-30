# MC-Scheduler Handoff - v0.1.17

## Session Summary

- Installed the native Windows build prerequisites needed by Tauri.
- Installed Rust stable through rustup.
- Installed Visual Studio Build Tools 2022 C++ components with MSVC and the Windows SDK.
- Built the first Tauri desktop executable.
- Built the first Windows NSIS setup `.exe` installer.
- Replaced the temporary indexed-color icon with a true-color Windows-compatible app icon.
- Added the Windows `.ico` file required by Tauri packaging.
- Added the Tauri-generated schema files and Rust lockfile needed for repeatable builds.
- Added a root `.gitignore` entry so local installer downloads under `tools/` are not committed.

## Verification

- `npm.cmd test` passed.
- `npm.cmd run tauri -- info` passed all environment checks.
- `npm.cmd run tauri -- build` completed successfully.
- Test count remains 27 passing tests across 6 test files.

## Build Output

- Desktop executable:
  `C:\code-base\MC-Scheduler\mc-scheduler-app\src-tauri\target\release\mc-scheduler-app.exe`
- Windows setup installer:
  `C:\code-base\MC-Scheduler\mc-scheduler-app\src-tauri\target\release\bundle\nsis\MC Scheduler_0.0.0_x64-setup.exe`

## Git Checkpoint

- Successful first Tauri installer build assets committed as `c2228a6 Finalize Tauri Windows build assets`.
- Pending final push after this handoff is committed.

## Current Notes

- WebView2, MSVC, Rust, Cargo, rustup, and the stable Rust MSVC toolchain are now detected.
- The installer is currently versioned `0.0.0` because the app and Tauri config still use that version.
- The icon is a simple generated placeholder and can be replaced with a finished brand icon later.
- No scheduler logic, position codes, assignment rules, or backup compatibility behavior was changed.

## Recommended Next Step

Decide whether to set the app version to a real release number, such as `1.0.0`, before distributing the installer.
