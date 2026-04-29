# Tauri Readiness Assessment (Windows Desktop Target)

## Current Readiness
- The project already has a React app (`mc-scheduler-app`), which is a valid front-end starting point for a Tauri desktop app.
- The app's purpose and workflow are already defined, so desktop packaging can focus on delivery and reliability rather than redesign.
- Backup behavior matters for this project, and there is a clear requirement to keep backups JSON-compatible with older versions. That is good because it sets a strict compatibility rule before packaging.

## What Is Missing Before Tauri Packaging
- **Rust/Cargo prerequisite is not met yet.** Tauri needs Rust and Cargo installed and working on the Windows machine.
- A Tauri shell has not been initialized yet.
- Desktop-specific validation is still needed for file access, backup/restore, and update behavior in a local Windows environment.

## Local File and Storage Considerations
- Desktop apps run on local machines, so file paths, permissions, and user profile locations become important.
- Decide and document where backup JSON files should be saved by default on Windows, such as a user-writable app data folder.
- Keep backup files as plain JSON with backward compatibility rules unchanged, so older backups continue to restore correctly.
- Validate how the app behaves if a file is missing, locked, read-only, or corrupted.

## Areas to Test Before Packaging
- Backup export/import using existing and older JSON backups.
- Data integrity after save/reload cycles, with no field loss and no silent format changes.
- Windows path handling, including spaces, long paths, user folders, and OneDrive-synced folders.
- Offline behavior with no dependency on a running web server.
- Installer/uninstaller behavior and whether user data is preserved or removed as intended.
- Basic security checks for desktop context, including no sensitive data written to logs and no unsafe file write locations.

## Safest Next Steps
1. Confirm Rust and Cargo installation on the Windows build machine.
2. Freeze backup JSON schema expectations and create a small compatibility test set with old and current backup files.
3. Run a desktop-focused test pass on storage/file handling and backup restore reliability.
4. After the above is clean, initialize Tauri in a separate step and package for Windows.

## Recommendation
The project is **partially ready**: front-end foundation exists, but Tauri packaging should wait until Rust/Cargo is installed and desktop file/backup compatibility testing is completed. This is the lowest-risk path for a Windows desktop rollout.
