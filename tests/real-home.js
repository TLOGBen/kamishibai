import { existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * CONTRACT B1 / premise P4 — `~/.kamishibai` is a protected asset. This module
 * is the one place that knows where it is, and it only ever *reads* it.
 *
 * Side-effect free on import: the global teardown and the per-file helpers both
 * load it, and neither may create anything just by asking the question.
 */
export const REAL_HOME = join(homedir(), '.kamishibai')

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? [full, ...walk(full)] : [full]
  })

/**
 * Paths inside the real store created or modified since `since`. Empty is the
 * only acceptable answer.
 *
 * Timestamps rather than mere existence: a developer with a real artifact store
 * must not see a false alarm, and a suite that already polluted the store once
 * must not be allowed to keep polluting it quietly.
 */
export function realHomeLeaks(since) {
  if (!existsSync(REAL_HOME)) return []
  return [REAL_HOME, ...walk(REAL_HOME)].filter((path) => statSync(path).mtimeMs >= since)
}
