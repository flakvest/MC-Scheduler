export type UpdateBackupDecision = {
  backupPath: string | null
  skipConfirmed: boolean
}

export function isDesktopApp(target: object = globalThis) {
  return Boolean((target as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
}

export function mayInstallUpdate(decision: UpdateBackupDecision) {
  return Boolean(decision.backupPath) || decision.skipConfirmed
}

export function fullBackupFilename(now = new Date()) {
  return `mc-scheduler-full-backup-${now.toISOString().slice(0, 10)}.json`
}

export function describeBackupLocation(saved: string, filename: string) {
  if (saved.includes('/') || saved.includes('\\')) {
    return `Full backup saved to ${saved}.`
  }

  return `Full backup downloaded as ${filename}.`
}

export type DesktopUpdate = {
  version: string
  notes: string
  downloadAndInstall: (onProgress?: (message: string) => void) => Promise<void>
  relaunch: () => Promise<void>
}

export async function lookForUpdate(): Promise<DesktopUpdate | null> {
  if (!isDesktopApp()) return null

  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check()
  if (!update) return null

  return {
    version: update.version,
    notes: update.body ?? '',
    downloadAndInstall: async (onProgress) => {
      let downloaded = 0
      let total = 0
      await update.downloadAndInstall((event) => {
        if (!onProgress) return
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0
          onProgress('Downloading update...')
          return
        }
        if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          onProgress(total ? `Downloading update... ${Math.min(100, Math.round((downloaded / total) * 100))}%` : 'Downloading update...')
          return
        }
        onProgress('Download finished. Installing...')
      })
    },
    relaunch: async () => {
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    },
  }
}
