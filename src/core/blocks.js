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
  'list',
  'deck',
  'slide',
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
export const list = ({ ordered, items }) => Object.freeze({ type: 'list', ordered, items })
export const deck = ({ slides }) => Object.freeze({ type: 'deck', slides })
export const slide = ({ children }) => Object.freeze({ type: 'slide', children })

/**
 * A block nests its sub-blocks under one of three field shapes. Every generic
 * walk (id assignment, traversal) is written against this table rather than
 * against `children` alone — a new container type that forgot to be added here
 * would otherwise silently lose ids for everything inside it.
 *
 *  - `children` / `slides` — a flat array of blocks
 *  - `items`               — an array *of arrays* of blocks (one per list item)
 */
const BLOCK_ARRAY_KEYS = Object.freeze(['children', 'slides'])
const BLOCK_MATRIX_KEYS = Object.freeze(['items'])

/**
 * Assign deterministic document-order ids (b1, b2, …) to a block tree.
 * Returns a new tree; the input is untouched.
 */
export function withIds(node, counter = { n: 0 }) {
  counter.n += 1
  const id = `b${counter.n}`
  const { id: _previousId, children, slides, items, ...rest } = node
  const nested = { children, slides, items }
  const out = { id, ...rest }
  for (const key of BLOCK_MATRIX_KEYS) {
    const value = nested[key]
    if (!Array.isArray(value)) continue
    out[key] = value.map((group) =>
      Array.isArray(group) ? group.map((block) => withIds(block, counter)) : group,
    )
  }
  for (const key of BLOCK_ARRAY_KEYS) {
    const value = nested[key]
    if (!Array.isArray(value)) continue
    out[key] = value.map((block) => withIds(block, counter))
  }
  return out
}

/** Depth-first walk in document order, across every nesting shape. */
export function* walkBlocks(node, path = 'doc') {
  yield { block: node, path }
  for (const key of BLOCK_MATRIX_KEYS) {
    if (!Array.isArray(node[key])) continue
    for (const [group, blocks] of node[key].entries()) {
      if (!Array.isArray(blocks)) continue
      for (const [index, child] of blocks.entries()) {
        yield* walkBlocks(child, `${path}.${key}[${group}][${index}]`)
      }
    }
  }
  for (const key of BLOCK_ARRAY_KEYS) {
    if (!Array.isArray(node[key])) continue
    for (const [index, child] of node[key].entries()) {
      yield* walkBlocks(child, `${path}.${key}[${index}]`)
    }
  }
}

/** The first `deck` block in a tree, or undefined for a document artifact. */
export function findDeck(node) {
  for (const { block } of walkBlocks(node)) {
    if (block?.type === 'deck') return block
  }
  return undefined
}
