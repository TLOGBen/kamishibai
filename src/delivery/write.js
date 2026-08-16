import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { CODES, EXIT, KsbError } from '../core/errors.js'

/**
 * Write an artifact to disk, creating parent directories as needed.
 * @returns {{path: string, bytes: number}} absolute path and byte length
 */
export function writeArtifact(outPath, html) {
  const absolute = resolve(outPath)
  try {
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, html, 'utf8')
  } catch (cause) {
    throw new KsbError({
      code: CODES.WRITE_FAILED,
      message: `could not write artifact to ${absolute}: ${cause.message}`,
      exitCode: EXIT.VALIDATION,
    })
  }
  return { path: absolute, bytes: Buffer.byteLength(html, 'utf8') }
}
