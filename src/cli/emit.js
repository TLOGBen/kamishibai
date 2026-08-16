import { EXIT, KsbError, ROOT_PATH, CODES } from '../core/errors.js'
import { formatResult } from './format.js'

/** Write a command result to stdout in the requested shape and set the exit code. */
export function emit({ command, result, json, exitCode = EXIT.OK }) {
  const text = json ? JSON.stringify(result) : formatResult(command, result)
  process.stdout.write(text.endsWith('\n') ? text : `${text}\n`)
  process.exitCode = exitCode
}

/** Normalise any thrown value into the pinned failure result object. */
export function toFailure(error) {
  if (error instanceof KsbError) {
    return { result: { ok: false, errors: [error.toFinding()] }, exitCode: error.exitCode }
  }
  return {
    result: {
      ok: false,
      errors: [
        {
          path: ROOT_PATH,
          code: CODES.PARSE_FAILED,
          message: error?.message ?? String(error),
        },
      ],
    },
    exitCode: EXIT.VALIDATION,
  }
}
