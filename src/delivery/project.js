import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { CODES, EXIT, KsbError } from '../core/errors.js'

/**
 * Project resolution (SPEC §9.1). The order is contractual:
 *
 *   `--project` → `.kamishibai.toml` → git root → cwd
 *
 * The anchor file sits above git root in the order on purpose: a non-git
 * directory (or a sub-repo checked out inside another repo) still needs a
 * stable project identity, and running from a nested subdirectory must resolve
 * to the same project as running from its root.
 */

/** Verbatim CONTRACT constant — the project anchor file. */
export const ANCHOR_FILENAME = '.kamishibai.toml'
const GIT_MARKER = '.git'

/** Resolution layers, in contract order — exported so tests read the真源. */
export const RESOLUTION_ORDER = Object.freeze(['--project', ANCHOR_FILENAME, 'git-root', 'cwd'])

/**
 * Project names are validated in two tiers, because the two sources are not
 * the same kind of input (seal 補釘 F1):
 *
 * - What the user *typed* (`--project`) is rejected when illegal. Silently
 *   rewriting it would archive into a directory they never asked for.
 * - What we *derived* (anchor file / git root / cwd) is normalised. Nobody
 *   chooses to work in `~/Google Drive/My Project`, and S1 ran there fine —
 *   refusing to render because a parent folder has a space is our bug, not
 *   the user's.
 */
const INVALID_NAME = /[/\\\s]/

/** Substituted for any character that may not appear in a directory name. */
export const NAME_SEPARATOR = '-'
/** Last resort when normalisation leaves nothing usable. */
export const FALLBACK_PROJECT = 'unnamed-project'

const rejectName = (name, why) =>
  new KsbError({
    code: CODES.USAGE,
    message: `invalid project name "${name}": ${why}`,
    exitCode: EXIT.USAGE,
  })

/** Strict tier — for names the user supplied verbatim. */
export function assertProjectName(name) {
  const trimmed = String(name ?? '').trim()
  if (trimmed.length === 0) throw rejectName(name, 'must not be empty')
  if (trimmed === '.' || trimmed === '..' || trimmed.includes('..')) {
    throw rejectName(trimmed, 'must not contain path traversal')
  }
  if (INVALID_NAME.test(trimmed)) {
    throw rejectName(trimmed, 'must not contain path separators or whitespace')
  }
  return trimmed
}

/**
 * Lenient tier — deterministic normalisation for derived names.
 *
 * Deterministic is the whole point: the same directory must resolve to the
 * same project on every run, or a project's history silently splits in two.
 * The result is then put through the strict check, so normalisation can never
 * emit something the strict tier would have rejected.
 */
export function normaliseProjectName(name) {
  const normalised = String(name ?? '')
    .trim()
    // eslint-disable-next-line no-control-regex
    .replace(/[/\\\s\u0000-\u001f]+/g, NAME_SEPARATOR)
    .replace(/\.{2,}/g, NAME_SEPARATOR)
    .replace(new RegExp(`\\${NAME_SEPARATOR}{2,}`, 'g'), NAME_SEPARATOR)
    .replace(new RegExp(`^\\${NAME_SEPARATOR}+|\\${NAME_SEPARATOR}+$`, 'g'), '')

  if (normalised.length === 0 || normalised === '.') return FALLBACK_PROJECT
  return assertProjectName(normalised)
}

/** Walk from `start` up to the filesystem root, returning the first hit. */
const walkUp = (start, probe) => {
  let dir = resolve(start)
  for (;;) {
    const hit = probe(dir)
    if (hit !== null) return hit
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/**
 * Read the project name out of an anchor file. Only the `name = "…"` key is
 * consulted — S2 needs the anchor *read*, not a general TOML implementation
 * (the manifest parser lands with the template-authoring slice). An anchor
 * without a usable name still anchors: the directory holding it wins.
 */
const anchorName = (file) => {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch (cause) {
    throw new KsbError({
      code: CODES.ARTIFACT_UNREADABLE,
      message: `could not read project anchor ${file}: ${cause.message}`,
      exitCode: EXIT.VALIDATION,
    })
  }
  const match = /^\s*name\s*=\s*["']([^"'\n]+)["']/m.exec(text)
  return match ? match[1].trim() : basename(dirname(file))
}

const fromAnchor = (cwd) =>
  walkUp(cwd, (dir) => {
    const candidate = join(dir, ANCHOR_FILENAME)
    return existsSync(candidate) ? candidate : null
  })

const fromGitRoot = (cwd) => walkUp(cwd, (dir) => (existsSync(join(dir, GIT_MARKER)) ? dir : null))

/**
 * @param {{project?: string, cwd?: string}} input
 * @returns {{name: string, source: string}} resolved project and which layer won
 */
export function resolveProject({ project, cwd = process.cwd() } = {}) {
  if (project !== undefined && project !== null && String(project).length > 0) {
    return { name: assertProjectName(project), source: '--project' }
  }

  const anchor = fromAnchor(cwd)
  if (anchor !== null) {
    return { name: normaliseProjectName(anchorName(anchor)), source: ANCHOR_FILENAME }
  }

  const gitRoot = fromGitRoot(cwd)
  if (gitRoot !== null) return { name: normaliseProjectName(basename(gitRoot)), source: 'git-root' }

  return { name: normaliseProjectName(basename(resolve(cwd))), source: 'cwd' }
}
