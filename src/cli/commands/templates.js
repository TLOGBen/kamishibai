import { EXIT } from '../../core/errors.js'
import { readTemplatePackages } from '../../delivery/templates.js'
import { registerBuiltinTemplates } from '../registry.js'

/** CONTRACT E3 — the four keys of a template listing entry, in output order. */
export const TEMPLATE_KEYS = Object.freeze(['namespace', 'name', 'version', 'root'])

/**
 * `kamishibai templates [--json]` (CONTRACT E3 / VC2).
 *
 * Reads the *store*, not the engine's internal registry, after making sure the
 * built-ins are registered. That order is the point: the listing has to be an
 * answer about what is installed on this machine — a listing computed from the
 * bundled modules would happily report templates whose packages were never
 * written, and the namespace would then be a claim nobody checks.
 *
 * @returns {{result: Array<object>, exitCode: number}}
 */
export function templatesCommand(options = {}, env = process.env) {
  registerBuiltinTemplates(env)
  const entries = readTemplatePackages(env).map((pkg) => ({
    namespace: pkg.namespace,
    name: pkg.name,
    version: pkg.version,
    root: pkg.root,
  }))
  return { result: entries, exitCode: EXIT.OK }
}
