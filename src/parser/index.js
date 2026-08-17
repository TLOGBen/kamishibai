import MarkdownIt from 'markdown-it'
import matter from 'gray-matter'
import * as B from '../core/blocks.js'
import { CODES, validationError } from '../core/errors.js'
import { containerPlugin } from './container.js'
import { walkTokens, nestSections } from './tokens.js'

export const DEFAULT_TEMPLATE_KEY = 'kami/long-form'
/** The one template key under which `---` stops being decoration and cuts a slide. */
export const DECK_TEMPLATE_KEY = 'kami/slides'

/** `<namespace>/<name>` — the version suffix is advisory (see render/templates.js). */
const bareKey = (key) => String(key ?? '').split('@')[0]

const createMd = () => {
  const md = new MarkdownIt({ html: true, linkify: false, typographer: false })
  md.use(containerPlugin)
  return md
}

const pad2 = (value) => String(value).padStart(2, '0')

/** `YYYY-MM-DD` assembled from calendar *fields* — never sliced off an ISO string. */
const localCalendarDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const utcCalendarDay = (d) =>
  `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`

/**
 * YAML resolves a bare `date: 2026-08-17` to exactly UTC midnight: that value is
 * a *calendar day*, not an instant, so reading it back in UTC is what keeps it
 * stable everywhere. Anything with a time component is a real instant.
 */
const isCalendarDayOnly = (d) =>
  d.getUTCHours() === 0 &&
  d.getUTCMinutes() === 0 &&
  d.getUTCSeconds() === 0 &&
  d.getUTCMilliseconds() === 0

/**
 * Coerce one frontmatter value into a meta string, or `undefined` to drop it.
 *
 * Two failures live here, both of them silent:
 *
 *  - A *bare* `date:` is a Date object, so a `typeof === 'string'` gate threw
 *    the field away entirely — quoted dates shipped, unquoted ones vanished.
 *  - `toISOString().slice(0, 10)` re-reads the instant in UTC, so
 *    `2026-08-18 01:00:00 +08:00` displayed as 2026-08-17. A date the author
 *    wrote by hand must not come back a day earlier.
 *
 * So the day is assembled from calendar fields, picking the calendar the value
 * was written in (SPEC-facing normal form: `YYYY-MM-DD`).
 */
const asMetaString = (value) => {
  if (typeof value === 'string') return value.length > 0 ? value : undefined
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return isCalendarDayOnly(value) ? utcCalendarDay(value) : localCalendarDay(value)
  }
  return undefined
}

/** Frontmatter → doc meta with a deterministic key order. */
const buildMeta = (data) => {
  const meta = {}
  for (const key of B.META_KEY_ORDER) {
    const value = asMetaString(data[key])
    if (value !== undefined) meta[key] = value
  }
  const extras = Object.keys(data)
    .filter((k) => !B.META_KEY_ORDER.includes(k) && k !== 'template')
    .sort()
  for (const key of extras) {
    const value = asMetaString(data[key])
    if (value !== undefined) meta[key] = value
  }
  if (meta.title === undefined) meta.title = 'Untitled'
  return meta
}

/**
 * Cut the flat item stream into slides on `hr` markers and wrap them in a deck.
 * N separators yield N+1 slides — the segment count of the source, verbatim.
 */
const buildDeck = (items) => {
  const groups = [[]]
  for (const item of items) {
    if (item.kind === 'hr') groups.push([])
    else groups[groups.length - 1].push(item)
  }
  return B.deck({ slides: groups.map((group) => B.slide({ children: nestSections(group) })) })
}

/**
 * Compile the Markdown superset (frontmatter + fenced block types + `:::`
 * callouts) into a canonical block tree.
 *
 * @param {string} source
 * @param {{template?: string}} [options] CLI `-t` override; it decides deck mode
 *   just as frontmatter `template:` does, so the two entry points cannot disagree.
 * @returns {{doc: object, templateKey: string}}
 */
export function parseMarkdown(source, options = {}) {
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
  }

  const meta = buildMeta(front.data ?? {})
  const declared =
    typeof front.data?.template === 'string' && front.data.template.length > 0
      ? front.data.template
      : DEFAULT_TEMPLATE_KEY
  const templateKey =
    typeof options.template === 'string' && options.template.length > 0
      ? options.template
      : declared

  const flat = walkTokens(tokens, ctx)
  const children =
    bareKey(templateKey) === DECK_TEMPLATE_KEY ? [buildDeck(flat)] : nestSections(flat)

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
