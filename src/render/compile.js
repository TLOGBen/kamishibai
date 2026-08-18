import { parseBlockTree, parseMarkdown } from '../parser/index.js'
import { renderArtifact } from './index.js'

/**
 * Source text → finished artifact, with no filesystem in sight.
 *
 * `render` and `serve` must agree byte for byte on what a source file becomes —
 * a preview that draws something the exported artifact does not is worse than
 * no preview. Sharing one function is what makes that agreement structural
 * rather than a matter of keeping two call sites in step.
 *
 * The template override reaches the *parser*, not just the renderer: whether
 * `---` is a page break is a template decision, so resolving it later would
 * compile a deck source as a document and then draw the empty result with the
 * deck template.
 *
 * @param {{source: string, format: 'markdown'|'json', template?: string,
 *   generator?: string, createdAt: string}} input
 * @returns {Promise<{html: string, ir: object, slides: number|undefined}>}
 */
export async function compileDocument({ source, format, template, generator, createdAt }) {
  const parsed = format === 'json' ? parseBlockTree(source) : parseMarkdown(source, { template })
  return await renderArtifact({
    doc: parsed.doc,
    templateKey: template ?? parsed.templateKey,
    createdAt,
    generator,
  })
}
