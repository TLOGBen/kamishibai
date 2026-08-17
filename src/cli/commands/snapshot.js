import { usageError } from '../../core/errors.js'
import { snapshotArtifact } from '../../export/index.js'

/**
 * `--slide` arrives as a string from the command line. It is parsed here, at
 * the boundary, so the export layer only ever sees an integer or nothing —
 * `--slide abc` must be a usage error, not a `NaN` that quietly snapshots
 * whatever `handles[NaN - 1]` happens to be.
 */
const parseSlide = (value) => {
  if (value === undefined) return undefined
  if (!/^[1-9]\d*$/.test(String(value))) {
    throw usageError(`--slide 必須是正整數，收到 ${JSON.stringify(value)}`)
  }
  return Number(value)
}

/**
 * `kamishibai snapshot <artifact> [-o out.png] [--slide N]`
 *
 * @returns {Promise<{result: object, exitCode: number}>}
 */
export async function snapshotCommand(target, options = {}) {
  return await snapshotArtifact({
    target,
    out: options.out,
    slide: parseSlide(options.slide),
  })
}
