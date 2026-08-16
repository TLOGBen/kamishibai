import { basename, extname } from 'node:path'
import { readArtifact } from '../../delivery/read.js'
import { extractIrPayloads } from '../../parser/artifact.js'
import { validateIr } from '../../core/validate.js'
import { replayCreatedAt, templateKeyOf } from '../../core/ir.js'
import { renderArtifact } from '../../render/index.js'
import { CODES, EXIT, KsbError } from '../../core/errors.js'
import { deliver } from '../deliver.js'

const irError = (code, message) => new KsbError({ code, message, exitCode: EXIT.VALIDATION })

/** Recover the IR envelope an artifact carries, or fail with a pinned code. */
function readEmbeddedIr(html, path) {
  const payloads = extractIrPayloads(html)
  if (payloads.length === 0) {
    throw irError(CODES.IR_MISSING, `no embedded IR found in ${path}; nothing to replay`)
  }
  if (payloads.length > 1) {
    throw irError(CODES.IR_DUPLICATE, `${path} carries ${payloads.length} IR payloads, expected 1`)
  }
  try {
    return JSON.parse(payloads[0])
  } catch (cause) {
    throw irError(CODES.IR_UNPARSABLE, `embedded IR in ${path} is not valid JSON: ${cause.message}`)
  }
}

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

  const { html } = await renderArtifact({
    doc: ir.doc,
    templateKey: options.template ?? templateKeyOf(ir),
    createdAt: replayCreatedAt(env, ir),
    generator: options.generator ?? ir.generator,
  })

  const slug = basename(path, extname(path)) || 'document'
  return deliver({ html, slug, options, env })
}
