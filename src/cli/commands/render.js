import { join } from 'node:path'
import { readSource } from '../../delivery/read.js'
import { writeArtifact } from '../../delivery/write.js'
import { parseMarkdown, parseBlockTree } from '../../parser/index.js'
import { resolveCreatedAt } from '../../core/ir.js'
import { renderArtifact } from '../../render/index.js'
import { EXIT } from '../../core/errors.js'

/**
 * `kamishibai render <input> [-o out.html]`
 * @returns {Promise<{result: object, exitCode: number}>}
 */
export async function renderCommand(inputSpec, options = {}, env = process.env) {
  const { source, format, slug } = readSource(inputSpec)
  const parsed = format === 'json' ? parseBlockTree(source) : parseMarkdown(source)

  const { html } = await renderArtifact({
    doc: parsed.doc,
    templateKey: options.template ?? parsed.templateKey,
    createdAt: resolveCreatedAt(env),
    generator: options.generator,
  })

  const outPath = options.out ?? join('out', `${slug}.html`)
  const { path, bytes } = writeArtifact(outPath, html)

  return { result: { ok: true, artifact: path, bytes }, exitCode: EXIT.OK }
}
