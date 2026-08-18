import { execFileSync } from 'node:child_process'
import { EXIT } from '../../core/errors.js'
import { resolveHome } from '../../delivery/home.js'
import { ensureStoreRoot } from '../../delivery/store.js'
import { BROWSER_SETUP_COMMAND, browserMissingError, probeBrowser } from '../../export/browser.js'
import { registerBuiltinTemplates } from '../registry.js'

/**
 * `kamishibai setup [--dry-run]` — SPEC §10.1「初始化環境（建中央儲存庫、裝渲染依賴）」.
 *
 * The browser state is *probed*, never assumed: this command exists so that the
 * answer to "can this machine export?" is one command away, and a `setup` that
 * reported success without launching a browser would be exactly the reassuring
 * lie that D4 forbids.
 */

/** The three states this command can honestly report. */
export const BROWSER_STATES = Object.freeze(['present', 'installed', 'missing'])

const runInstall = () => {
  const [command, ...args] = BROWSER_SETUP_COMMAND.split(' ')
  execFileSync(command, args, { stdio: 'ignore' })
}

/**
 * @returns {Promise<{result: {ok: true, home: string, browser: string, command: string},
 *   exitCode: number}>}
 */
export async function setupCommand(options = {}, env = process.env) {
  const dryRun = options.dryRun === true
  const home = dryRun ? resolveHome(env) : ensureStoreRoot(env).root

  // Initialising the environment includes populating the template namespace
  // (CONTRACT E3): a store without `templates/` is only half a store. Skipped
  // under `--dry-run`, which must not create so much as a directory.
  if (!dryRun) registerBuiltinTemplates(env)

  const probe = await probeBrowser()
  if (probe.available) {
    return {
      result: { ok: true, home, browser: 'present', command: BROWSER_SETUP_COMMAND },
      exitCode: EXIT.OK,
    }
  }
  if (dryRun) {
    return {
      result: { ok: true, home, browser: 'missing', command: BROWSER_SETUP_COMMAND },
      exitCode: EXIT.OK,
    }
  }

  try {
    runInstall()
  } catch (cause) {
    throw browserMissingError(`\`${BROWSER_SETUP_COMMAND}\` 執行失敗（${cause.message}）`)
  }
  const after = await probeBrowser()
  if (!after.available) throw browserMissingError('安裝指令跑完了，瀏覽器仍然啟動不起來')

  return {
    result: { ok: true, home, browser: 'installed', command: BROWSER_SETUP_COMMAND },
    exitCode: EXIT.OK,
  }
}
