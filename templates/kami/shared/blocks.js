import { h } from 'vue'

/**
 * The Kami block vocabulary renderers, shared by every template in the `kami`
 * namespace. Long-form and slides differ in chrome and layout, not in what a
 * `callout` or a `list` *is* — keeping one table here is what stops a second,
 * silently divergent rendering path from appearing per template.
 */

const CALLOUT_LABELS = Object.freeze({ note: 'NOTE', warn: 'WARNING' })

/**
 * Block-level flow content that `<p>` may not contain. A `<p>` wrapping a
 * `<ul>` is invalid HTML: the parser implicitly closes the paragraph, so the
 * real DOM becomes an empty `<p>`, a list that has escaped the `.prose`
 * styling scope, and another empty `<p>`. Pick the container to match.
 */
const BLOCK_LEVEL_CONTENT = /<(?:ul|ol|div|pre|table|blockquote|figure|hr|h[1-6])\b/i

const Prose = (props) =>
  h(BLOCK_LEVEL_CONTENT.test(props.block.html) ? 'div' : 'p', {
    class: 'prose',
    innerHTML: props.block.html,
  })

const Quote = (props) =>
  h('blockquote', { class: 'quote' }, renderChildren(props.block.children))

const Callout = (props) =>
  h('aside', { class: `callout callout-${props.block.variant}` }, [
    h('span', { class: 'callout-label' }, CALLOUT_LABELS[props.block.variant] ?? 'NOTE'),
    ...renderChildren(props.block.children),
  ])

const Code = (props) =>
  h('pre', { class: 'code' }, [
    h('code', { class: props.block.lang ? `language-${props.block.lang}` : null }, props.block.text),
  ])

const Table = (props) =>
  h('div', { class: 'table-wrap' }, [
    h('table', { class: 'table' }, [
      h('thead', [
        h(
          'tr',
          props.block.head.map((cell, i) => h('th', { key: i, innerHTML: cell })),
        ),
      ]),
      h(
        'tbody',
        props.block.rows.map((row, ri) =>
          h(
            'tr',
            { key: ri },
            row.map((cell, ci) => h('td', { key: ci, innerHTML: cell })),
          ),
        ),
      ),
    ]),
  ])

const RawIsland = (props) =>
  h(props.block.subtype === 'svg' ? 'figure' : 'div', {
    class: 'island',
    'data-intent': props.block.intent,
    innerHTML: props.block.html,
  })

/**
 * A `list` keeps its own frame and hands each item's blocks straight back to
 * `renderChildren`, so a callout inside a list item is the very same Callout
 * component as one at document level (CONTRACT C1).
 */
const List = (props) =>
  h(
    props.block.ordered ? 'ol' : 'ul',
    { class: 'list' },
    (props.block.items ?? []).map((item, index) =>
      h('li', { key: item?.[0]?.id ?? index }, renderChildren(item)),
    ),
  )

const Section = (props) => {
  const level = Math.min(Math.max(props.block.level ?? 1, 1), 6)
  return h('section', { class: `section section-l${level}`, id: props.block.id }, [
    h(`h${level}`, { class: 'section-title' }, props.block.title),
    ...renderChildren(props.block.children),
  ])
}

export const RENDERERS = Object.freeze({
  section: Section,
  prose: Prose,
  list: List,
  quote: Quote,
  callout: Callout,
  code: Code,
  table: Table,
  raw: RawIsland,
})

/** Render an array of blocks, skipping any type this template cannot draw. */
export function renderChildren(children) {
  if (!Array.isArray(children)) return []
  return children
    .filter((block) => RENDERERS[block.type] !== undefined)
    .map((block) => h(RENDERERS[block.type], { key: block.id, block }))
}
