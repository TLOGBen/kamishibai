import { CODES, EXIT, KsbError } from '../core/errors.js'

/**
 * PNG header reading, so `snapshot` reports the dimensions of the file it
 * actually wrote rather than the dimensions it asked for. A screenshot that
 * came back clipped, scaled or empty is exactly the failure a caller cannot see
 * in a JSON result — so the number is read out of the bytes.
 */

/** Verbatim PNG signature (RFC 2083 §3.1). */
export const PNG_MAGIC = Object.freeze([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const IHDR_OFFSET = 12
const WIDTH_OFFSET = 16
const HEIGHT_OFFSET = 20
const MIN_LENGTH = 24

const malformed = (detail) =>
  new KsbError({
    code: CODES.EXPORT_FAILED,
    message: `截圖不是合法的 PNG：${detail}`,
    exitCode: EXIT.VALIDATION,
  })

/** @returns {{width: number, height: number}} */
export function readPngSize(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < MIN_LENGTH) {
    throw malformed(`長度只有 ${buffer?.length ?? 0} bytes`)
  }
  for (const [index, byte] of PNG_MAGIC.entries()) {
    if (buffer[index] !== byte) throw malformed(`第 ${index} 個位元組不符 PNG 簽章`)
  }
  if (buffer.subarray(IHDR_OFFSET, IHDR_OFFSET + 4).toString('latin1') !== 'IHDR') {
    throw malformed('缺少 IHDR 區塊')
  }
  const width = buffer.readUInt32BE(WIDTH_OFFSET)
  const height = buffer.readUInt32BE(HEIGHT_OFFSET)
  if (width === 0 || height === 0) throw malformed(`尺寸為 ${width}×${height}`)
  return { width, height }
}
