import { readSource } from '../../delivery/read.js'
import { parseMarkdown, parseBlockTree } from '../../parser/index.js'
import { resolveCreatedAt } from '../../core/ir.js'
import { renderArtifact } from '../../render/index.js'
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
  // The template decides whether `---` is a page break, so the `-t` override has
  // to reach the parser — resolving it only at render time would compile a deck
  // source as a document and then draw the empty result with the deck template.
  const parsed =
    format === 'json' ? parseBlockTree(source) : parseMarkdown(source, { template: options.template })

  const { html, slides } = await renderArtifact({
    doc: parsed.doc,
    templateKey: options.template ?? parsed.templateKey,
    createdAt: resolveCreatedAt(env),
    generator: options.generator,
  })

  return deliver({ html, slides, slug, options, env })
}
