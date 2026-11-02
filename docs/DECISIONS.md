# Scheduling decisions

## No back-to-back checks both neighboring days

Smart Assign, with **No back-to-back** turned on, will not place an operator on a coverage day when that operator already works the previous calendar day or the next calendar day.

Neighboring dates are calendar dates. The calculation does not convert a local midnight through UTC, so the same schedule is produced in US time zones, in time zones ahead of UTC, and across daylight-saving changes. The weekly shift count uses the same date helper.

If nobody can take an open seat without breaking the rule, Smart Assign leaves the seat open and records a plain reason, such as `ALPHA already works the next day.`

Choosing a name by hand still skips this rule. The checkbox, Check Issues pair reporting, and backup import behavior are unchanged.

## In-app updates always ask, and a full backup comes first

The desktop app checks GitHub Releases for a newer version when it opens and when the operator chooses **Check for updates**. It never installs an update by itself.

The update dialog shows the new version and the release notes. The recommended action is **Back up full database**, which writes every month and year, operators, positions, vacations, holidays, and Smart Assign settings. Skipping that backup requires an explicit **Continue without backup?** confirmation. After a backup is saved, or after that confirmation, the operator can download and install the update. The app then restarts.

Versions before 0.1.0 do not contain this checker, so 0.1.0 itself has to be installed with the setup file. Later versions can update from inside the app.

The updater signature uses a Tauri signing key. That is separate from Windows code signing, which is not set up. Only the public key is stored in the app. The private key and its password stay outside the repository.
