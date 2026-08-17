import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { engineVersion } from '../core/version.js'
import { CODES, EXIT, KsbError } from '../core/errors.js'
import { writeFileAtomic } from './atomic.js'
import { MARKER_FILENAME, markerPath, projectDir, resolveHome } from './home.js'

/**
 * The central artifact store (SPEC §6.1 / §8). `render` and `replay` archive
 * the canonical copy here; `list`, `open` and future replay/re-skin flows read
 * from it. Nothing in this module reaches outside `resolveHome()`.
 */

export const ARTIFACT_EXT = '.html'
/** Sidecar recording where delivery copies of an artifact were written. */
export const COPIES_SUFFIX = '.copies.json'

const markerContent = () => `${MARKER_FILENAME}: kamishibai@${engineVersion()}\n`

const writeFailed = (path, cause) =>
  new KsbError({
    code: CODES.WRITE_FAILED,
    message: `could not write to central store at ${path}: ${cause.message}`,
    exitCode: EXIT.VALIDATION,
  })

/**
 * CONTRACT B2 — the first-touch safety gate.
 *
 * `~/.kamishibai` is a protected asset: a store that already exists belongs to
 * the user, so we only ever *add* to it. The marker is written exactly once, at
 * creation; back-filling it into an existing store would be a mutation of
 * someone else's directory, and would also lie about who created it.
 *
 * @returns {{root: string, created: boolean}}
 */
export function ensureStoreRoot(env = process.env) {
  const root = resolveHome(env)
  if (existsSync(root)) return { root, created: false }
  try {
    mkdirSync(root, { recursive: true })
    writeFileSync(markerPath(env), markerContent(), 'utf8')
  } catch (cause) {
    throw writeFailed(root, cause)
  }
  return { root, created: true }
}

/** Compact UTC stamp, e.g. `20260816T195453123Z`. */
export const archiveStamp = (now = new Date()) => now.toISOString().replace(/[-:.]/g, '')

/** How many suffixed names to try before admitting defeat. */
const MAX_NAME_ATTEMPTS = 1000

/** `<slug>`, then `<slug>-<stamp>`, then `<slug>-<stamp>-2`, `-3`, … */
function* candidateNames(slug, now) {
  yield slug
  const stamped = `${slug}-${archiveStamp(now)}`
  yield stamped
  for (let n = 2; n < MAX_NAME_ATTEMPTS; n += 1) yield `${stamped}-${n}`
}

/**
 * Write the canonical copy under the first name that is free (CONTRACT B2).
 *
 * The exclusive `wx` flag *is* the check: an `existsSync` test followed by a
 * default (truncating) write leaves a window in which two concurrent renders
 * of the same slug both see "free" and the second silently erases the first.
 * Artifacts in the central store are permanent records, so the filesystem —
 * not a prior lookup — has to be the one that says the name was taken.
 */
const writeExclusive = (dir, slug, html, now) => {
  for (const name of candidateNames(slug, now)) {
    const path = join(dir, `${name}${ARTIFACT_EXT}`)
    try {
      writeFileSync(path, html, { encoding: 'utf8', flag: 'wx' })
      return { name, path }
    } catch (cause) {
      if (cause.code !== 'EEXIST') throw writeFailed(path, cause)
    }
  }
  throw writeFailed(
    join(dir, slug),
    new Error(`no free artifact name after ${MAX_NAME_ATTEMPTS} attempts`),
  )
}

/**
 * Archive the canonical copy of a rendered artifact.
 *
 * @param {{project: string, slug: string, html: string, copies?: string[], env?: object}} input
 * @returns {{name: string, path: string, dir: string}}
 */
export function archiveArtifact({ project, slug, html, copies = [], env = process.env, now }) {
  ensureStoreRoot(env)
  const dir = projectDir(project, env)
  try {
    mkdirSync(dir, { recursive: true })
  } catch (cause) {
    throw writeFailed(dir, cause)
  }

  const { name, path } = writeExclusive(dir, slug, html, now)
  mergeCopiesIndex(dir, name, copies, path)
  return { name, path, dir }
}

/**
 * Record delivery copies against a claimed name, merging with whatever the
 * index already held (CONTRACT B2 — 已存在→不動既有檔案、僅追加).
 *
 * A name freed by a deleted artifact can be re-claimed by `wx`, and its sidecar
 * may outlive the artifact. Writing the new list flat would silently drop the
 * earlier delivery history — the index is a cumulative record, not a snapshot
 * of the last render. Overwriting is only permitted because the content written
 * is a superset of what was there.
 *
 * And because it *is* an overwrite, it goes through the atomic writer (D6): the
 * one legal truncation in the store must still be all-or-nothing, or a crash
 * mid-write turns a cumulative record into an empty one.
 */
const mergeCopiesIndex = (dir, name, copies, artifactPath) => {
  const merged = [...new Set([...readCopies(dir, name), ...copies])]
  try {
    writeFileAtomic(join(dir, `${name}${COPIES_SUFFIX}`), `${JSON.stringify(merged)}\n`)
  } catch (cause) {
    throw writeFailed(artifactPath, cause)
  }
}

const readCopies = (dir, name) => {
  const sidecar = join(dir, `${name}${COPIES_SUFFIX}`)
  if (!existsSync(sidecar)) return []
  try {
    const parsed = JSON.parse(readFileSync(sidecar, 'utf8'))
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : []
  } catch {
    // A corrupt sidecar must not hide the artifact itself: copies are an index,
    // the artifact is the record.
    return []
  }
}

/**
 * Raw store entries for a project, newest last. HTML is returned so callers can
 * read the embedded IR without this layer needing a parser.
 *
 * @returns {Array<{name: string, path: string, html: string, copies: string[], mtimeMs: number}>}
 */
export function readEntries({ project, env = process.env }) {
  const dir = projectDir(project, env)
  if (!existsSync(dir)) return []

  return readdirSync(dir)
    .filter((file) => file.endsWith(ARTIFACT_EXT))
    .map((file) => {
      const path = join(dir, file)
      const name = basename(file, ARTIFACT_EXT)
      return {
        name,
        path,
        html: readFileSync(path, 'utf8'),
        copies: readCopies(dir, name),
        mtimeMs: statSync(path).mtimeMs,
      }
    })
    .sort((a, b) => a.mtimeMs - b.mtimeMs || a.name.localeCompare(b.name))
}

/** Verbatim CONTRACT token — `open latest` resolves to the newest artifact. */
export const LATEST = 'latest'

/**
 * Resolve `<name|latest>` against a project's store.
 * @returns {{name: string, path: string}|null} null when nothing matches
 */
export function findArtifact({ project, name, env = process.env }) {
  const entries = readEntries({ project, env })
  if (entries.length === 0) return null
  if (name === LATEST) {
    const newest = entries[entries.length - 1]
    return { name: newest.name, path: newest.path }
  }
  const wanted = String(name ?? '').endsWith(ARTIFACT_EXT)
    ? basename(String(name), ARTIFACT_EXT)
    : String(name ?? '')
  const hit = entries.find((entry) => entry.name === wanted)
  return hit ? { name: hit.name, path: hit.path } : null
}
