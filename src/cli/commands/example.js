import { exampleFor, EXAMPLE_KINDS } from '../../core/example.js'
import { CODES, EXIT, KsbError } from '../../core/errors.js'

/**
 * `kamishibai example [doc|<block>]` — the anti-trial-and-error channel.
 * Human output is the example verbatim, so it can be piped straight into
 * `render -`.
 */
export function exampleCommand(kind = 'doc') {
  const found = exampleFor(kind)
  if (found === null) {
    throw new KsbError({
      code: CODES.USAGE,
      message: `unknown example kind "${kind}"; available: ${EXAMPLE_KINDS.join(', ')}`,
      exitCode: EXIT.USAGE,
    })
  }
  return {
    result: { ok: true, kind: found.kind, example: found.example },
    exitCode: EXIT.OK,
  }
}
