import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildLatestManifest, updaterAssetName } from '../src/domain/updateManifest.ts'

const argument = (name: string) => {
  const index = process.argv.indexOf(name)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

const nsisDir = argument('--nsis-dir')
const stage = argument('--stage')
const repo = argument('--repo')
const tag = argument('--tag')
const notes = argument('--notes')
const version = argument('--version')
const files = readdirSync(nsisDir)
const exe = files.find((name) => name.endsWith('.exe'))
const signatureFile = files.find((name) => name.endsWith('.exe.sig'))

if (!exe || !signatureFile) {
  throw new Error(`No signed NSIS installer was found in ${nsisDir}.`)
}

const assetName = updaterAssetName(version)
const manifest = buildLatestManifest({
  version,
  notes,
  pubDate: new Date().toISOString(),
  signature: readFileSync(join(nsisDir, signatureFile), 'utf8'),
  tag,
  repo,
  assetName,
})

mkdirSync(stage, { recursive: true })
copyFileSync(join(nsisDir, exe), join(stage, assetName))
copyFileSync(join(nsisDir, signatureFile), join(stage, `${assetName}.sig`))
writeFileSync(join(stage, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
