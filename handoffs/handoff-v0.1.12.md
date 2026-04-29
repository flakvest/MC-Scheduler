# MC-Scheduler Handoff - v0.1.12

## Session Summary

- Changed the vacation operator picker from a plain dropdown to a searchable callsign input.
- The input uses browser suggestions from the current operator list.
- Typed callsigns are normalized to uppercase.
- Adding vacation now requires the callsign to match an existing operator.
- This prevents accidental vacation records for mistyped or unknown callsigns.

## Verification

- `npm.cmd test` passed.
- `npm.cmd run build` passed.
- Test count remains 27 passing tests across 6 test files.
- Source check confirmed the vacation form now uses `input[list="vacation-operator-options"]` and a matching datalist.

## Git Checkpoint

- Pending final commit and push for v0.1.12.

## Current Notes

- Browser automation loaded the page, but clicking the Vacations drawer was blocked by an in-app browser coordinate issue.
- This change is limited to `mc-scheduler-app/src/App.tsx`.
- Handoff files are stored in `C:\code-base\MC-Scheduler\handoffs`.

## Recommended Next Step

Open the Vacations drawer and type part of an operator callsign to confirm the browser suggestion list feels natural.
