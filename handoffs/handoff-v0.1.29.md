# MC-Scheduler Handoff - v0.1.29

## Current Project State

- Repository is on `main` and synced with `origin/main`.
- Latest commit is `8addede`:
  `Add holiday scheduling controls`.
- Current app and installer version is `0.0.8`.
- The app is still a React/TypeScript frontend packaged as a Windows desktop app with Tauri.
- The original single-file prototype remains in the repository as `scheduler1.66.html`.
- The active app lives under `mc-scheduler-app`.

## Latest Build Artifacts

- Latest installer:
  `C:\code-base\MC-Scheduler\mc-scheduler-app\src-tauri\target\release\bundle\nsis\MC Scheduler_0.0.8_x64-setup.exe`
- The previous `0.0.7` installer and ZIP still exist in the same NSIS bundle folder.

## New Work Since v0.1.28

- Added a Holidays admin menu.
- Added manual holiday entry with:
  - holiday name
  - holiday date
- Adding a holiday turns coverage off for that date and clears any existing assignments for that date.
- Holiday dates are visually marked on the calendar.
- Calendar coverage checkbox is disabled for dates marked as holidays.
- Smart Assign now skips holiday dates because they are non-coverage days.
- Schedule text output respects holidays as non-coverage days.
- Export, import, month export, browser storage, and AppData storage now include a `holidays` array.
- Older backups and older storage files remain compatible because missing holidays normalize to an empty list.
- Added Import Federal Holidays workflow.
- Federal holiday import first tries an internet lookup from:
  `https://date.nager.at/api/v3/PublicHolidays/YEAR/US`
- If internet lookup fails, the app falls back to built-in offline U.S. federal holiday rules.
- The internet lookup sends only the selected year and country code. It does not send operators, assignments, schedule data, or other local scheduler data.
- Added CSP permission only for:
  `https://date.nager.at`
- Added manual month controls near the Planning Month title:
  - Month dropdown
  - Year number field
  - Next Month button
- Existing previous/next calendar arrows remain.

## Current App Capabilities

- Operators can be added, edited, deleted, and assigned position permissions.
- Positions can be added, edited, renamed, and deleted.
- EXD still requires ALE.
- Vacations can be added and removed.
- Vacations are global data, not month-specific data.
- Holidays can be added and removed.
- Federal holidays can be imported for the selected year.
- Holidays turn off coverage and clear assignments for the affected date.
- Calendar assignments can be edited manually.
- Smart Assign fills eligible open shifts using current assignment rules and limits.
- Smart Assign skips non-coverage days, including holiday dates.
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
- The main `scheduler.json` stores operators, positions, vacations, holidays, and metadata.
- Schedule entries are split into yearly files.
- The app still loads everything into one complete in-memory scheduler object.
- Existing full `scheduler.json` files from older versions should still load.
- Existing backups without holidays should still load.
- After a successful save, older full schedule data is split into yearly schedule files.
- Automatic backups are still full merged JSON snapshots for recovery compatibility.

## Compatibility Rules Still In Force

- Do not rename scheduler position codes without asking.
- EXD requires ALE.
- Backups must stay JSON-compatible with older versions.
- Keep the single-file prototype until splitting it is approved.

## Verification From Latest Completed Work

- `npx.cmd eslint src` passed.
- `npm.cmd test` passed.
- `npm.cmd run build` passed.
- `cargo test` passed.
- `cargo check` passed.
- `npm.cmd run tauri -- build` passed.
- Frontend tests: 33 passing tests across 7 test files.
- Rust storage tests: 3 passing tests.
- Installer produced:
  `MC Scheduler_0.0.8_x64-setup.exe`

## Known Environment Notes

- `rg.exe` bundled inside Codex can be blocked by Windows with `Access is denied`.
- PowerShell search commands are usable as a fallback.
- Git commands work, but Git repeatedly warns that it cannot access:
  `C:\Users\shaun\.config\git\ignore`
- That Git warning has not blocked commits or pushes.
- Some Vite/NPM commands hit Windows `spawn EPERM` or build-info write failures inside the sandbox and pass when rerun with approved elevated execution.
- Cargo commands can hit target lock access failures inside the sandbox and pass when rerun with approved elevated execution.
- Local dev servers launched inside the sandbox may be cleaned up after a few seconds.
- A temporary static server was used during browser review:
  `C:\tmp\mc-scheduler-static-server.mjs`
- The static server is not part of the app and is only for local browser preview.

## Current Git Notes

- Latest pushed commit:
  `8addede Add holiday scheduling controls`
- `main` is synced with `origin/main`.
- `handoffs\handoff-v0.1.28.md` was already untracked before this handoff was created.
- This handoff is a new file and does not replace older handoffs.

## Recommended Next Manual Test

Install `MC Scheduler_0.0.8_x64-setup.exe` and test with either disposable data or after making a manual Export backup.

Test checklist:

1. Confirm the app displays version `0.0.8`.
2. Confirm existing operators, positions, vacations, assignments, and holidays load.
3. Use the Month dropdown and Year field to move to another month.
4. Use Next Month and confirm it jumps to the month after the current calendar month.
5. Add a manual holiday on a date with no assignments and confirm coverage turns off.
6. Add a manual holiday on a date with assignments and confirm the warning appears before assignments are cleared.
7. Import federal holidays for a selected year.
8. Confirm imported federal holidays appear in the Holidays menu.
9. Confirm imported holiday dates show as holiday/non-coverage days on the calendar.
10. Confirm Smart Assign does not fill holiday dates.
11. Export a full backup and confirm the JSON includes a `holidays` array.
12. Export a month backup and confirm holidays remain available in the exported JSON.
13. Close and reopen the app and confirm holidays persist.
14. Use Open Data Folder and confirm `scheduler.json`, `years`, and `backups` still exist.
15. Test Zeroize only after a backup exists.

## Suggested Next Development Options

- Add a safer "restore from backup" workflow inside the app.
- Add a visible backup/export reminder before Zeroize.
- Add storage-level integration tests for save/load migration using temporary folders.
- Add holiday filtering by year in the Holidays drawer if the list becomes long.
- Add a small data maintenance screen showing file paths, backup count, yearly schedule files, and holiday count.
