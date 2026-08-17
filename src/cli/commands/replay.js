import { basename, extname } from 'node:path'
import { readArtifact } from '../../delivery/read.js'
import { readEmbeddedIr } from '../../parser/artifact.js'
import { validateIr } from '../../core/validate.js'
import { replayCreatedAt, templateKeyOf } from '../../core/ir.js'
import { renderArtifact } from '../../render/index.js'
import { EXIT } from '../../core/errors.js'
import { deliver } from '../deliver.js'

/**
 * `kamishibai replay <artifact> [-o out.html]`
 *
 * Re-renders an artifact from its own embedded IR (SPEC §7.3). With
 * `KAMISHIBAI_BUILD_TIME` pinned the result is byte-identical to the original
 * render (CONTRACT B6) — which is what makes re-skinning and engine upgrades
 * verifiable rather than hopeful.
 *
 * @returns {Promise<{result: object, exitCode: number}>}
 */
export async function replayCommand(target, options = {}, env = process.env) {
  const { html: source, path } = readArtifact(target)
  const ir = readEmbeddedIr(source, path)

  const { errors } = validateIr(ir)
  if (errors.length > 0) return { result: { ok: false, errors }, exitCode: EXIT.VALIDATION }

  const { html, slides } = await renderArtifact({
    doc: ir.doc,
    templateKey: options.template ?? templateKeyOf(ir),
    createdAt: replayCreatedAt(env, ir),
    generator: options.generator ?? ir.generator,
  })

  const slug = basename(path, extname(path)) || 'document'
  return deliver({ html, slides, slug, options, env })
}
