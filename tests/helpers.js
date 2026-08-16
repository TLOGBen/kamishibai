import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const CLI = fileURLToPath(new URL('../src/cli/index.js', import.meta.url))
const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Run the kamishibai CLI out-of-process; never throws. */
export function runCli(args, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      encoding: 'utf8',
      cwd: ROOT,
      env: { ...process.env, ...opts.env },
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
