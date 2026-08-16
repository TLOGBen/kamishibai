import MarkdownIt from 'markdown-it'
import matter from 'gray-matter'
import * as B from '../core/blocks.js'
import { CODES, validationError } from '../core/errors.js'
import { containerPlugin } from './container.js'
import { walkTokens, nestSections } from './tokens.js'

export const DEFAULT_TEMPLATE_KEY = 'kami/long-form'

const createMd = () => {
  const md = new MarkdownIt({ html: true, linkify: false, typographer: false })
  md.use(containerPlugin)
  return md
}

/** Frontmatter → doc meta with a deterministic key order. */
const buildMeta = (data) => {
  const meta = {}
  for (const key of B.META_KEY_ORDER) {
    if (typeof data[key] === 'string' && data[key].length > 0) meta[key] = data[key]
  }
  const extras = Object.keys(data)
    .filter((k) => !B.META_KEY_ORDER.includes(k) && k !== 'template')
    .sort()
  for (const key of extras) {
    if (typeof data[key] === 'string') meta[key] = data[key]
  }
  if (meta.title === undefined) meta.title = 'Untitled'
  return meta
}

/**
 * Compile the Markdown superset (frontmatter + fenced block types + `:::`
 * callouts) into a canonical block tree.
 *
 * @returns {{doc: object, templateKey: string}}
 */
export function parseMarkdown(source) {
  if (typeof source !== 'string' || source.trim().length === 0) {
    throw validationError('input is empty', CODES.INPUT_EMPTY, 'doc')
  }

  let front
  try {
    front = matter(source)
  } catch (cause) {
    throw validationError(
      `frontmatter is not valid YAML: ${cause.message}`,
      CODES.PARSE_FAILED,
      'doc.meta',
    )
  }

  const md = createMd()
  const env = {}
  let tokens
  try {
    tokens = md.parse(front.content, env)
  } catch (cause) {
    throw validationError(
      `markdown could not be compiled: ${cause.message}`,
      CODES.PARSE_FAILED,
      'doc',
    )
  }

  const ctx = {
    inline: (token) => (token ? md.renderer.renderInline(token.children ?? [], md.options, env) : ''),
    renderSlice: (slice) => md.renderer.render(slice, md.options, env),
  }

  const children = nestSections(walkTokens(tokens, ctx))
  const meta = buildMeta(front.data ?? {})
  const templateKey =
    typeof front.data?.template === 'string' && front.data.template.length > 0
      ? front.data.template
      : DEFAULT_TEMPLATE_KEY

  return { doc: B.withIds(B.doc({ meta, children })), templateKey }
}

/** Parse a canonical block-tree JSON document (the data-view entry point). */
export function parseBlockTree(source) {
  let parsed
  try {
    parsed = JSON.parse(source)
  } catch (cause) {
    throw validationError(`input is not valid JSON: ${cause.message}`, CODES.PARSE_FAILED, 'doc')
  }
  const node = parsed?.type === 'doc' ? parsed : parsed?.doc
  if (node?.type !== 'doc') {
    throw validationError('JSON input has no `doc` block at its root', CODES.PARSE_FAILED, 'doc')
  }
  const templateKey =
    typeof parsed?.template === 'string' && parsed.template.length > 0
      ? parsed.template
      : DEFAULT_TEMPLATE_KEY
  return { doc: B.withIds(node), templateKey }
}
