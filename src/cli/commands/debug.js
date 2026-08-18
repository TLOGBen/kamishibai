import { EXIT } from '../../core/errors.js'
import { engineVersion } from '../../core/version.js'
import { resolveHome } from '../../delivery/home.js'
import { readTemplatePackages } from '../../delivery/templates.js'
import { readServeRecords } from '../../delivery/run.js'
import { probeBrowser } from '../../export/browser.js'
import { registerBuiltinTemplates } from '../registry.js'

/**
 * `kamishibai debug [--json]` — SPEC §10.1「診斷（環境、依賴、模板解析過程）」.
 *
 * One object that answers "what does this installation actually have?". The
 * browser line is **probed**, never inferred from a package being installed:
 * the same reasoning that governs `setup` applies here, and a diagnostic that
 * guesses is worse than none, because it is believed.
 *
 * @returns {Promise<{result: object, exitCode: number}>}
 */
export async function debugCommand(options = {}, env = process.env) {
  registerBuiltinTemplates(env)
  const probe = await probeBrowser()

  return {
    result: {
      ok: true,
      home: resolveHome(env),
      templates: readTemplatePackages(env).length,
      browser: probe.available ? 'present' : 'missing',
      engine: engineVersion(),
      servers: readServeRecords(env).length,
    },
    exitCode: EXIT.OK,
  }
}
