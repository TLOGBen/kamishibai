/**
 * Canonical block vocabulary implemented in S1 (subset of SPEC §3).
 * Every factory returns a frozen new object — blocks are never mutated in place.
 */

export const BLOCK_TYPES = Object.freeze([
  'section',
  'prose',
  'quote',
  'callout',
  'code',
  'table',
  'raw',
])

export const CALLOUT_VARIANTS = Object.freeze(['note', 'warn'])
export const RAW_SUBTYPES = Object.freeze(['html', 'svg'])

export const META_KEY_ORDER = Object.freeze(['title', 'kicker', 'subtitle', 'author', 'date'])

export const doc = ({ meta, children }) => Object.freeze({ type: 'doc', meta, children })
export const section = ({ title, level, children }) =>
  Object.freeze({ type: 'section', title, level, children })
export const prose = (html) => Object.freeze({ type: 'prose', html })
export const quote = (children) => Object.freeze({ type: 'quote', children })
export const callout = ({ variant, children }) =>
  Object.freeze({ type: 'callout', variant, children })
export const code = ({ lang, text }) => Object.freeze({ type: 'code', lang, text })
export const table = ({ head, rows }) => Object.freeze({ type: 'table', head, rows })
export const raw = ({ subtype, intent, html }) =>
  Object.freeze({ type: 'raw', subtype, intent, html })

/**
 * Assign deterministic document-order ids (b1, b2, …) to a block tree.
 * Returns a new tree; the input is untouched.
 */
export function withIds(node, counter = { n: 0 }) {
  counter.n += 1
  const id = `b${counter.n}`
  const { id: _previousId, children, ...rest } = node
  if (!Array.isArray(children)) return { id, ...rest }
  return { id, ...rest, children: children.map((child) => withIds(child, counter)) }
}

/** Depth-first walk in document order. */
export function* walkBlocks(node, path = 'doc') {
  yield { block: node, path }
  if (!Array.isArray(node.children)) return
  for (const [index, child] of node.children.entries()) {
    yield* walkBlocks(child, `${path}.children[${index}]`)
  }
}
