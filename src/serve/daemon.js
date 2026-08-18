#!/usr/bin/env node
import { basename, extname, resolve } from 'node:path'
import { readSource } from '../delivery/read.js'
import { archiveArtifact, refreshArtifact } from '../delivery/store.js'
import { resolveCreatedAt } from '../core/ir.js'
import { compileDocument } from '../render/compile.js'
import { EXIT, KsbError, ROOT_PATH, CODES } from '../core/errors.js'
import { startServer } from './server.js'

/**
 * The detached half of `serve` (CONTRACT E1).
 *
 * `serve` has to return to the shell — an Agent that blocks on a preview server
 * cannot do anything else, and a foreground server dies with the session that
 * started it, which is precisely the state `close` exists to manage. So the CLI
 * spawns this file detached and hands back the URL.
 *
 * The handshake is one JSON line on stdout, written the moment the port is
 * really listening. That is what makes `serve` honest: the parent prints a URL
 * only after something answers on it, and a failure here comes back as the same
 * KSB_ finding shape any other command would have emitted, with its exit code.
 */

const parseArgs = (argv) => {
  const options = {}
  for (let i = 0; i < argv.length; i += 2) {
    const key = String(argv[i] ?? '').replace(/^--/, '')
    options[key] = argv[i + 1]
  }
  return options
}

const say = (payload) => {
  try {
    process.stdout.write(`${JSON.stringify(payload)}\n`)
  } catch {
    // The parent may already be gone; a preview server must not die of EPIPE.
  }
}

const toFinding = (error) =>
  error instanceof KsbError
    ? { finding: error.toFinding(), exitCode: error.exitCode }
    : {
        finding: { path: ROOT_PATH, code: CODES.PARSE_FAILED, message: error?.message ?? String(error) },
        exitCode: EXIT.VALIDATION,
      }

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const input = resolve(String(options.input))
  const project = String(options.project)
  const port = Number(options.port ?? 0)

  const compile = async () => {
    const { source, format } = readSource(input)
    return await compileDocument({
      source,
      format,
      template: options.template,
      generator: options.generator,
      createdAt: resolveCreatedAt(process.env),
    })
  }

  // The session claims **one** name in the store and then keeps that copy alive
  // (CONTRACT E1, seal patch F1). One name, because a live preview re-renders on
  // every keystroke-save and archiving each of those would bury the project's
  // presentation history under hundreds of near-identical records. *Alive*,
  // because comments anchor to this artifact: if it froze at the opening render
  // while the page moved on, a human could comment on a block the canonical does
  // not contain, and the file meant to answer "which block did they mean?" would
  // be the one thing unable to. So every later render replaces it atomically.
  // Artifacts from other runs are never touched — history stays immutable.
  const first = await compile()
  const slug = basename(input, extname(input)) || 'document'
  const { path: artifactPath } = archiveArtifact({
    project,
    slug,
    html: first.html,
    copies: [],
    env: process.env,
  })

  // The first render is handed over rather than repeated, so the served bytes
  // and the archived bytes are the same object; every later render goes through
  // the real compiler.
  const { url, port: actualPort, close } = await startServer({
    compile,
    initial: first,
    persist: (rendered) => refreshArtifact(artifactPath, rendered.html),
    sourcePath: input,
    artifactPath,
    port,
  })

  say({ ok: true, url, port: actualPort, pid: process.pid, artifact: artifactPath })

  const shutdown = () => {
    close().finally(() => process.exit(EXIT.OK))
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((error) => {
  const { finding, exitCode } = toFinding(error)
  say({ ok: false, errors: [finding], exitCode })
  process.exit(exitCode)
})
