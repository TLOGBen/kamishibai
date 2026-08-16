import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PKG_PATH = fileURLToPath(new URL('../../package.json', import.meta.url))

let cached = null

/** Engine (SDK) version, read once from the package manifest. */
export function engineVersion() {
  if (cached === null) {
    const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8'))
    if (typeof pkg.version !== 'string' || pkg.version.length === 0) {
      throw new Error('package.json is missing a version field')
    }
    cached = pkg.version
  }
  return cached
}
