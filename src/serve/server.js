import { createServer } from 'node:http'
import { watch } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { CODES, EXIT, KsbError, ROOT_PATH } from '../core/errors.js'
import { collectBlockIds } from '../core/blocks.js'
import { appendComment, listComments } from '../delivery/comments.js'
import { COMMENTS_PATH, ERROR_EVENT, EVENTS_PATH, READY_EVENT, RELOAD_EVENT } from './protocol.js'
import { injectDevRuntime } from './overlay.js'

/**
 * The dev preview server (CONTRACT E1/E2, SPEC §10.2 watch 模式).
 *
 * Deliberately node's own `http` module and nothing else. P3 settled the scope:
 * v0.1 `serve` is file-watch plus a reload push, not Vite HMR — the need is
 * "stop pressing refresh", and a bundler integration would drag a second build
 * pipeline into an SDK whose entire promise is one deterministic renderer. The
 * page the browser gets is the *same bytes* `render` writes, plus an injected
 * dev runtime; there is no second rendering path to disagree with the first.
 *
 * Nothing here writes outside the caller-provided artifact path (which the CLI
 * places inside the central store) and that artifact's comment sidecar.
 */

/** Loopback only. A preview of unpublished work is not a thing to expose. */
export const SERVE_HOST = '127.0.0.1'

/**
 * Coalescing window for filesystem events. Editors save by writing, truncating
 * and renaming, so one human save arrives as a burst; re-rendering per event
 * would push several reloads for one keystroke.
 */
const WATCH_DEBOUNCE_MS = 60

const JSON_HEADERS = Object.freeze({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
})

const failure = (error) => ({
  ok: false,
  errors: [
    error instanceof KsbError
      ? error.toFinding()
      : { path: ROOT_PATH, code: CODES.PARSE_FAILED, message: error?.message ?? String(error) },
  ],
})

const sendJson = (res, status, payload) => {
  res.writeHead(status, JSON_HEADERS)
  res.end(JSON.stringify(payload))
}

/** Body reader with a hard cap: a preview server must not be a memory sink. */
const MAX_BODY_BYTES = 64 * 1024

const readBody = (req) =>
  new Promise((resolvePromise, rejectPromise) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        rejectPromise(
          new KsbError({
            code: CODES.INPUT_EMPTY,
            message: `request body exceeds ${MAX_BODY_BYTES} bytes`,
            exitCode: EXIT.VALIDATION,
          }),
        )
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('error', rejectPromise)
    req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')))
  })

/**
 * Start the preview server.
 *
 * @param {{compile: () => Promise<{html: string, ir: object}>, initial?: object,
 *   sourcePath: string, artifactPath: string, port?: number, host?: string}} input
 *   `compile` is injected rather than imported so the server owns no opinion
 *   about parsing — and so tests can drive the reload path without a renderer.
 *   `initial` lets the caller hand over a render it already performed, so the
 *   bytes it archived and the bytes it serves are the same object rather than
 *   two renders that merely ought to agree.
 *   `persist` receives every later successful render *before* it goes live, so
 *   the caller can keep the canonical copy in step (CONTRACT E1's living
 *   document). Injected rather than imported: this layer must not know that a
 *   central store exists.
 * @returns {Promise<{url: string, port: number, close: () => Promise<void>}>}
 */
