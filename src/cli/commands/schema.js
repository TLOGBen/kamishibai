import { irSchema } from '../../core/schema.js'
import { EXIT } from '../../core/errors.js'

/**
 * `kamishibai schema` — emits the IR JSON Schema itself, so both the human and
 * the `--json` path show the same object.
 */
export function schemaCommand() {
  return { result: irSchema(), exitCode: EXIT.OK }
}
