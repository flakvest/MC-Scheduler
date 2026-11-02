# MC-Scheduler Repository Instructions

- This app is for MARS Message Center scheduling. Any Army MARS region can define its own positions.
- Do not rename saved position codes without a migration that keeps existing assignments.
- ALE duty positions require an ALE-qualified operator. The position code is not what decides that.
- Back-to-back policy, the week start day, and the shift limits belong to the region. Each position is scheduled daily or for a whole week. Defaults are daily seats, avoid back-to-back, weeks starting Monday, 5 shifts per month, and 2 daily shifts per rolling week. `0` means no limit. Migrated files keep that behavior. Each coverage day of a weekly seat counts toward the monthly maximum.
- The first save after a pre-v2 file is opened keeps `premigration-v1.json` in the backups folder. That file is not part of the 5-save rotation.
- Do not change the app id `com.marsmessagecenter.scheduler` or the data folder it selects.
- Backups must stay readable by the current app, including version 1 files from 0.0.8 through 0.1.0.
- Keep the single-file prototype until splitting it is approved.
