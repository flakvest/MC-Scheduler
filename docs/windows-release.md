# Windows installer and in-app updates

The desktop app is the Tauri project in `mc-scheduler-app`. Its bundle target is NSIS. A local Windows build uses:

```text
npm run tauri -- build
```

Run that from `mc-scheduler-app` on Windows, with Node.js and Rust 1.90 or newer. The setup file is written to:

```text
mc-scheduler-app/src-tauri/target/release/bundle/nsis/
```

GitHub Actions workflow `.github/workflows/release-windows.yml` runs that same build on `windows-latest` and publishes the result.

- Pushing a tag such as `v0.1.0` starts the build.
- The workflow can also be started by hand. It asks for the release tag.

The version comes from `mc-scheduler-app/src-tauri/tauri.conf.json`. Keep that value, `package.json`, and `src-tauri/Cargo.toml` on the same number. The tag should be `v` plus that number.

## What the release contains

The workflow signs the installer for the in-app updater, then publishes three files:

- `MC-Scheduler_<version>_x64-setup.exe` for a manual install
- the matching `.sig` signature
- `latest.json`, which the installed app reads from the latest GitHub release

The app looks for updates at:

```text
https://github.com/flakvest/MC-Scheduler/releases/latest/download/latest.json
```

## Signing secrets

The updater key is not a Windows code-signing certificate. Windows SmartScreen can still warn until that separate certificate is added later.

The release workflow will stop before building unless these repository secrets exist:

- `TAURI_SIGNING_PRIVATE_KEY`: the contents of the minisign private key file
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the password for that key. A trailing newline from pasting the password file is removed before signing.

Add them under the GitHub repository **Settings → Secrets and variables → Actions**. Do not commit either value. The matching public key is already in `src-tauri/tauri.conf.json`.

A local signed build needs the same values in the environment. Tauri does not read them from a `.env` file:

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

## First updater install

Installed copies of 0.0.9 and earlier do not check for updates. Install 0.1.0, or whichever version first includes the updater, with the setup file. After that, later releases can be installed from the update dialog.
