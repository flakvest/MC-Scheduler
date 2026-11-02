import { describe, expect, it } from 'vitest'
import { buildLatestManifest, updaterAssetName } from './updateManifest'

describe('updater manifest', () => {
  it('names the Windows setup without spaces', () => {
    expect(updaterAssetName('0.1.0')).toBe('MC-Scheduler_0.1.0_x64-setup.exe')
  })

  it('points the manifest at the GitHub release asset and trims the signature', () => {
    const manifest = buildLatestManifest({
      version: '0.1.0',
      notes: 'Back up before installing.',
      pubDate: '2026-11-02T16:00:00.000Z',
      signature: '  abcdef\n',
      tag: 'v0.1.0',
      repo: 'flakvest/MC-Scheduler',
    })

    expect(manifest).toEqual({
      version: '0.1.0',
      notes: 'Back up before installing.',
      pub_date: '2026-11-02T16:00:00.000Z',
      platforms: {
        'windows-x86_64': {
          signature: 'abcdef',
          url: 'https://github.com/flakvest/MC-Scheduler/releases/download/v0.1.0/MC-Scheduler_0.1.0_x64-setup.exe',
        },
      },
    })
  })
})
