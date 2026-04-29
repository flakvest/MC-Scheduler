# MC-Scheduler Handoff - v0.1.7

## Session Summary

- Added a `Clear Calendar` button to the top action row near Smart Assign.
- The button clears only active assignments for the selected month.
- The button keeps the following data unchanged:
  - Operators
  - Positions
  - Vacations
  - Coverage on/off settings
  - Smart Assign settings
- Added confirmation before clearing assignments.

## Verification

- `npm.cmd test` passed.
- `npm.cmd run build` passed.
- Browser reload at `http://127.0.0.1:5173/` passed.
- Confirmed `Clear Calendar` is visible.
- Browser console check showed no errors or warnings.
- Test count remains 14 passing tests.

## Git Checkpoint

- `94aa9db` - Add clear calendar assignments button

The commit was pushed to `origin/main`.

## Current Notes

- This is intended as a testing convenience but may remain as a permanent month tool.
- Handoff files are stored in `C:\code-base\MC-Scheduler\handoffs`.

## Recommended Next Step

Add edit/delete behavior for positions, or add persistence for Smart Assign settings.