export async function startServer({
  compile,
  initial,
  persist,
  sourcePath,
  artifactPath,
  port = 0,
  host = SERVE_HOST,
}) {
  const source = resolve(sourcePath)
  let current = initial ?? (await compile())

  /** Open SSE responses. Held so shutdown can end them instead of hanging. */
  const clients = new Set()

  const broadcast = (event, data) => {
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    for (const client of clients) {
      try {
        client.write(frame)
      } catch {
        clients.delete(client)
      }
    }
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((error) => {
      if (!res.headersSent) sendJson(res, 500, failure(error))
      else res.end()
    })
  })

  async function handle(req, res) {
    const url = new URL(req.url ?? '/', `http://${host}`)

    if (url.pathname === EVENTS_PATH) {
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      })
      res.write(`event: ${READY_EVENT}\ndata: ${JSON.stringify({ ok: true })}\n\n`)
      clients.add(res)
      req.on('close', () => clients.delete(res))
      return
    }

    if (url.pathname === COMMENTS_PATH && req.method === 'GET') {
      sendJson(res, 200, listComments(artifactPath))
      return
    }

    if (url.pathname === COMMENTS_PATH && req.method === 'POST') {
      const raw = await readBody(req)
      let body
      try {
        body = JSON.parse(raw)
      } catch (cause) {
        sendJson(
          res,
          400,
          failure(
            new KsbError({
              code: CODES.PARSE_FAILED,
              message: `comment body is not valid JSON: ${cause.message}`,
              exitCode: EXIT.VALIDATION,
            }),
          ),
        )
        return
      }
      try {
        // Validated against the *live* IR: the human commented on the page in
        // front of them, so that is the tree whose ids are legal.
        const entry = appendComment({
          artifactPath,
          blockId: body?.blockId,
          text: body?.text,
          blockIds: collectBlockIds(current.ir?.doc),
        })
        sendJson(res, 201, entry)
      } catch (error) {
        sendJson(res, 400, failure(error))
      }
      return
    }

    if (url.pathname === '/' && (req.method === 'GET' || req.method === 'HEAD')) {
      const html = injectDevRuntime(current.html)
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
      return
    }

    sendJson(res, 404, failure(new Error(`no route for ${req.method} ${url.pathname}`)))
  }

  let timer = null
  let watcher = null

  const rerender = async () => {
    try {
      const next = await compile()
      // Order is the invariant, not an optimisation: persist, *then* go live.
      // Comments are validated against whatever is live, so a page that led the
      // canonical by even one render could accept an anchor the canonical
      // cannot resolve — the drift seal F1 caught. If persisting fails, the old
      // render stays live and the failure is announced; the two never disagree.
      if (typeof persist === 'function') await persist(next)
      current = next
      broadcast(RELOAD_EVENT, { ok: true, at: new Date().toISOString() })
    } catch (error) {
      // A source the author has half-typed is not an emergency: keep serving the
      // last good render and say so, rather than dropping the preview or dying.
      broadcast(ERROR_EVENT, failure(error))
    }
  }

  const onFsEvent = (_eventType, filename) => {
    if (filename !== null && filename !== undefined && basename(filename) !== basename(source)) return
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void rerender()
    }, WATCH_DEBOUNCE_MS)
  }

  // The *directory* is watched, not the file: a save that replaces the inode
  // (write-temp-then-rename, which is what most editors do) leaves a file
  // watcher bound to a path nobody writes to again — reload would work once and
  // then quietly stop.
  try {
    watcher = watch(dirname(source), { persistent: true }, onFsEvent)
  } catch (cause) {
    throw new KsbError({
      code: CODES.SERVE_START_FAILED,
      message: `could not watch ${dirname(source)}: ${cause.message}`,
      exitCode: EXIT.VALIDATION,
    })
  }

  await new Promise((resolvePromise, rejectPromise) => {
    server.once('error', (cause) =>
      rejectPromise(
        new KsbError({
          code: CODES.SERVE_START_FAILED,
          message: `could not listen on ${host}:${port}: ${cause.message}`,
          exitCode: EXIT.VALIDATION,
        }),
      ),
    )
    server.listen(port, host, resolvePromise)
  })

  const actualPort = server.address().port

  const close = async () => {
    if (timer !== null) clearTimeout(timer)
    if (watcher !== null) watcher.close()
    for (const client of clients) client.end()
    clients.clear()
    await new Promise((done) => server.close(done))
  }

  return { url: `http://${host}:${actualPort}/`, port: actualPort, close }
}
