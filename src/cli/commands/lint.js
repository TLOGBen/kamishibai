import { readArtifact } from '../../delivery/read.js'
import { extractIrPayloads } from '../../parser/artifact.js'
import { lintArtifact } from '../../core/lint.js'
import { EXIT } from '../../core/errors.js'

/**
 * `kamishibai lint <artifact>`
 * @returns {{result: object, exitCode: number}}
 */
export function lintCommand(target) {
  const { html, path } = readArtifact(target)
  const errors = lintArtifact({ html, irPayloads: extractIrPayloads(html) })

  if (errors.length > 0) {
    return { result: { ok: false, errors }, exitCode: EXIT.VALIDATION }
  }
  return { result: { ok: true, artifact: path, errors: [] }, exitCode: EXIT.OK }
}
