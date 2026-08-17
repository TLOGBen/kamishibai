import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { CODES, EXIT, KsbError } from '../core/errors.js'

const write = (outPath, data, encoding) => {
  const absolute = resolve(outPath)
  try {
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, data, encoding === undefined ? undefined : encoding)
  } catch (cause) {
    throw new KsbError({
      code: CODES.WRITE_FAILED,
      message: `could not write artifact to ${absolute}: ${cause.message}`,
      exitCode: EXIT.VALIDATION,
    })
  }
  return absolute
}

/**
 * Write an artifact to disk, creating parent directories as needed.
 * @returns {{path: string, bytes: number}} absolute path and byte length
 */
export function writeArtifact(outPath, html) {
  return { path: write(outPath, html, 'utf8'), bytes: Buffer.byteLength(html, 'utf8') }
}

/**
 * Write a binary deliverable (PDF / PPTX / PNG) through the same single writer,
 * so the export chain cannot invent its own error code for a failed write.
 * @returns {{path: string, bytes: number}}
 */
export function writeBytes(outPath, buffer) {
  return { path: write(outPath, buffer), bytes: buffer.length }
}
