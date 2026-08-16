import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * The single resolver for the central store root (CONTRACT B1).
 *
 * Every path that touches `~/.kamishibai` must come through here. Two callers
 * each doing their own `join(homedir(), …)` is how a test suite ends up writing
 * into the developer's real store: one of them will miss the override, and
 * nothing downstream can tell that it did.
 */

/** Verbatim CONTRACT constant. */
export const HOME_ENV = 'KAMISHIBAI_HOME'
/** Verbatim CONTRACT constant — default store root is `~/.kamishibai`. */
export const DEFAULT_HOME_DIRNAME = '.kamishibai'
/** Verbatim CONTRACT constant — 庫佈局 `artifacts/<專案名>/<slug>.html`. */
export const ARTIFACTS_DIRNAME = 'artifacts'
/** Verbatim CONTRACT constant — 標記檔名. */
export const MARKER_FILENAME = 'created-by'

/** Absolute store root: `KAMISHIBAI_HOME` wins, else `~/.kamishibai`. */
export function resolveHome(env = process.env) {
  const override = env?.[HOME_ENV]
  if (typeof override === 'string' && override.trim().length > 0) {
    return resolve(override.trim())
  }
  return join(homedir(), DEFAULT_HOME_DIRNAME)
}

/** `<HOME>/artifacts` */
export function artifactsRoot(env = process.env) {
  return join(resolveHome(env), ARTIFACTS_DIRNAME)
}

/** `<HOME>/artifacts/<project>` */
export function projectDir(project, env = process.env) {
  return join(artifactsRoot(env), project)
}

/** `<HOME>/created-by` */
export function markerPath(env = process.env) {
  return join(resolveHome(env), MARKER_FILENAME)
}
