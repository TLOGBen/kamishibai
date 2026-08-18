import { CODES, EXIT, KsbError } from '../../core/errors.js'
import { clearServeRecords, isAlive, readServeRecords } from '../../delivery/run.js'

/**
 * `kamishibai close` (CONTRACT E1).
 *
 * Idempotent by construction: "there is no server running" is a *success*, not
 * an error. The command answers one question — "is anything this SDK started
 * still running?" — and the only honest post-condition is "no". A `close` that
 * failed when the server was already gone would train every caller to ignore
 * its exit code, which is how the orphan-daemon trap (G2) reopens.
 *
 * Every recorded server is signalled, not just the newest: an orphan is by
 * definition the one nobody remembers, so `close` must not depend on being told
 * which process to stop.
 *
 * @returns {{result: {ok: true, closed: number[], stale: number[]}, exitCode: number}}
 */
export function closeCommand(options = {}, env = process.env) {
  const records = readServeRecords(env)
  const closed = []
  const stale = []
  const failures = []

  for (const record of records) {
    if (!isAlive(record.pid)) {
      stale.push(record.pid)
      continue
    }
    try {
      process.kill(record.pid, 'SIGTERM')
      closed.push(record.pid)
    } catch (cause) {
      failures.push(`${record.pid}（${cause.message}）`)
    }
  }

  if (failures.length > 0) {
    // The pidfile is deliberately left intact: a server we could not stop is
    // still running, and forgetting it would make the next `close` claim there
    // was nothing to do.
    throw new KsbError({
      code: CODES.SERVE_CLOSE_FAILED,
      message: `無法終止 serve 程序：${failures.join('、')}`,
      exitCode: EXIT.VALIDATION,
    })
  }

  clearServeRecords(env)
  return { result: { ok: true, closed, stale }, exitCode: EXIT.OK }
}
