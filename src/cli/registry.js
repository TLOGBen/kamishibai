import { engineVersion } from '../core/version.js'
import { builtinManifests } from '../render/index.js'
import { registerTemplatePackage } from '../delivery/templates.js'

/**
 * The one place where "what the engine can draw" (render layer) meets "what the
 * store records" (delivery layer). Wiring them here, at the CLI boundary, is
 * what keeps the store from importing templates and the renderer from knowing
 * where `~/.kamishibai` is.
 *
 * It runs on `setup`, on every delivery, and on `templates`/`debug` — a first
 * touch of any kind registers the built-ins, so an Agent that never ran `setup`
 * still finds the namespace populated (CONTRACT E3「`setup`（或首觸）」).
 */
export function registerBuiltinTemplates(env = process.env) {
  const engine = engineVersion()
  return builtinManifests().map((manifest) => registerTemplatePackage({ manifest, engine, env }))
}
