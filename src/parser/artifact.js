import { CODES, EXIT, KsbError } from '../core/errors.js'
import { IR_SCRIPT_TYPE } from '../core/ir.js'

const SCRIPT_SOURCE = `<script[^>]*type\\s*=\\s*["']${IR_SCRIPT_TYPE.replace('+', '\\+')}["'][^>]*>([\\s\\S]*?)<\\/script>`

/** Raw payloads of every embedded IR script found in an artifact. */
export function extractIrPayloads(html) {
  const re = new RegExp(SCRIPT_SOURCE, 'gi')
  const payloads = []
  let m
  while ((m = re.exec(html)) !== null) payloads.push(m[1])
  return payloads
}

const irError = (code, message) => new KsbError({ code, message, exitCode: EXIT.VALIDATION })

/**
 * Recover the single IR envelope an artifact carries, or fail with a pinned code.
 *
 * Shared by `replay` and by the export chain: both have to answer "what is this
 * artifact, really?" from the embedded record rather than from its markup, and
 * two copies of these three failure codes would eventually disagree about what
 * a malformed artifact is called.
 */
export function readEmbeddedIr(html, path) {
  const payloads = extractIrPayloads(html)
  if (payloads.length === 0) {
    throw irError(CODES.IR_MISSING, `no embedded IR found in ${path}; nothing to replay`)
  }
  if (payloads.length > 1) {
    throw irError(CODES.IR_DUPLICATE, `${path} carries ${payloads.length} IR payloads, expected 1`)
  }
  try {
    return JSON.parse(payloads[0])
  } catch (cause) {
    throw irError(CODES.IR_UNPARSABLE, `embedded IR in ${path} is not valid JSON: ${cause.message}`)
  }
}
