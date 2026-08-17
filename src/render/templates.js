import longForm from '../../templates/kami/long-form/index.js'
import slides from '../../templates/kami/slides/index.js'
import { CODES, validationError } from '../core/errors.js'

/** Factory template registry (SPEC §6.1 出廠內建模板家族). */
const REGISTRY = new Map([
  [longForm.key, longForm],
  [slides.key, slides],
])

export function listTemplateKeys() {
  return [...REGISTRY.keys()].sort()
}

/** Resolve `<namespace>/<name>[@version]`; the version part is advisory in S1. */
export function resolveTemplate(key) {
  const bare = String(key ?? '').split('@')[0]
  const template = REGISTRY.get(bare)
  if (template === undefined) {
    throw validationError(
      `unknown template "${key}"; available: ${listTemplateKeys().join(', ')}`,
      CODES.TEMPLATE_NOT_FOUND,
      'doc.meta.template',
    )
  }
  return template
}
