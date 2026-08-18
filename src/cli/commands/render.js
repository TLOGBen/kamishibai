import { readSource } from '../../delivery/read.js'
import { resolveCreatedAt } from '../../core/ir.js'
import { compileDocument } from '../../render/compile.js'
import { deliver } from '../deliver.js'

/**
 * `kamishibai render <input> [-o out.html] [--project name]`
 *
 * Renders, archives the canonical copy into the central store, and writes the
 * delivery copy — the two are byte-identical by construction (CONTRACT B3).
 *
 * @returns {Promise<{result: object, exitCode: number}>}
 */
export async function renderCommand(inputSpec, options = {}, env = process.env) {
  const { source, format, slug } = readSource(inputSpec)

  const { html, slides } = await compileDocument({
    source,
    format,
    template: options.template,
    generator: options.generator,
    createdAt: resolveCreatedAt(env),
  })

  return deliver({ html, slides, slug, options, env })
}
