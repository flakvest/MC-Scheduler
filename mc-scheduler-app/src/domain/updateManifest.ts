export type LatestManifest = {
  version: string
  notes: string
  pub_date: string
  platforms: {
    'windows-x86_64': {
      signature: string
      url: string
    }
  }
}

export function updaterAssetName(version: string) {
  return `MC-Scheduler_${version}_x64-setup.exe`
}

export function buildLatestManifest(input: {
  version: string
  notes: string
  pubDate: string
  signature: string
  tag: string
  repo: string
  assetName?: string
}): LatestManifest {
  const assetName = input.assetName ?? updaterAssetName(input.version)

  return {
    version: input.version,
    notes: input.notes,
    pub_date: input.pubDate,
    platforms: {
      'windows-x86_64': {
        signature: input.signature.trim(),
        url: `https://github.com/${input.repo}/releases/download/${input.tag}/${assetName}`,
      },
    },
  }
}
