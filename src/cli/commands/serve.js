import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CODES, EXIT, KsbError, usageError } from '../../core/errors.js'
import { STDIN_SPEC } from '../../delivery/read.js'
import { resolveProject } from '../../delivery/project.js'
import { registerServe } from '../../delivery/run.js'
import { registerBuiltinTemplates } from '../registry.js'

/**
 * `kamishibai serve <input> [--port N]` (CONTRACT E1).
 *
 * The command starts a **detached** preview server and returns: the shell (and
 * the Agent driving it) gets its prompt back, and the server's existence is
 * recorded in the pidfile so `close` can end it later. The alternative — a
 * foreground process — makes `serve` unusable from an Agent loop and makes
 * "stop it" mean "find the terminal you started it in".
 *
 * Failure to *start* is reported synchronously, with the daemon's own KSB_
 * finding: printing a URL that nothing answers on would be the reassuring lie
 * this SDK keeps refusing to tell.
 */

const DAEMON = fileURLToPath(new URL('../../serve/daemon.js', import.meta.url))

/** How long to wait for the daemon to report a listening port. */
export const HANDSHAKE_TIMEOUT_MS = 20_000

/** `--port` arrives as a string; the boundary is where it stops being one. */
const parsePort = (value) => {
  if (value === undefined) return 0
  const text = String(value)
  if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 65535) {
    throw new KsbError({
      code: CODES.SERVE_PORT_INVALID,
      message: `--port 必須是 1–65535 的整數，收到 ${JSON.stringify(value)}`,
      exitCode: EXIT.USAGE,
    })
  }
  return Number(text)
}

const startFailed = (message) =>
  new KsbError({ code: CODES.SERVE_START_FAILED, message, exitCode: EXIT.VALIDATION })

/**
 * Spawn the daemon and wait for its one handshake line.
 *
 * stdout is a pipe only until the handshake lands; it is then destroyed and the
 * child unref'd, so the parent's event loop is free to exit while the server
 * keeps running. stderr is discarded for the same reason a detached process
 * must never hold a pipe nobody drains: it would eventually block on a full
 * buffer and the preview would freeze for no visible reason.
 */
const spawnDaemon = (args, env) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [DAEMON, ...args], {
      detached: true,
      stdio: ['ignore', 'pipe', 'ignore'],
      env,
    })

    let buffer = ''
    let settled = false

    const finish = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.stdout.removeAllListeners()
      child.removeAllListeners('error')
      child.removeAllListeners('exit')
      fn(value)
    }

    const timer = setTimeout(() => {
      try {
        child.kill('SIGTERM')
      } catch {
        // Already gone; nothing to stop.
      }
      finish(rejectPromise, startFailed(`daemon 在 ${HANDSHAKE_TIMEOUT_MS}ms 內沒有回報監聽位址`))
    }, HANDSHAKE_TIMEOUT_MS)

    child.on('error', (cause) => finish(rejectPromise, startFailed(`無法啟動 daemon：${cause.message}`)))

    // The give-up signal is the *stream* ending, not the process exiting. A
    // daemon that reports a failed start writes its finding and then exits, and
    // those two events race: keying off `exit` would sometimes discard the real
    // KSB_ diagnosis and report a generic "it died" instead. Stream order does
    // guarantee that every buffered byte is emitted before `close`.
    let exitCode = null
    child.on('exit', (code) => {
      exitCode = code
    })
    child.stdout.on('close', () =>
      finish(rejectPromise, startFailed(`daemon 在回報監聽位址前就結束了（exit ${exitCode}）`)),
    )

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      buffer += chunk
      const newline = buffer.indexOf('\n')
      if (newline === -1) return
      const line = buffer.slice(0, newline)
      let payload
      try {
        payload = JSON.parse(line)
      } catch (cause) {
        finish(rejectPromise, startFailed(`daemon 回報了無法解析的訊息：${cause.message}`))
        return
      }
      finish(resolvePromise, { child, payload })
    })
  })

/**
 * @returns {Promise<{result: object, exitCode: number}>}
 */
export async function serveCommand(inputSpec, options = {}, env = process.env, cwd = process.cwd()) {
  if (inputSpec === STDIN_SPEC) {
    throw usageError('serve 需要一個可監看的來源檔，stdin（`-`）無法監看')
  }
  const input = resolve(String(inputSpec))
  if (!existsSync(input)) {
    throw new KsbError({
      code: CODES.INPUT_NOT_FOUND,
      message: `input not found: ${inputSpec}`,
      exitCode: EXIT.USAGE,
    })
  }

  const port = parsePort(options.port)
  const project = resolveProject({ project: options.project, cwd })
  registerBuiltinTemplates(env)

  const args = ['--input', input, '--project', project.name, '--port', String(port)]
  if (options.template !== undefined) args.push('--template', options.template)
  if (options.generator !== undefined) args.push('--generator', options.generator)

  const { child, payload } = await spawnDaemon(args, env)

  if (payload?.ok !== true) {
    child.stdout.destroy()
    child.unref()
    return {
      result: { ok: false, errors: payload?.errors ?? [] },
      exitCode: payload?.exitCode ?? EXIT.VALIDATION,
    }
  }

  registerServe(
    {
      pid: payload.pid,
      port: payload.port,
      url: payload.url,
      input,
      artifact: payload.artifact,
      startedAt: new Date().toISOString(),
    },
    env,
  )

  child.stdout.destroy()
  child.unref()

  return {
    result: {
      ok: true,
      url: payload.url,
      pid: payload.pid,
      port: payload.port,
      artifact: payload.artifact,
    },
    exitCode: EXIT.OK,
  }
}
