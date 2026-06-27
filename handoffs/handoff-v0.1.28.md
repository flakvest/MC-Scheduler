# MC-Scheduler Handoff - v0.1.28

## Current Project State

- Repository is on `main` and synced with `origin/main`.
- Latest commit is `6b6ef4c`:
  `Split yearly schedules and add zeroize`.
- Current app and installer version is `0.0.7`.
- The app is still a React/TypeScript frontend packaged as a Windows desktop app with Tauri.
- The original single-file prototype remains in the repository as `scheduler1.66.html`.
- The active app lives under `mc-scheduler-app`.

## Latest Build Artifacts

- Latest installer:
  `C:\code-base\MC-Scheduler\mc-scheduler-app\src-tauri\target\release\bundle\nsis\MC Scheduler_0.0.7_x64-setup.exe`
- Latest ZIP artifact also exists:
  `C:\code-base\MC-Scheduler\mc-scheduler-app\src-tauri\target\release\bundle\nsis\MC Scheduler_0.0.7_x64-setup.zip`

## Current App Capabilities

- Operators can be added, edited, deleted, and assigned position permissions.
- Positions can be added, edited, renamed, and deleted.
- EXD still requires ALE.
- Vacations can be added and removed.
- Vacations are global data, not month-specific data.
- A vacation entered only for April remains visible in the Vacations menu while viewing May.
- Calendar assignments can be edited manually.
- Smart Assign fills eligible open shifts using current assignment rules and limits.
- Schedule text can be saved or printed.
- Full JSON export and import remain available.
- Month-only export remains available.
- Destructive actions use in-app confirmations rather than browser-native prompts.
- Zeroize is available and wipes all scheduler data after two confirmations:
  - `Are you sure?`
  - `Are you REALLY sure?`

## Current Storage Model

- Desktop live data is stored under the app-specific Windows AppData folder.
- Main data file:
  `scheduler.json`
- Yearly schedule folder:
  `years`
- Yearly schedule files use names like:
  `schedule-2026.json`
- Automatic backups are stored in:
  `backups`
- The main `scheduler.json` now stores operators, positions, vacations, and metadata.
- Schedule entries are split into yearly files.
- The app still loads everything into one complete in-memory scheduler object, so frontend logic, exports, imports, and assignment rules still work against the same data shape as before.
- Existing full `scheduler.json` files from older versions should still load.
- After a successful save, older full schedule data is split into yearly schedule files.
- Automatic backups are still full merged JSON snapshots for recovery compatibility.

## Compatibility Rules Still In Force

- Do not rename scheduler position codes without asking.
- EXD requires ALE.
- Backups must stay JSON-compatible with older versions.
- Keep the single-file prototype until splitting it is approved.

## Verification From Latest Completed Work

- `npm.cmd test` passed.
- `cargo test` passed.
- `cargo check` passed.
- `npm.cmd run build` passed.
- `npm.cmd run tauri -- build` passed.
- Frontend tests: 27 passing tests across 6 test files.
- Rust storage tests: 3 passing tests.

## Known Environment Notes

- `rg.exe` bundled inside Codex is blocked by Windows with `Access is denied`.
- PowerShell search commands are usable as a fallback.
- Git commands work, but Git repeatedly warns that it cannot access:
  `C:\Users\shaun\.config\git\ignore`
- That Git warning has not blocked commits or pushes.
- Some Vite/NPM commands hit Windows `spawn EPERM` inside the sandbox and pass when rerun with approved elevated execution.

## Recommended Next Manual Test

Install `MC Scheduler_0.0.7_x64-setup.exe` and test with either disposable data or after making a manual Export backup.

Test checklist:

1. Confirm the app displays version `0.0.7`.
2. Confirm existing operators, positions, vacations, and assignments load.
3. Make one harmless schedule change.
4. Close and reopen the app and confirm the change persisted.
5. Use Open Data Folder and confirm `scheduler.json`, `years`, and `backups` exist.
6. Confirm `years\schedule-YYYY.json` contains schedule entries.
7. Confirm a new backup file contains a full merged scheduler JSON backup.
8. Test Export and confirm the exported JSON includes populated `schedule` entries.
9. Test Export Month and confirm it includes only the selected month schedule plus shared operators, positions, and vacations.
10. Test Zeroize only after a backup exists.
11. Confirm Zeroize asks both confirmation questions before wiping data.
12. After Zeroize, close and reopen the app and confirm data remains cleared.

## Suggested Next Development Options

- Add a safer "restore from backup" workflow inside the app.
- Add a visible backup/export reminder before Zeroize.
- Add storage-level integration tests for save/load migration using temporary folders.
- Add vacation filtering or grouping in the Vacations panel if the all-month list becomes noisy.
- Add a small data maintenance screen showing file paths, backup count, and yearly schedule files.
