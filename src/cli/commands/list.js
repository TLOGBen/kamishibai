import { extractIrPayloads } from '../../parser/artifact.js'
import { templateLabelOf } from '../../core/ir.js'
import { EXIT } from '../../core/errors.js'
import { resolveProject } from '../../delivery/project.js'
import { readEntries } from '../../delivery/store.js'

/** CONTRACT B4 — the six keys of a list entry, in output order. */
export const LIST_KEYS = Object.freeze([
  'name',
  'template',
  'createdAt',
  'generator',
  'artifact',
  'copies',
])

/**
 * An artifact whose IR cannot be read is still a record in the store: it is
 * listed with empty descriptive fields rather than dropped, because a silently
 * shorter list is indistinguishable from "no such artifact".
 */
const irOf = (html) => {
  const payloads = extractIrPayloads(html)
  if (payloads.length !== 1) return null
  try {
    return JSON.parse(payloads[0])
  } catch {
    return null
  }
}

const toEntry = (record) => {
  const ir = irOf(record.html)
  return {
    name: record.name,
    template: ir === null ? '' : templateLabelOf(ir),
    createdAt: ir?.createdAt ?? '',
    generator: ir?.generator ?? '',
    artifact: record.path,
    copies: record.copies,
  }
}

/**
 * `kamishibai list [--project name]` — the project's presentation history
 * (SPEC §9.2). An empty project is an empty array with exit 0, not an error.
 *
 * @returns {{result: Array<object>, exitCode: number}}
 */
export function listCommand(options = {}, env = process.env, cwd = process.cwd()) {
  const project = resolveProject({ project: options.project, cwd })
  const entries = readEntries({ project: project.name, env }).map(toEntry)
  return { result: entries, exitCode: EXIT.OK }
}
