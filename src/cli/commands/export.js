import { exportArtifact } from '../../export/index.js'

/**
 * `kamishibai export <artifact> --to pdf|pptx [-o out]`
 *
 * @returns {Promise<{result: object, exitCode: number}>}
 */
export async function exportCommand(target, options = {}) {
  return await exportArtifact({ target, format: options.to, out: options.out })
}
