# MC-Scheduler Repository Instructions

- This app is for MARS Message Center scheduling. Any Army MARS region can define its own positions.
- Do not rename saved position codes without a migration that keeps existing assignments.
- ALE duty positions require an ALE-qualified operator. The position code is not what decides that.
- Do not change the app id `com.marsmessagecenter.scheduler` or the data folder it selects.
- Backups must stay readable by the current app, including version 1 files from 0.0.8 through 0.1.0.
- Keep the single-file prototype until splitting it is approved.
