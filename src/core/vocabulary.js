import { walkBlocks } from './blocks.js'
import { CODES, validationError } from './errors.js'

/**
 * `manifest.blocks` is a *guard*, not a brochure.
 *
 * A template draws the block types it knows and skips the rest. Skipping is the
 * right behaviour for a renderer — but as the only behaviour it is a silent
 * data-loss channel: handing a deck tree to `kami/long-form` (via `replay -t`
 * or a block-tree JSON that names the wrong template) dropped every slide,
 * produced an empty-bodied artifact, and still reported exit 0, `lint` 0 and a
 * slide count. Nothing in the pipeline could see it.
 *
 * So the vocabulary a template declares is checked against the document before
 * anything is drawn. A template that cannot express the document must say so
 * (CONTRACT C4) rather than quietly render less than it was given.
 *
 * Two claims are checked, because one cannot stand in for the other:
 *
 *  - `manifest.blocks` — which types this template can draw.
 *  - `manifest.root`   — which *shape* the document must have at its root.
 *
 * The mirror case is what forces the second: `kami/slides` must declare the
 * whole long-form vocabulary (prose, list, table … are all legal inside a
 * slide), so a flat document tree passes the type check completely — and then
 * the template draws only `deck.slides`, i.e. nothing, with a progress readout
 * of `1 / 0` contradicting itself on screen. Type-legal, shape-wrong.
 */

/** Every block type present in a tree, in document order of first appearance. */
export function collectBlockTypes(doc) {
  const seen = new Map()
  for (const { block, path } of walkBlocks(doc)) {
    const type = block?.type
    if (typeof type !== 'string' || seen.has(type)) continue
    seen.set(type, path)
  }
  return seen
}

/** The block types sitting directly under `doc` — the document's root form. */
const rootForms = (doc) =>
  (doc?.children ?? []).map((block) => block?.type).filter((type) => typeof type === 'string')

/**
 * Throw unless the document's root form matches `manifest.root`.
 * A template with `root: null` (or none declared) accepts any plain doc root.
 */
function assertRootForm({ doc, manifest, key }) {
  const required = manifest.root
  if (typeof required !== 'string' || required.length === 0) return
  const present = rootForms(doc)
  if (present.includes(required)) return
  const got = present.length === 0 ? '空的 doc' : `doc 形（頂層為 ${[...new Set(present)].join(', ')}）`
  throw validationError(
    `template "${key}" 需要 \`${required}\` 根形，收到 ${got}。` +
      `簡報須以 ${required} 語料著作（frontmatter \`template: ${key}\` ＋ \`---\` 切頁符），` +
      '書轉簡報屬文體轉換而非換皮：replay 只換皮，不重寫文體。' +
      `否則此模板只會畫出 ${required} 以外一律丟棄的空殼。`,
    CODES.TEMPLATE_BLOCK_UNSUPPORTED,
    'doc.children',
  )
}

/** Throw unless every block type in `doc` is declared by `manifest.blocks`. */
function assertDeclaredTypes({ doc, manifest, key }) {
  const declared = new Set(manifest.blocks ?? [])
  for (const [type, path] of collectBlockTypes(doc)) {
    if (declared.has(type)) continue
    throw validationError(
      `template "${key}" 的詞彙表不含 block 型別 \`${type}\`；` +
        `該模板宣告：${[...declared].join(', ')}。改用能表達它的模板，` +
        '或先把文件轉成該模板的詞彙——渲染層不會靜默濾除看不懂的 block。',
      CODES.TEMPLATE_BLOCK_UNSUPPORTED,
      path,
    )
  }
}

/**
 * Assert that a template can express this document, in both type and shape.
 *
 * @param {{doc: object, manifest: {namespace: string, name: string,
 *   blocks: string[], root?: string|null}}} input
 * @throws {import('./errors.js').KsbError} exit 1 / KSB_TEMPLATE_BLOCK_UNSUPPORTED
 */
export function assertTemplateVocabulary({ doc, manifest }) {
  const key = `${manifest.namespace}/${manifest.name}`
  assertDeclaredTypes({ doc, manifest, key })
  assertRootForm({ doc, manifest, key })
}
