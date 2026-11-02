# Windows installer

The desktop app is the Tauri project in `mc-scheduler-app`. Its bundle target is NSIS. A local Windows build uses the same command that produced earlier installers:

```text
npm run tauri -- build
```

Run that from `mc-scheduler-app` on Windows, after Node.js and Rust are installed. The setup file is written to:

```text
mc-scheduler-app/src-tauri/target/release/bundle/nsis/MC Scheduler_<version>_x64-setup.exe
```

There is no separate release workflow in the history of this repo. GitHub Actions workflow `.github/workflows/release-windows.yml` runs that same build on `windows-latest`.

- Pushing a tag such as `v0.0.9` starts the build and publishes the setup on that GitHub release.
- The workflow can also be started by hand. It asks for the release tag.

The version in the setup comes from `mc-scheduler-app/src-tauri/tauri.conf.json`. Keep that value, `package.json`, and `src-tauri/Cargo.toml` on the same number. The tag should be `v` plus that number.

The published setup is not code-signed. Windows SmartScreen can warn before it is signed. Signing requires Shaun's own certificate; this repository does not store one.
