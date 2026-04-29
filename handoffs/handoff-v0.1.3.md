# MC-Scheduler Handoff - v0.1.3

## Session Summary

- Added visible global Smart Assign settings.
- Replaced hardcoded Smart Assign values with user-controlled state.
- Added controls for:
  - Max shifts per month.
  - No back-to-back assignments.
  - Max 2 shifts per week.
- Smart Assign now reads those global settings when filling the selected month.

## Verification

- `npm.cmd test` passed.
- `npm.cmd run build` passed.
- Browser reload at `http://127.0.0.1:5173/` passed.
- Confirmed the following controls are visible:
  - `Global Settings`
  - `Max shifts/month`
  - `No back-to-back`
  - `Max 2 shifts/week`
- Browser console check showed no errors or warnings.
- Test count remains 12 passing tests.

## Git Checkpoint

- `6b13f40` - Add smart assign settings

The commit was pushed to `origin/main`.

## Current Notes

- Smart Assign still uses the current fairness rule of choosing eligible operators with fewer existing shifts first.
- More advanced weighting is not yet implemented.
- Settings currently live in React state and reset on reload.
- The app remains a browser prototype using temporary browser JSON storage.

## Recommended Next Step

Persist Smart Assign settings with scheduler data, or add more advanced fairness/weighting controls if needed.
