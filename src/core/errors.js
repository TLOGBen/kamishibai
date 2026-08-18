/**
 * Error vocabulary. Every user-facing failure carries a KSB_ code and a block
 * path so Agents get machine-actionable feedback (SPEC §10.3).
 */

export const EXIT = Object.freeze({
  OK: 0,
  VALIDATION: 1,
  USAGE: 2,
})

export const CODES = Object.freeze({
  INPUT_NOT_FOUND: 'KSB_INPUT_NOT_FOUND',
  INPUT_EMPTY: 'KSB_INPUT_EMPTY',
  PARSE_FAILED: 'KSB_PARSE_FAILED',
  TEMPLATE_NOT_FOUND: 'KSB_TEMPLATE_NOT_FOUND',
  TEMPLATE_BLOCK_UNSUPPORTED: 'KSB_TEMPLATE_BLOCK_UNSUPPORTED',
  WRITE_FAILED: 'KSB_WRITE_FAILED',
  USAGE: 'KSB_USAGE',
  ARTIFACT_UNREADABLE: 'KSB_ARTIFACT_UNREADABLE',
  ARTIFACT_NOT_FOUND: 'KSB_ARTIFACT_NOT_FOUND',
  OPEN_FAILED: 'KSB_OPEN_FAILED',
  IR_MISSING: 'KSB_IR_MISSING',
  IR_DUPLICATE: 'KSB_IR_DUPLICATE',
  IR_UNPARSABLE: 'KSB_IR_UNPARSABLE',
  IR_SCHEMA: 'KSB_IR_SCHEMA',
  EXTERNAL_SCRIPT: 'KSB_EXTERNAL_SCRIPT',
  EXTERNAL_STYLESHEET: 'KSB_EXTERNAL_STYLESHEET',
  EXTERNAL_IMAGE: 'KSB_EXTERNAL_IMAGE',
  EXTERNAL_CSS_IMPORT: 'KSB_EXTERNAL_CSS_IMPORT',
  EXTERNAL_CSS_URL: 'KSB_EXTERNAL_CSS_URL',
  BANNED_FONT: 'KSB_BANNED_FONT',
  DIAGRAM_INVALID: 'KSB_DIAGRAM_INVALID',
  EXPORT_FORMAT_MISMATCH: 'KSB_EXPORT_FORMAT_MISMATCH',
  BROWSER_MISSING: 'KSB_BROWSER_MISSING',
  EXPORT_FAILED: 'KSB_EXPORT_FAILED',
  /** S5 — a comment anchored to a block the artifact's IR does not contain. */
  BLOCK_NOT_FOUND: 'KSB_BLOCK_NOT_FOUND',
  /** S5 — `comments resolve` naming a comment id no record carries. */
  COMMENT_NOT_FOUND: 'KSB_COMMENT_NOT_FOUND',
  /** S5 — the dev preview server could not be started (port taken, no handshake). */
  SERVE_START_FAILED: 'KSB_SERVE_START_FAILED',
  /** S5 — `--port` that is not a legal TCP port. */
  SERVE_PORT_INVALID: 'KSB_SERVE_PORT_INVALID',
  /** S5 — a recorded server could not be terminated. */
  SERVE_CLOSE_FAILED: 'KSB_SERVE_CLOSE_FAILED',
})

/** Root path token used when a finding cannot be tied to a single block. */
export const ROOT_PATH = '$'

export class KsbError extends Error {
  constructor({ code, message, path = ROOT_PATH, exitCode = EXIT.VALIDATION }) {
    super(message)
    this.name = 'KsbError'
    this.code = code
    this.path = path
    this.exitCode = exitCode
  }

  /** Serialisable finding, shape pinned by CONTRACT lint --json surface. */
  toFinding() {
    return { path: this.path, code: this.code, message: this.message }
  }
}

export function usageError(message, code = CODES.USAGE) {
  return new KsbError({ code, message, exitCode: EXIT.USAGE })
}

export function validationError(message, code, path = ROOT_PATH) {
  return new KsbError({ code, message, path, exitCode: EXIT.VALIDATION })
}
