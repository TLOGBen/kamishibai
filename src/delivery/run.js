import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { CODES, EXIT, KsbError } from '../core/errors.js'
import { writeFileAtomic } from './atomic.js'
import { runDir, servePidfile } from './home.js'

/**
 * The serve pidfile (CONTRACT E1 — `run/serve.pid` under the store root, whose
 * one resolver is `./home.js`; the env-var name is spelled only there).
 *
 * G2's promoted trap is the reason this file exists at all: a dev server that
 * outlives its session is invisible — it holds a port, keeps re-rendering, and
 * nothing on screen says so. `close` can only be honest about "everything this
 * SDK started is now stopped" if starting one *records* it.
 *
 * The file holds a JSON **array** of records, not a bare pid, for two reasons:
 * `close` must be able to stop every server this SDK started rather than only
 * the most recent one (the orphan case is precisely the one that hides), and a
 * recycled pid must be distinguishable from the process we meant — the record
 * carries the port and start time so a stale entry can be recognised instead of
 * blindly signalled.
 *
 * `run/` is ephemeral state, never a record: unlike `artifacts/`, deleting it
 * loses nothing but the ability to stop a process that is already gone.
 */

const runFailed = (path, cause) =>
  new KsbError({
    code: CODES.WRITE_FAILED,
    message: `could not update the serve pidfile at ${path}: ${cause.message}`,
    exitCode: EXIT.VALIDATION,
  })

/** Is this pid a live process? Signal 0 tests existence without delivering one. */
export function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (cause) {
    // EPERM means the process exists but belongs to someone else — still alive.
    return cause?.code === 'EPERM'
  }
}

const isRecord = (value) =>
  value !== null && typeof value === 'object' && Number.isInteger(value.pid) && value.pid > 0

/**
 * Every recorded server, in start order. A corrupt pidfile yields an empty list
 * rather than throwing: `close` must stay usable exactly when state is broken.
 *
 * @returns {Array<{pid: number, port: number, url: string, input: string, startedAt: string}>}
 */
export function readServeRecords(env = process.env) {
  const path = servePidfile(env)
  if (!existsSync(path)) return []
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return Array.isArray(parsed) ? parsed.filter(isRecord) : []
  } catch {
    return []
  }
}

const writeRecords = (records, env) => {
  const path = servePidfile(env)
  try {
    if (records.length === 0) {
      rmSync(path, { force: true })
      return records
    }
    mkdirSync(runDir(env), { recursive: true })
    writeFileAtomic(path, `${JSON.stringify(records, null, 2)}\n`)
  } catch (cause) {
    throw runFailed(path, cause)
  }
  return records
}

/**
 * Record a newly started server, dropping entries whose process is gone.
 *
 * Pruning on write rather than on read is deliberate: the pidfile is the thing
 * `close` reads, and a file that accumulates dead pids would make `close`
 * report work it did not do.
 */
export function registerServe(record, env = process.env) {
  const live = readServeRecords(env).filter((entry) => isAlive(entry.pid))
  return writeRecords([...live, record], env)
}

/** Forget every record (used after `close` has signalled them). */
export function clearServeRecords(env = process.env) {
  return writeRecords([], env)
}
