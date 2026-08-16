import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REAL_HOME, realHomeLeaks } from './real-home.js'

const CLI = fileURLToPath(new URL('../src/cli/index.js', import.meta.url))
const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Verbatim CONTRACT constant — the one environment variable that moves the store. */
export const HOME_ENV = 'KAMISHIBAI_HOME'

/**
 * Every test file gets its own throwaway store root. One temp directory per
 * worker process is enough: the store is append-only, so tests within a file
 * can share it, while different files never collide.
 */
export const testHome = mkdtempSync(join(tmpdir(), 'kamishibai-test-home-'))

/**
 * CONTRACT B1 — the suite asserts its own HOME rather than trusting it.
 * A test run that writes into the developer's real `~/.kamishibai` would
 * silently pollute a protected asset, and no later assertion could see it.
 */
export function assertTestHome(value = testHome) {
  const abs = resolve(String(value ?? ''))
  if (abs === REAL_HOME || abs.startsWith(`${REAL_HOME}/`)) {
    throw new Error(`test ${HOME_ENV} must not be the real store root: ${abs}`)
  }
  if (abs === resolve(homedir())) {
    throw new Error(`test ${HOME_ENV} must not be the real home directory: ${abs}`)
  }
  if (!abs.startsWith(resolve(tmpdir()))) {
    throw new Error(`test ${HOME_ENV} must live under the OS temp dir: ${abs}`)
  }
  return abs
}

assertTestHome()

/**
 * The environment every CLI invocation must run under — `runCli` uses it, and
 * so must any test that spawns the CLI its own way (shell pipelines in A6).
 * Routing all spawns through one env builder is what makes "the suite never
 * touches the real home" a property of the harness rather than of each caller's
 * memory: the leak that motivated this was exactly a spawn that forgot.
 */
export function cliEnv(extra = {}) {
  const env = { ...process.env, [HOME_ENV]: testHome, ...extra }
  assertTestHome(env[HOME_ENV])
  return env
}

/** Wall-clock at helper load — anything newer inside the real store is our leak. */
export const SUITE_START = Date.now()

/** Re-exported so per-file tests and the global teardown share one definition. */
export { REAL_HOME }
export const leaksSinceLoad = () => realHomeLeaks(SUITE_START)

/**
 * Run the kamishibai CLI out-of-process; never throws.
 *
 * `KAMISHIBAI_HOME` is injected for *every* invocation (CONTRACT B1) — a test
 * that forgets it would archive into the real store. `opts.env` may still
 * override it, but only via a value that passes the same self-assertion.
 */
export function runCli(args, opts = {}) {
  const env = cliEnv(opts.env)
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      encoding: 'utf8',
      cwd: opts.cwd ?? ROOT,
      env,
      input: opts.input,
    })
    return { code: 0, stdout, stderr: '' }
  } catch (e) {
    return { code: e.status ?? -1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' }
  }
}

/** Absolute path of a per-test-file output directory (avoids parallel-run collisions). */
export function outDir(name) {
  return fileURLToPath(new URL(`../out-test/${name}/`, import.meta.url)).replace(/\/$/, '')
}

export const repoRoot = ROOT.replace(/\/$/, '')
export const cliPath = CLI

/** Extract the embedded IR JSON text from an artifact (null when absent). */
export function extractIrScripts(html) {
  const re = /<script type="application\/kamishibai\+json">([\s\S]*?)<\/script>/g
  const found = []
  let m
  while ((m = re.exec(html)) !== null) found.push(m[1])
  return found
}
