# MC-Scheduler Handoff - v0.1.8

## Session Summary

- Ran the approved parallel sub-agent test with five focused work lanes.
- Added persistent Smart Assign settings.
- Changed weekly assignment control from a fixed on/off rule to a real `Max shifts/week` selector with values 1 through 10.
- Added position edit/delete support in the Positions drawer.
- Added a confirmation step before renaming a position code.
- Added selected-month backup export with `Export Month`.
- Updated `Clear Calendar` to use the month helper and to report when there are no assignments to clear.
- Added a desktop/Tauri readiness document at `docs/tauri-readiness.md`.
- Applied a compact UI polish pass to improve readability and day-to-day scanning.

## Verification

- `npm.cmd test` passed.
- `npm.cmd run build` passed.
- Test count is now 27 passing tests across 6 test files.
- Browser reload at `http://127.0.0.1:5173/` passed.
- Confirmed the browser title is `MARS Message Center Scheduler`.
- Confirmed `Export Month`, `Max shifts/week`, and Positions drawer controls are visible.
- Confirmed the browser console showed 0 errors.

## Git Checkpoint

- Pending final commit and push for v0.1.8.

## Current Notes

- The new Smart Assign settings are stored separately in browser local storage and safely default if missing or malformed.
- Legacy setting names are accepted by the settings parser for compatibility.
- Position renames update assignments and operator permissions only after confirmation.
- The desktop app path should wait until Rust/Cargo are installed and backup compatibility testing is locked down.
- Handoff files are stored in `C:\code-base\MC-Scheduler\handoffs`.

## Recommended Next Step

Have the user try the v0.1.8 UI and confirm whether position delete should be allowed for default positions like `EXD`, `DW`, and `DR`, or only for custom-added positions.
