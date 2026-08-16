import { CODES, EXIT, KsbError } from '../../core/errors.js'
import { resolveProject } from '../../delivery/project.js'
import { findArtifact, LATEST } from '../../delivery/store.js'
import { openPath } from '../../delivery/open.js'

/**
 * `kamishibai open <name|latest> [--dry-run]`
 *
 * Resolves a name against the current project's central store and hands it to
 * the single cross-platform opener (SPEC §8). `--dry-run` resolves only —
 * the pinned surface is the absolute path, so an Agent can use `open` as a
 * lookup without ever spawning a browser.
 *
 * @returns {{result: {ok: true, path: string}, exitCode: number}}
 */
export function openCommand(nameSpec = LATEST, options = {}, env = process.env, cwd = process.cwd()) {
  const project = resolveProject({ project: options.project, cwd })
  const found = findArtifact({ project: project.name, name: nameSpec, env })

  if (found === null) {
    throw new KsbError({
      code: CODES.ARTIFACT_NOT_FOUND,
      message: `no artifact "${nameSpec}" in project "${project.name}"`,
      exitCode: EXIT.VALIDATION,
    })
  }

  if (options.dryRun !== true) openPath(found.path)

  return { result: { ok: true, path: found.path }, exitCode: EXIT.OK }
}
