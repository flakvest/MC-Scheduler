import { describe, expect, it } from 'vitest'
import {
  describeBackupLocation,
  fullBackupFilename,
  isDesktopApp,
  lookForUpdate,
  mayInstallUpdate,
} from './appUpdates'

describe('in-app updates', () => {
  it('installs only after a full backup or an explicit skip', () => {
    expect(mayInstallUpdate({ backupPath: null, skipConfirmed: false })).toBe(false)
    expect(mayInstallUpdate({ backupPath: 'C:\\Backups\\mc-scheduler-full-backup.json', skipConfirmed: false })).toBe(true)
    expect(mayInstallUpdate({ backupPath: null, skipConfirmed: true })).toBe(true)
  })

  it('describes a desktop save path and a browser download differently', () => {
    expect(describeBackupLocation('C:\\Users\\Shaun\\mc-scheduler-full-backup-2026-11-02.json', 'mc-scheduler-full-backup-2026-11-02.json'))
      .toBe('Full backup saved to C:\\Users\\Shaun\\mc-scheduler-full-backup-2026-11-02.json.')
    expect(describeBackupLocation('/home/shaun/mc-scheduler-full-backup-2026-11-02.json', 'ignored.json'))
      .toBe('Full backup saved to /home/shaun/mc-scheduler-full-backup-2026-11-02.json.')
    expect(describeBackupLocation('mc-scheduler-full-backup-2026-11-02.json', 'mc-scheduler-full-backup-2026-11-02.json'))
      .toBe('Full backup downloaded as mc-scheduler-full-backup-2026-11-02.json.')
  })

  it('names the full backup with the calendar date', () => {
    expect(fullBackupFilename(new Date('2026-11-02T23:30:00.000Z'))).toBe('mc-scheduler-full-backup-2026-11-02.json')
  })

  it('does not check GitHub outside the desktop app', async () => {
    expect(isDesktopApp({})).toBe(false)
    expect(isDesktopApp({ __TAURI_INTERNALS__: {} })).toBe(true)
    await expect(lookForUpdate()).resolves.toBeNull()
  })
})
