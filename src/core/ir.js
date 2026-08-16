import { engineVersion } from './version.js'

export const IR_VERSION = '1'
export const DEFAULT_GENERATOR = 'kamishibai-cli'
export const BUILD_TIME_ENV = 'KAMISHIBAI_BUILD_TIME'
/** SPEC §7.3 / issues/11 P4 — the embedding media type, verbatim. */
export const IR_SCRIPT_TYPE = 'application/kamishibai+json'

/**
 * Deterministic build timestamp: KAMISHIBAI_BUILD_TIME wins so that repeated
 * renders of the same input are byte-identical (CONTRACT A8).
 */
export function resolveCreatedAt(env = {}, now = () => new Date()) {
  const pinned = env[BUILD_TIME_ENV]
  if (typeof pinned === 'string' && pinned.trim().length > 0) return pinned.trim()
  return now().toISOString()
}

/**
 * Assemble the embedded IR envelope (SPEC §7.3). Key order is fixed so that
 * JSON.stringify output is stable.
 */
export function buildIr({ doc, template, createdAt, generator = DEFAULT_GENERATOR }) {
  return {
    irVersion: IR_VERSION,
    engine: engineVersion(),
    template: {
      namespace: template.namespace,
      name: template.name,
      version: template.version,
    },
    doc,
    createdAt,
    generator,
  }
}
