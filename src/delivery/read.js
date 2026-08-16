import { existsSync, readFileSync, readSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'
import { CODES, EXIT, KsbError } from '../core/errors.js'

export const STDIN_SPEC = '-'

const CHUNK_SIZE = 65536
/** Per-stall budget: MAX_EAGAIN_RETRIES × RETRY_PAUSE_MS ≈ 10s of writer silence. */
const MAX_EAGAIN_RETRIES = 5000
const RETRY_PAUSE_MS = 2

/** Block the thread briefly without spinning the CPU. */
const pause = (ms) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Read stdin synchronously. A shell pipe hands us a non-blocking fd, so EAGAIN
 * simply means "the writer has not produced data yet" and must be retried —
 * `readFileSync(0)` gives up on it and breaks `example doc | render -`.
 *
 * The retry budget is per stall, not per read: it resets whenever bytes arrive,
 * so a slow writer that pauses repeatedly (an upstream agent streaming Markdown,
 * say) is only cut off after a genuine ~10s silence rather than accumulating
 * earlier waits until an arbitrary cap truncates a still-live stream.
 */
const readStdin = () => {
  const buffer = Buffer.alloc(CHUNK_SIZE)
  const chunks = []
  let retries = 0

  for (;;) {
    let read
    try {
      read = readSync(0, buffer, 0, CHUNK_SIZE, null)
    } catch (cause) {
      if (cause.code === 'EOF') break
      if (cause.code === 'EAGAIN' && retries < MAX_EAGAIN_RETRIES) {
        retries += 1
        pause(RETRY_PAUSE_MS)
        continue
      }
      throw new KsbError({
        code: CODES.INPUT_EMPTY,
        message: `could not read stdin: ${cause.message}`,
        exitCode: EXIT.USAGE,
      })
    }
    if (read === 0) break
    retries = 0
    chunks.push(Buffer.from(buffer.subarray(0, read)))
  }

  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Read a source document from a path or from stdin (`-`).
 * @returns {{source: string, origin: string, format: 'markdown'|'json', slug: string}}
 */
export function readSource(spec) {
  if (spec === STDIN_SPEC) {
    const source = readStdin()
    return { source, origin: 'stdin', format: sniffFormat(source, ''), slug: 'document' }
  }

  const absolute = resolve(spec)
  if (!existsSync(absolute)) {
    throw new KsbError({
      code: CODES.INPUT_NOT_FOUND,
      message: `input not found: ${spec}`,
      exitCode: EXIT.USAGE,
    })
  }
  const source = readFileSync(absolute, 'utf8')
  const ext = extname(absolute)
  return {
    source,
    origin: absolute,
    format: sniffFormat(source, ext),
    slug: basename(absolute, ext) || 'document',
  }
}

/** Read an existing artifact (or any text file) for inspection. */
export function readArtifact(spec) {
  const absolute = resolve(spec)
  if (!existsSync(absolute)) {
    throw new KsbError({
      code: CODES.INPUT_NOT_FOUND,
      message: `artifact not found: ${spec}`,
      exitCode: EXIT.USAGE,
    })
  }
  try {
    return { html: readFileSync(absolute, 'utf8'), path: absolute }
  } catch (cause) {
    throw new KsbError({
      code: CODES.ARTIFACT_UNREADABLE,
      message: `could not read artifact ${spec}: ${cause.message}`,
      exitCode: EXIT.VALIDATION,
    })
  }
}

function sniffFormat(source, ext) {
  if (ext === '.json') return 'json'
  return source.trimStart().startsWith('{') ? 'json' : 'markdown'
}
