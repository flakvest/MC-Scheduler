# Scheduling decisions

## No back-to-back checks both neighboring days

Smart Assign, with **No back-to-back** turned on, will not place an operator on a coverage day when that operator already works the previous calendar day or the next calendar day.

Neighboring dates are calendar dates. The calculation does not convert a local midnight through UTC, so the same schedule is produced in US time zones, in time zones ahead of UTC, and across daylight-saving changes. The weekly shift count uses the same date helper.

If nobody can take an open seat without breaking the rule, Smart Assign leaves the seat open and records a plain reason, such as `ALPHA already works the next day.`

Choosing a name by hand still skips this rule. The checkbox, Check Issues pair reporting, and backup import behavior are unchanged.
