import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { CODES, EXIT, KsbError } from '../core/errors.js'
import { writeFileAtomic } from './atomic.js'
import { templatePackageDir, templatesRoot } from './home.js'
import { parseToml, stringifyToml } from './toml.js'

/**
 * The template namespace inside the central store (CONTRACT E3, VC2).
 *
 * Until now a template was a JS module the engine happened to bundle. That is
 * enough to *render* with, and not enough to be a **package**: nothing on disk
 * said which templates this installation has, what versions they are, or what
 * they can draw. `templates/<namespace>/<name>/manifest.toml` is that record —
 * the probe surface an Agent (or a human, or the next slice's `init`/`import`)
 * can read without importing the engine.
 *
 * The manifest mirrors the JS manifest rather than replacing it: the module is
 * still the single source, and the TOML is a faithful projection of it, so the
 * two can be diffed field by field instead of drifting.
 */

/** Verbatim CONTRACT constant — the package descriptor's filename. */
export const MANIFEST_FILENAME = 'manifest.toml'

/**
 * Verbatim CONTRACT constant — manifest.toml keys, in output order.
 * Order is part of the byte-consistency claim, so it lives here, once.
 */
export const MANIFEST_KEYS = Object.freeze(['name', 'namespace', 'version', 'engine', 'root', 'blocks'])

/**
 * A template with no required root form carries the empty string, not a missing
 * key. TOML has no null, and an *absent* key would be indistinguishable from a
 * manifest written by an older engine that did not know about roots — so the
 * "no constraint" case is stated explicitly.
 */
export const NO_ROOT = ''

const writeFailed = (path, cause) =>
  new KsbError({
    code: CODES.WRITE_FAILED,
    message: `could not write template package at ${path}: ${cause.message}`,
    exitCode: EXIT.VALIDATION,
  })

/**
 * Project a JS template manifest onto the TOML table (CONTRACT E3).
 * @param {{namespace: string, name: string, version: string, root: string|null,
 *   blocks: readonly string[]}} manifest
 * @param {string} engine engine version this package was registered by
 */
export function manifestTable(manifest, engine) {
  return {
    name: manifest.name,
    namespace: manifest.namespace,
    version: manifest.version,
    engine,
    root: manifest.root ?? NO_ROOT,
    blocks: [...manifest.blocks],
  }
}

/**
 * Register (or refresh) one built-in template package.
 *
 * The write is skipped when the bytes already match: registration runs on every
 * render, and rewriting an identical file would churn mtimes inside a store
 * whose whole purpose is to be a stable record.
 *
 * @returns {{namespace: string, name: string, version: string, root: string,
 *   path: string, written: boolean}}
 */
export function registerTemplatePackage({ manifest, engine, env = process.env }) {
  const table = manifestTable(manifest, engine)
  const dir = templatePackageDir(manifest.namespace, manifest.name, env)
  const path = join(dir, MANIFEST_FILENAME)
  const text = stringifyToml(table)

  let written = false
  try {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== text) {
      mkdirSync(dir, { recursive: true })
      writeFileAtomic(path, text)
      written = true
    }
  } catch (cause) {
    throw writeFailed(path, cause)
  }

  return {
    namespace: table.namespace,
    name: table.name,
    version: table.version,
    root: table.root,
    path,
    written,
  }
}

const readPackage = (namespace, name, path) => {
  let table
  try {
    table = parseToml(readFileSync(path, 'utf8'))
  } catch {
    // An unreadable manifest is still a package on disk: dropping it silently
    // would make `templates` disagree with the filesystem, which is the one
    // thing this listing exists to prevent.
    return { namespace, name, version: '', root: NO_ROOT, path }
  }
  return {
    namespace: typeof table.namespace === 'string' ? table.namespace : namespace,
    name: typeof table.name === 'string' ? table.name : name,
    version: typeof table.version === 'string' ? table.version : '',
    root: typeof table.root === 'string' ? table.root : NO_ROOT,
    path,
  }
}

const subdirectories = (dir) => {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((entry) => statSync(join(dir, entry)).isDirectory())
    .sort()
}

/**
 * Every registered package, sorted by `<namespace>/<name>` so the listing is
 * deterministic regardless of directory-read order.
 *
 * @returns {Array<{namespace: string, name: string, version: string, root: string, path: string}>}
 */
export function readTemplatePackages(env = process.env) {
  const root = templatesRoot(env)
  const packages = []
  for (const namespace of subdirectories(root)) {
    for (const name of subdirectories(join(root, namespace))) {
      const path = join(root, namespace, name, MANIFEST_FILENAME)
      if (!existsSync(path)) continue
      packages.push(readPackage(namespace, name, path))
    }
  }
  return packages
}
