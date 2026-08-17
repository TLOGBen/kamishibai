import { join } from 'node:path'
import { EXIT } from '../core/errors.js'
import { resolveProject } from '../delivery/project.js'
import { archiveArtifact } from '../delivery/store.js'
import { writeArtifact } from '../delivery/write.js'

/**
 * The delivery chain shared by `render` and `replay` (SPEC §8): one canonical
 * copy into the central store, one delivery copy at the caller's path, and the
 * copy's location recorded in the store index.
 *
 * The project is resolved *before* anything is written: a rejected `--project`
 * must not leave a half-delivered artifact behind.
 *
 * `slides` joins the result only for deck artifacts (CONTRACT C4): a document
 * artifact must keep the pinned four-key shape exactly, so an always-present
 * key set to 0 or null is not an option.
 *
 * @returns {{result: {ok: true, artifact: string, bytes: number, archived: string,
 *   slides?: number}, exitCode: number}}
 */
export function deliver({
  html,
  slides,
  slug,
  options = {},
  env = process.env,
  cwd = process.cwd(),
}) {
  const project = resolveProject({ project: options.project, cwd })

  const outPath = options.out ?? join('out', `${slug}.html`)
  const { path, bytes } = writeArtifact(outPath, html)

  const { path: archived } = archiveArtifact({
    project: project.name,
    slug,
    html,
    copies: [path],
    env,
  })

  const result = { ok: true, artifact: path, bytes, archived }
  return {
    result: Number.isInteger(slides) ? { ...result, slides } : result,
    exitCode: EXIT.OK,
  }
}
